import { FEATURE_MAP, detectTech, detectFeatures } from './features.js';

/* ---------------- Parser lokal (rule-based, tanpa API) ---------------- */

function parseRow(line) {
  const clean = line
    .replace(/802\.11\s*[a-z/]*/gi, ' ')
    .replace(/\d+(\.\d+)?\s*G(Hz)?\b/gi, ' ')
    .replace(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g, ' ');
  const toks = [...clean.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => ({ s: m[0], v: parseFloat(m[0]), dec: m[0].includes('.') }));
  if (toks.length < 2) return null;
  const powers = toks.filter((t) => t.dec && t.v >= -10 && t.v <= 40);
  if (!powers.length) return null;
  const freqIdx = toks.findIndex((t) => t.v >= 600 && t.v <= 7200 && !powers.includes(t));
  const freqs = toks.filter((t) => t.v >= 600 && t.v <= 7200 && !powers.includes(t)).map((t) => t.v);
  let channel = null;
  if (freqIdx > 0 && !toks[freqIdx - 1].dec) channel = toks[freqIdx - 1].s;
  else channel = toks.find((t) => !t.dec && !freqs.includes(t.v))?.s ?? null;
  if (!freqs.length && !channel) return null;
  return { freqs, channel, power: Math.max(...powers.map((p) => p.v)) };
}

export function localExtract(pages, selectedIds) {
  const feats = selectedIds.map((id) => FEATURE_MAP[id]);
  const results = {};
  const candPages = Object.fromEntries(selectedIds.map((id) => [id, new Set()]));
  let tech = null, active = [];

  for (const { page, lines } of pages) {
    for (const line of lines) {
      const t = detectTech(line);
      if (t) tech = t;
      const hits = detectFeatures(line, tech, feats);
      if (hits.length) { active = hits; hits.forEach((h) => candPages[h].add(page)); }
      if (!active.length) continue;
      const row = parseRow(line);
      if (!row) continue;
      for (const id of active) {
        const f = FEATURE_MAP[id];
        const freq = row.freqs.find((v) => v >= f.range[0] - 1 && v <= f.range[1] + 1) ?? null;
        if (!freq && (row.freqs.length || active.length > 1)) continue; // frekuensi milik pita lain
        const cur = results[id];
        if (!cur || row.power > cur.power || (row.power === cur.power && !cur.freq && freq)) {
          results[id] = { power: row.power, channel: row.channel, freq, page, mode: '', evidence: line.slice(0, 160), source: 'Lokal' };
        }
      }
    }
  }
  return { results, candPages };
}

/* ---------------- AI (Gemini / OpenAI) ---------------- */

function buildPrompt(feats, text) {
  return `Anda adalah ekstraktor data laporan uji CONDUCTED POWER untuk menentukan kanal uji SAR.

Fitur yang dicari (id: nama):
${feats.map((f) => `- ${f.id}: ${f.label} (uplink ${f.range[0]}-${f.range[1]} MHz)`).join('\n')}

Aturan:
1. Kenali alias istilah: E-UTRA = LTE, UTRA FDD/UMTS/HSPA = WCDMA, "NR Band n78" = NR n78, 802.11b/g/n/ax 2.4GHz = WLAN 2.4 GHz, U-NII-1..4 = WLAN 5 GHz, U-NII-5..8 = WLAN 6 GHz, BDR/EDR = Bluetooth, LE 1M/2M = Bluetooth LE, EGSM900 = GSM 900, GSM1800 = DCS 1800.
2. Untuk tiap fitur, ambil nilai daya TERUKUR (measured/average conducted power, dBm) TERTINGGI di seluruh mode, modulasi, bandwidth, RB, dan kanal. JANGAN gunakan kolom tune-up limit/target/tolerance.
3. Laporkan kanal (channel/ARFCN/EARFCN/NR-ARFCN) dan frekuensi MHz pada nilai tertinggi itu, nomor halaman dari penanda "=== HALAMAN n ===", serta mode/kondisi.
4. Jika data fitur tidak ada, JANGAN cantumkan fitur tersebut. Jangan mengarang angka.

Balas HANYA JSON:
{"results":[{"feature_id":"LTE_B1","max_power_dbm":23.5,"channel":"18300","frequency_mhz":1950,"page":84,"mode":"QPSK 20MHz 1RB#0","evidence":"kutipan baris tabel"}]}

DOKUMEN:
${text}`;
}

