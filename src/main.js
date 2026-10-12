import * as XLSX from 'xlsx';
import { FEATURES, GROUPS, FEATURE_MAP } from './features.js';
import { loadPdf, extractPages, renderPage } from './pdf.js';
import { localExtract, aiExtract, statusOf } from './extractor.js';

const $ = (s) => document.querySelector(s);
const state = { file: null, pdf: null, selected: new Set(), rows: [] };

/* ---------- Settings ---------- */
const DEFAULT_MODEL = { gemini: 'gemini-3.5-flash', local: '' };
const settings = Object.assign({ provider: 'local', model: '', key: '' }, JSON.parse(localStorage.getItem('sarSettings') || '{}'));
if (!settings.model || settings.model.includes('1.5') || settings.model.includes('2.5')) {
  settings.model = 'gemini-3.5-flash';
  localStorage.setItem('sarSettings', JSON.stringify(settings));
}
function refreshBadge() {
  const b = $('#engine-badge');
  const ai = settings.provider !== 'local' && settings.key;
  b.textContent = ai ? `Mode: Hybrid AI · ${settings.model}` : 'Mode: Parser Lokal';
  b.classList.toggle('ai', !!ai);
}
$('#btn-settings').onclick = () => {
  $('#set-provider').value = settings.provider;
  if ($('#set-model').querySelector(`option[value="${settings.model}"]`)) {
    $('#set-model').value = settings.model;
  } else {
    $('#set-model').value = 'gemini-3.5-flash';
  }
  $('#set-key').value = settings.key;
  $('#settings').classList.remove('hidden');
};
$('#set-provider').onchange = (e) => { $('#set-model').value = DEFAULT_MODEL[e.target.value]; };
$('#btn-save-settings').onclick = () => {
  settings.provider = $('#set-provider').value;
  settings.model = $('#set-model').value.trim() || DEFAULT_MODEL[settings.provider];
  settings.key = $('#set-key').value.trim();
  localStorage.setItem('sarSettings', JSON.stringify(settings));
  $('#settings').classList.add('hidden');
  refreshBadge();
  toast('Pengaturan disimpan');
};
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('.modal').classList.add('hidden')));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => e.target === m && m.classList.add('hidden')));

/* ---------- Feature checklist ---------- */
function renderFeatures(filter = '') {
  const q = filter.toLowerCase();
  $('#feature-list').innerHTML = GROUPS.map((g) => {
    const fs = FEATURES.filter((f) => f.group === g && (f.label + f.id).toLowerCase().includes(q));
    if (!fs.length) return '';
    return `<div class="feat-group"><h4>${g}<button data-all="${g}">pilih semua</button></h4><div class="chips">
      ${fs.map((f) => `<span class="chip ${state.selected.has(f.id) ? 'on' : ''}" data-id="${f.id}">${f.label}</span>`).join('')}
    </div></div>`;
  }).join('');
}
$('#feature-list').onclick = (e) => {
  const id = e.target.dataset.id, g = e.target.dataset.all;
  if (id) state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
  if (g) FEATURES.filter((f) => f.group === g).forEach((f) => state.selected.add(f.id));
  if (id || g) { renderFeatures($('#feat-search').value); updateReady(); }
};
$('#feat-search').oninput = (e) => renderFeatures(e.target.value);
$('#btn-select-none').onclick = () => { state.selected.clear(); renderFeatures($('#feat-search').value); updateReady(); };

function updateReady() {
  $('#sel-count').textContent = state.selected.size;
  $('#btn-analyze').disabled = !(state.file && state.selected.size);
}

/* ---------- Upload ---------- */
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));
$('#file-input').onchange = (e) => setFile(e.target.files[0]);
function setFile(f) {
  if (!f) return;
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return toast('Berkas harus PDF');
  if (f.size > 100 * 1024 * 1024) return toast('Ukuran maksimum 100 MB');
  state.file = f;
  const info = $('#file-info');
  info.textContent = `✔ ${f.name} · ${(f.size / 1048576).toFixed(1)} MB`;
  info.classList.remove('hidden');
  updateReady();
}

/* ---------- Analyze ---------- */
function log(msg) { const li = document.createElement('li'); li.textContent = msg; $('#progress-log').appendChild(li); }
function progress(text, pct) { $('#progress-text').textContent = text; $('#progress-bar').style.width = pct + '%'; }

