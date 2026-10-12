import { FEATURE_MAP, detectTech, detectFeatures } from './features.js';

/* ---------------- Parser lokal (rule-based, tanpa API) ---------------- */

function parseRow(line) {
  // Cek apakah ada penanda posisi Low / Mid / High
  let posChannel = null;
  const posMatch = line.match(/\b(low(?:est)?|mid(?:dle)?|high(?:est)?|ch\s*l|ch\s*m|ch\s*h)\b/i);
  if (posMatch) {
    const rawPos = posMatch[1].toLowerCase();
    if (rawPos.startsWith('l')) posChannel = 'Low';
    else if (rawPos.startsWith('m')) posChannel = 'Mid';
    else if (rawPos.startsWith('h')) posChannel = 'High';
  }

  const clean = line
    .replace(/802\.11\s*[a-z/]*/gi, ' ')
    .replace(/\d+(\.\d+)?\s*G(Hz)?\b/gi, ' ')
    .replace(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g, ' ');
  const toks = [...clean.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => ({ s: m[0], v: parseFloat(m[0]), dec: m[0].includes('.') }));
  if (toks.length < 1) return null;
  const powers = toks.filter((t) => t.dec && t.v >= -10 && t.v <= 40);
  if (!powers.length) return null;
  const freqIdx = toks.findIndex((t) => t.v >= 600 && t.v <= 7200 && !powers.includes(t));
  const freqs = toks.filter((t) => t.v >= 600 && t.v <= 7200 && !powers.includes(t)).map((t) => t.v);
  let channel = posChannel;
  if (!channel) {
    if (freqIdx > 0 && !toks[freqIdx - 1].dec) channel = toks[freqIdx - 1].s;
    else channel = toks.find((t) => !t.dec && !freqs.includes(t.v))?.s ?? null;
  }
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
  return `Anda adalah Asisten Pakar Pengujian Laboratorium SAR (Specific Absorption Rate) BBPPT.
Tugas Anda adalah membaca tabel-tabel data teknis laporan uji CONDUCTED POWER perangkat telekomunikasi berikut, dan mengekstrak NILAI DAYA TERUKUR TERTINGGI (Worst-Case Conducted Output Power) untuk menentukan kanal uji radiasi SAR.

Daftar 25 Fitur Resmi Indonesia yang dicari:
${feats.map((f) => `- ID: "${f.id}" | Nama: ${f.label} (Rentang frekuensi uplink: ${f.range[0]} - ${f.range[1]} MHz)`).join('\n')}

PEDOMAN PENTING & PENCOCOKAN SEMANTIK:
1. Alias Standar Telekomunikasi:
   - 2G: GSM 850, GSM 900 (EGSM/PGSM), DCS 1800 (GSM 1800).
   - 3G: WCDMA / UMTS / HSDPA / HSUPA / UTRA FDD (Band 1/I = 2100 MHz, Band 8/VIII = 900 MHz).
   - 4G LTE: LTE Band X / E-UTRA Band X / B1, B3, B5, B8, B28, B40, B41.
   - 5G NR: 5G NR Band nX / FR1 nX / n1, n3, n5, n8, n28, n40, n41.
   - WLAN: Wi-Fi / 802.11 b/g/n/ac/ax.
     * WLAN 2.4 GHz (2400-2484 MHz)
     * WLAN 5.1 GHz (U-NII-1: 5150-5250 MHz)
     * WLAN 5.2 GHz (U-NII-2A: 5250-5350 MHz)
     * WLAN 5.8 GHz (U-NII-3: 5725-5850 MHz)
     * WLAN 6 GHz (U-NII-5 s/d U-NII-8 / Wi-Fi 6E)
   - Bluetooth: Bluetooth BR/EDR (BDR, EDR, GFSK, 8DPSK) dan BLE (Bluetooth Low Energy 1M/2M).
2. Cara Memilih Nilai Daya (PENTING):
   - Ambil nilai daya TERUKUR (Average Conducted Power / Measured Power / Burst Average Power / Frame Average Power) dalam satuan dBm yang TERTINGGI (peak/maximum).
   - JANGAN mengambil kolom Tune-up Tolerance, Target Power, Max Limit, atau EIRP. Cari nilai daya terukur riil.
3. Ekstraksi Kanal & Frekuensi:
   - Ambil nomor kanal (Channel / ARFCN / EARFCN / NR-ARFCN) pada titik daya tertinggi tersebut.
   - PENTING: Jika di tabel laporan dokumen TIDAK mencantumkan nomor kanal angka/frekuensi MHz dan HANYA menyebut posisi kanal seperti "Low" (L / Bottom), "Mid" (M / Middle), atau "High" (H / Top), maka:
     * Isi kolom "channel" dengan: "Low", "Mid", atau "High" (sesuai posisi titik daya tertinggi).
     * Jika frekuensi tidak tertulis, boleh dikosongkan (null) atau diisi frekuensi pendekatan rentang band tersebut jika jelas.
   - Ambil nilai frekuensi dalam MHz jika tersedia (jika tidak ada di tabel, isi null).
   - Nomor halaman WAJIB diambil dari baris penanda "=== HALAMAN X ===".
   - Berikan kutipan teks baris tabel terkait di kolom "evidence".

Format Keluaran: Balas HANYA objek JSON valid (tanpa teks pembuka/penutup):
{
  "results": [
    {
      "feature_id": "LTE_B1",
      "max_power_dbm": 23.45,
      "channel": "18300",
      "frequency_mhz": 1950.0,
      "page": 84,
      "mode": "QPSK 20MHz 1RB#0",
      "evidence": "LTE Band 1 | 20MHz | 18300 | 1950.0 | 23.45 dBm"
    }
  ]
}

DOKUMEN:
${text}`;
}

