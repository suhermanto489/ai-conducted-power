# SAR-Verify AI (*Auto-SAR Conducted Power Extractor & Pre-Screening*)

Sistem otomasi berbasis **Document AI** untuk memverifikasi ketersediaan data *conducted power*, mengekstrak nilai daya tertinggi beserta kanal uji (*worst-case channel*), dan menerbitkan lembar kerja uji SAR (*SAR Work Order Sheet*) secara instan bagi Balai Besar Pengujian Perangkat Telekomunikasi (BBPPT / DJID).

## Fitur Utama
- **Front Office (Tim Pelayanan):** Matriks status verifikasi kelayakan (Lolos/Kurang) dan generator otomatis pesan revisi ke pemohon.
- **Back Office (Penguji Lab SAR):** Ekstraksi parameter uji (Daya Tertinggi dBm, Worst-Case Channel, Frekuensi MHz, Nomor Halaman Referensi, dan Ekspor Excel).
- **25 Fitur Frekuensi Standar Indonesia:** 2G GSM, 3G WCDMA, 4G LTE, 5G NR, WLAN (2.4/5.1/5.2/5.8/6 GHz), dan Bluetooth.
- **Arsitektur Hybrid:** Pre-processing dokumen lokal + AI LLM (Google Gemini / OpenAI).
- **Privacy-First:** Dokumen diproses langsung di browser secara aman tanpa database permanen.

## Menjalankan Secara Lokal
```bash
npm install
npm run dev
```
Buka `http://localhost:5173` di browser Anda.