$('#btn-analyze').onclick = async () => {
  const t0 = performance.now();
  const ids = [...state.selected];
  $('#step-results').classList.add('hidden');
  $('#step-progress').classList.remove('hidden');
  $('#progress-log').innerHTML = '';
  $('#btn-analyze').disabled = true;
  try {
    progress('Membaca PDF…', 5);
    state.pdf = await loadPdf(await state.file.arrayBuffer());
    log(`Dokumen ${state.pdf.numPages} halaman dimuat.`);
    const pages = await extractPages(state.pdf, (i, n) => progress(`Membaca teks halaman ${i}/${n}…`, 5 + (i / n) * 45));
    const chars = pages.reduce((a, p) => a + p.lines.join('').length, 0);
    if (chars < 50 * pages.length * 0.2) log('⚠ Teks sangat sedikit — kemungkinan PDF hasil scan (gambar). Hasil bisa tidak lengkap.');

    progress('Pencocokan semantik & parser lokal…', 55);
    const { results: local, candPages } = localExtract(pages, ids);
    log(`Parser lokal: ${Object.keys(local).length}/${ids.length} fitur terdeteksi.`);

    let final = { ...local };
    if (settings.provider !== 'local' && settings.key) {
      try {
        progress('AI mengekstrak data terstruktur…', 65);
        const ai = await aiExtract(pages, ids, candPages, settings, log);
        log(`AI: ${Object.keys(ai).length}/${ids.length} fitur diekstrak.`);
        final = { ...local, ...ai };
      } catch (err) {
        log(`⚠ AI gagal (${err.message}). Menggunakan hasil parser lokal.`);
      }
    } else log('API key belum diatur — memakai parser lokal saja.');

    state.rows = ids.map((id) => ({ f: FEATURE_MAP[id], r: final[id] || null, cands: [...candPages[id]] }));
    progress('Selesai', 100);
    log(`Selesai dalam ${((performance.now() - t0) / 1000).toFixed(1)} detik.`);
    setTimeout(() => {
      $('#step-progress').classList.add('hidden');
    }, 600);
    renderResults(((performance.now() - t0) / 1000).toFixed(1));
  } catch (err) {
    console.error(err);
    log(`✖ Gagal: ${err.message}`);
    toast('Gagal memproses dokumen');
  } finally {
    $('#btn-analyze').disabled = false;
  }
};

/* ---------- Results ---------- */
const STATUS = {
  ok: '<span class="pill ok">● Lolos</span>',
  partial: '<span class="pill warn">● Perlu Cek</span>',
  missing: '<span class="pill bad">● Kurang</span>',
};
const pgBtn = (p) => (p ? `<button class="pg-link" data-page="${p}">Hal. ${p}</button>` : '—');
const fmt = (v, d = '—') => (v === null || v === undefined || v === '' ? d : v);