async function callGemini(model, key, prompt) {
  let chosenModel = (model || 'gemini-3.5-flash').replace(/^models\//, '').trim();
  if (chosenModel.includes('2.5') || chosenModel.includes('1.5')) {
    chosenModel = 'gemini-3.5-flash';
  }
  
  const attempt = async (targetModel) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    return { res, model: targetModel };
  };

  let { res, model: usedModel } = await attempt(chosenModel);

  // Jika model 404 (retired) atau 503 (high demand), coba fallback ke gemini-3.5-flash / gemini-3.5-flash-lite
  if (!res.ok && (res.status === 404 || res.status === 503)) {
    const fallbackModel = chosenModel === 'gemini-3.5-flash' ? 'gemini-3.5-flash-lite' : 'gemini-3.5-flash';
    const fallback = await attempt(fallbackModel);
    if (fallback.res.ok) {
      res = fallback.res;
      usedModel = fallback.model;
    }
  }
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status} (${usedModel}): ${errText.slice(0, 180)}`);
  }
  
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '{}';
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

  // SMART PAGE SELECTION:
  // Temukan halaman-halaman yang memuat data tabel conducted power secara luas:
  // Ada kata dBm, Power, Conducted, ARFCN, Channel, atau nama teknologi seluler
  const powerKeywords = /\b(dBm|conducted|output\s*power|tune-?up|burst|average\s*power|channel|arfcn|earfcn|e-utra|wcdma|gsm|lte|nr|bluetooth|802\.11)\b/i;

  const relevantPages = pages.filter((p) => {
    // Halaman harus punya teks dan memuat karakteristik tabel teknis
    const fullText = p.lines.join(' ');
    return powerKeywords.test(fullText) && /\d+\.\d+/.test(fullText); // ada angka desimal (daya)
  });

  // Urutkan dan batasi maksimal 60 halaman tabel paling relevan (sangat hemat token, ~25k token)
  const chosen = relevantPages.slice(0, 75);
  log(`AI menyeleksi ${chosen.length} halaman tabel teknis dari total ${pages.length} halaman.`);

  // Kelompokkan per batch teks (~40.000 karakter per batch agar respons AI cepat dan tidak timeout)
  const batches = [];
  let buf = '';
  for (const p of chosen) {
    const block = `=== HALAMAN ${p.page} ===\n${p.lines.join('\n')}\n`;
    if (buf.length + block.length > 45000 && buf) {
      batches.push(buf);
      buf = '';
    }
    buf += block;
  }
  if (buf) batches.push(buf);

  const out = {};

  for (let i = 0; i < batches.length; i++) {
    log(`AI menganalisis batch ${i + 1}/${batches.length} (${settings.model})…`);
    try {
      const raw = await callGemini(settings.model, settings.key, buildPrompt(feats, batches[i]));
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/^```json|```$/g, '').trim());
      } catch {
        parsed = { results: [] };
      }
      for (const r of parsed.results || []) {
        const power = parseFloat(r.max_power_dbm);
        if (!selectedIds.includes(r.feature_id) || Number.isNaN(power)) continue;
        const page = parseInt(r.page, 10);
        if (!(page >= 1 && page <= pages.length)) continue;

        // Ambil nilai tertinggi jika ditemukan di beberapa halaman
        if (!out[r.feature_id] || power > out[r.feature_id].power) {
          out[r.feature_id] = {
            power,
            page,
            channel: r.channel != null && r.channel !== '' ? String(r.channel) : null,
            freq: r.frequency_mhz != null && r.frequency_mhz !== '' ? parseFloat(r.frequency_mhz) : null,
            mode: r.mode || '',
            evidence: r.evidence || '',
            source: 'AI (Gemini)',
          };
        }
      }
    } catch (batchErr) {
      log(`⚠ Batch ${i + 1} terkendala: ${batchErr.message}`);
    }
  }

  return out;
}

export function statusOf(r) {
  if (!r) return 'missing';
  // Jika daya ada dan posisi kanal (angka atau Low/Mid/High) ditemukan, dinyatakan Lolos (ok)
  return r.channel || r.freq ? 'ok' : 'partial';
}
