import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdf(arrayBuffer) {
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

/**
 * Ekstrak teks per halaman, direkonstruksi menjadi baris tabel.
 * Sel dalam satu baris dipisah " | " bila ada jarak horizontal yang lebar.
 */
export async function extractPages(pdf, onProgress) {
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, w: it.width, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    const lines = rows.map((r) => {
      r.items.sort((a, b) => a.x - b.x);
      let out = '', end = null;
      for (const it of r.items) {
        if (end !== null) out += it.x - end > 8 ? ' | ' : it.x - end > 1 ? ' ' : '';
        out += it.s.trim();
        end = it.x + it.w;
      }
      return out;
    });
    pages.push({ page: i, lines });
    page.cleanup();
    onProgress?.(i, pdf.numPages);
  }
  return pages;
}

export async function renderPage(pdf, num, canvas, scale = 1.6) {
  const page = await pdf.getPage(num);
  const vp = page.getViewport({ scale });
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
}