function renderResults(secs) {
  const rows = state.rows;
  const n = { ok: 0, partial: 0, missing: 0 };
  rows.forEach((x) => n[statusOf(x.r)]++);
  const complete = n.ok === rows.length;
  $('#stats').innerHTML = `
    <div class="stat"><div class="v">${rows.length}</div><div class="k">Fitur diajukan</div></div>
    <div class="stat ok"><div class="v">${n.ok}</div><div class="k">Lolos</div></div>
    <div class="stat bad"><div class="v">${n.missing + n.partial}</div><div class="k">Kurang / Perlu cek</div></div>
    <div class="stat"><div class="v">${secs}s</div><div class="k">Waktu proses</div></div>
    <div class="verdict ${complete ? 'ok' : 'bad'}">${complete
      ? '✔ Dokumen LENGKAP — siap diterbitkan Work Order SAR.'
      : `✖ Dokumen BELUM LENGKAP — ${n.missing + n.partial} fitur perlu revisi dari pemohon.`}</div>`;

  $('#tbl-fo').innerHTML = `<thead><tr><th>#</th><th>Fitur</th><th>Status</th><th>Keterangan</th><th>Halaman</th><th>Sumber</th></tr></thead><tbody>
    ${rows.map((x, i) => {
      const s = statusOf(x.r);
      const ket = s === 'ok'
        ? (x.r.channel && ['Low', 'Mid', 'High'].includes(x.r.channel) ? `Daya & kanal (${x.r.channel}) tertera` : 'Daya, kanal, dan frekuensi tertera')
        : s === 'partial' ? `Daya ditemukan (${x.r.power} dBm), posisi kanal/frekuensi tidak spesifik`
        : x.cands.length ? `Disebut di hal. ${x.cands.slice(0, 5).join(', ')} tetapi tabel daya tidak ditemukan` : 'Tidak ditemukan dalam dokumen';
      return `<tr><td>${i + 1}</td><td><b>${x.f.label}</b></td><td>${STATUS[s]}</td><td>${ket}</td><td>${pgBtn(x.r?.page)}</td><td class="src">${x.r?.source || '—'}</td></tr>`;
    }).join('')}</tbody>`;

  const bad = rows.filter((x) => statusOf(x.r) !== 'ok');
  $('#revision-box').classList.toggle('hidden', !bad.length);
  if (bad.length) {
    $('#revision-text').value = `Yth. Pemohon,

Berdasarkan hasil pemeriksaan dokumen laporan uji conducted power "${state.file.name}", kami informasikan bahwa data berikut belum lengkap:

${bad.map((x, i) => {
  const s = statusOf(x.r);
  return `${i + 1}. ${x.f.label} — ${s === 'missing' ? 'data conducted power tidak ditemukan' : `data kanal/frekuensi tidak lengkap (hal. ${x.r.page})`}`;
}).join('\n')}

Mohon melengkapi data conducted power (nilai daya dBm, nomor kanal, dan frekuensi uji) untuk fitur di atas dan mengunggah kembali dokumen revisi.

Terima kasih.
Tim Pelayanan Pengujian SAR`;
  }

  $('#tbl-bo').innerHTML = `<thead><tr><th>#</th><th>Fitur / Pita</th><th>Daya Tertinggi (dBm)</th><th>Kanal Uji (Worst-Case)</th><th>Frekuensi (MHz)</th><th>Mode / Kondisi</th><th>Halaman Sumber</th><th>Status</th></tr></thead><tbody>
    ${rows.map((x, i) => `<tr><td>${i + 1}</td><td><b>${x.f.label}</b></td>
      <td class="power">${x.r ? x.r.power.toFixed(2) : '—'}</td><td class="mono">${fmt(x.r?.channel)}</td>
      <td class="mono">${fmt(x.r?.freq)}</td><td title="${(x.r?.evidence || '').replace(/"/g, '&quot;')}">${fmt(x.r?.mode)}</td>
      <td>${pgBtn(x.r?.page)}</td><td>${STATUS[statusOf(x.r)]}</td></tr>`).join('')}</tbody>`;

  $('#step-results').classList.remove('hidden');
  $('#step-results').scrollIntoView({ behavior: 'smooth' });
}

document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#tab-fo').classList.toggle('hidden', t.dataset.tab !== 'fo');
  $('#tab-bo').classList.toggle('hidden', t.dataset.tab !== 'bo');
}));

$('#btn-copy-rev').onclick = async () => { await navigator.clipboard.writeText($('#revision-text').value); toast('Catatan revisi disalin'); };
$('#btn-print').onclick = () => window.print();
$('#btn-xlsx').onclick = () => {
  const data = state.rows.map((x, i) => ({
    No: i + 1, Fitur: x.f.label,
    'Daya Tertinggi (dBm)': x.r?.power ?? '', 'Kanal Uji': x.r?.channel ?? '', 'Frekuensi (MHz)': x.r?.freq ?? '',
    'Mode/Kondisi': x.r?.mode ?? '', 'Halaman Sumber': x.r?.page ?? '',
    Status: { ok: 'Lolos', partial: 'Perlu Cek', missing: 'Kurang' }[statusOf(x.r)], Sumber: x.r?.source ?? '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Work Order SAR');
  XLSX.writeFile(wb, `WorkOrder_SAR_${state.file.name.replace(/\.pdf$/i, '')}.xlsx`);
};

/* ---------- PDF page viewer ---------- */
document.addEventListener('click', async (e) => {
  const p = e.target.dataset?.page;
  if (!p || !state.pdf) return;
  $('#viewer-title').textContent = `${state.file.name} — Halaman ${p}`;
  $('#viewer').classList.remove('hidden');
  await renderPage(state.pdf, parseInt(p, 10), $('#viewer-canvas'));
});

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

renderFeatures();
refreshBadge();
