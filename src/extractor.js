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
Tugas Anda: Membaca tabel-tabel teknis laporan uji CONDUCTED POWER perangkat telekomunikasi (dari berbagai format lab internasional seperti Sporton, SGS, BACL, CTTL, Morlab, dll.) dan mengekstrak NILAI DAYA TERUKUR TERTINGGI (Worst-Case Conducted Output Power) untuk menentukan kanal uji radiasi SAR.

Daftar Fitur yang dicari pada batch dokumen ini:
${feats.map((f) => `- ID: "${f.id}" | Nama: ${f.label} (Rentang Uplink/TX: ${f.range[0]} - ${f.range[1]} MHz)`).join('\n')}

PEDOMAN PENTING & ANTI-HALUSINASI (AGAR HASIL TIDAK KELIRU):
1. ATURAN MEMILIH NILAI DAYA (SANGAT KRUSIAL):
   - Ambil nilai DAYA TERUKUR RIIL (Measured Power / Average Conducted Power / Burst Avg Power / Frame Avg Power) TERTINGGI dalam satuan dBm.
   - DILARANG KERAS mengambil kolom "Tune-up Tolerance", "Tune-up Limit", "Target Power", "Max Limit", atau "EIRP". Cari baris/kolom data terukur nyata.
   - Untuk perangkat Router/WLAN MIMO (Multiple Antena): Jika ada kolom "Total Power" / "Summed Conducted Power", ambil nilai TOTAL tersebut. Jika hanya ada Ant 1 & Ant 2 terpisah, ambil nilai tertinggi di antara kedua antena.

2. ATURAN KANAL & FREKUENSI:
   - Ambil nomor kanal asli (Channel / ARFCN / EARFCN / NR-ARFCN / UARFCN).
   - JIKA tabel TIDAK mencantumkan nomor kanal angka/frekuensi MHz dan HANYA menulis posisi kanal (seperti "Low" / "L" / "Bottom", "Mid" / "M", "High" / "H" / "Top"):
     * WAJIB isi kolom "channel" dengan teks: "Low", "Mid", atau "High".
     * Kolom "frequency_mhz" boleh diisi null atau frekuensi representatif rentang band.
   - Pastikan nomor halaman ("page") diambil dari tanda "=== HALAMAN X ===" tempat baris data tersebut ditemukan.

3. CONTOH KELUARAN YANG BENAR (FEW-SHOT):
   Contoh 1 (Format Seluler / LTE):
   Baris dokumen: "LTE Band 3 | 20MHz | QPSK 1RB#0 | Ch 19575 | 1747.5 MHz | Measured: 23.45 dBm | Tune up: 24.50 dBm"
   Output: {"feature_id": "LTE_B3", "max_power_dbm": 23.45, "channel": "19575", "frequency_mhz": 1747.5, "page": 42, "mode": "20MHz QPSK 1RB#0", "evidence": "Ch 19575 | 1747.5 MHz | Measured: 23.45 dBm"}

   Contoh 2 (Format Wi-Fi / Router Low Mid High):
   Baris dokumen: "802.11ax HE40 | Ant 1+2 Summed | High Channel | 21.80 dBm"
   Output: {"feature_id": "WLAN_5_8", "max_power_dbm": 21.80, "channel": "High", "frequency_mhz": null, "page": 88, "mode": "802.11ax HE40 Ant 1+2", "evidence": "802.11ax HE40 | Ant 1+2 Summed | High Channel | 21.80 dBm"}

Format Keluaran: Balas HANYA objek JSON valid (tanpa markdown wrapper):
{
  "results": [
    {
      "feature_id": "ID_FITUR_SESUAI_DAFTAR",
      "max_power_dbm": 23.45,
      "channel": "18300 atau Low/Mid/High",
      "frequency_mhz": 1950.0,
      "page": 84,
      "mode": "keterangan modulasi/bandwidth/chain",
      "evidence": "kutipan baris teks asli"
    }
  ]
}

DOKUMEN TEKS:
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

  // SMART PAGE SELECTION & CLEANING:
  // 1. Temukan halaman-halaman yang memuat data tabel conducted power secara luas
  const powerKeywords = /\b(dBm|conducted|output\s*power|tune-?up|burst|average\s*power|channel|arfcn|earfcn|e-utra|wcdma|gsm|lte|nr|bluetooth|802\.11)\b/i;

  // Filter baris berulang yang tidak relevan (Header lab, disclaimer, alamat, nomor laporan)
  const junkPatterns = /\b(Page\s*\d+\s*of\s*\d+|Report\s*No\.?|FCC\s*ID|IC:\s*|Test\s*Lab|Testing\s*Laborat|Building\s*\w+|Road,\s*Shenzhen|Guangdong|All\s*rights\s*reserved|TRF\s*No|Project\s*No)\b/i;

  const relevantPages = pages.filter((p) => {
    const fullText = p.lines.join(' ');
    return powerKeywords.test(fullText) && /\d+\.\d+/.test(fullText);
  });

  // Dukung hingga 250 halaman tabel teknis tanpa terpotong!
  const chosen = relevantPages.slice(0, 250);
  log(`AI menyeleksi ${chosen.length} halaman tabel teknis dari total ${pages.length} halaman.`);

  // Bersihkan baris sampah dari setiap halaman untuk memangkas konsumsi token hingga ~35%
  const cleanedPages = chosen.map((p) => {
    const usefulLines = p.lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 3) return false;
      if (junkPatterns.test(trimmed) && !/dBm/i.test(trimmed)) return false;
      return true;
    });
    return { page: p.page, text: usefulLines.join('\n') };
  });

  // Kelompokkan per batch teks (~45.000 karakter per batch agar respon AI cepat, akurat, dan tidak timeout)
  const batches = [];
  let buf = '';
  for (const p of cleanedPages) {
    const block = `=== HALAMAN ${p.page} ===\n${p.text}\n`;
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