async function callGemini(model, key, prompt) {
  // Model resmi aktif per dokumentasi Google Gemini (aistudio.google.com/docs/models):
  // gemini-2.5-flash, gemini-2.0-flash, gemini-flash-latest, gemini-3.8-flash
  const cleanModel = (model || 'gemini-2.5-flash').replace(/^models\//, '').trim();
  
  const candidates = [
    cleanModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.8-flash',
  ];

  const uniqueCandidates = [...new Set(candidates)];
  let lastErr = null;

  for (const m of uniqueCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '{}';
      }
      const errText = await res.text();
      lastErr = new Error(`Gemini ${res.status} (${m}): ${errText.slice(0, 160)}`);
      // Jika 404 (model deprecated / tidak ditemukan), coba model berikutnya
      if (res.status === 404) continue;
      // Jika error lain (misal invalid key 400 atau kuota 429), langsung throw
      throw lastErr;
    } catch (e) {
      if (e.message?.includes('404')) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Gagal menghubungi Gemini API');
}

async function callOpenAI(model, key, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '{}';
}

export async function aiExtract(pages, selectedIds, candPages, settings, log) {
  const feats = selectedIds.map((id) => FEATURE_MAP[id]);
  // Halaman kandidat (+1 halaman berikutnya karena tabel sering terpotong)
  const want = new Set();
  Object.values(candPages).forEach((s) => s.forEach((p) => { want.add(p); want.add(p + 1); }));
  if (!want.size) pages.filter((p) => p.lines.some((l) => /dBm|conducted|output power/i.test(l))).forEach((p) => want.add(p.page));
  const chosen = pages.filter((p) => want.has(p.page)).slice(0, 120);
  log(`AI menerima ${chosen.length} halaman kandidat dari ${pages.length} halaman.`);

  const batches = [];
  let buf = '';
  for (const p of chosen) {
    const block = `=== HALAMAN ${p.page} ===\n${p.lines.join('\n')}\n`;
    if (buf.length + block.length > 60000 && buf) { batches.push(buf); buf = ''; }
    buf += block;
  }
  if (buf) batches.push(buf);

  const call = settings.provider === 'openai' ? callOpenAI : callGemini;
  const out = {};
  for (let i = 0; i < batches.length; i++) {
    log(`Mengirim batch ${i + 1}/${batches.length} ke ${settings.provider === 'openai' ? 'OpenAI' : 'Gemini'} (${settings.model})…`);
    const raw = await call(settings.model, settings.key, buildPrompt(feats, batches[i]));
    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```json|```$/g, '').trim()); } catch { parsed = { results: [] }; }
    for (const r of parsed.results || []) {
      const power = parseFloat(r.max_power_dbm);
      if (!selectedIds.includes(r.feature_id) || Number.isNaN(power)) continue;
      const page = parseInt(r.page, 10);
      if (!(page >= 1 && page <= pages.length)) continue;
      if (!out[r.feature_id] || power > out[r.feature_id].power) {
        out[r.feature_id] = {
          power, page,
          channel: r.channel != null && r.channel !== '' ? String(r.channel) : null,
          freq: r.frequency_mhz != null && r.frequency_mhz !== '' ? parseFloat(r.frequency_mhz) : null,
          mode: r.mode || '', evidence: r.evidence || '', source: 'AI',
        };
      }
    }
  }
  return out;
}

export function statusOf(r) {
  if (!r) return 'missing';
  return r.channel && r.freq ? 'ok' : 'partial';
}
