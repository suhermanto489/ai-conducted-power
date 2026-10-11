// Katalog fitur standar frekuensi telekomunikasi Indonesia (DJID / BBPPT).
// 25 fitur resmi sesuai penomoran dan format penamaan revisi terbaru.

export const FEATURES = [
  // 1-3: 2G GSM
  {
    id: 'GSM850',
    group: '2G GSM',
    label: '2G GSM 850 MHz',
    tech: 'GSM',
    range: [824, 849],
    patterns: [/GSM\s*-?\s*850/i, /\bCellular\s*850\b/i]
  },
  {
    id: 'GSM900',
    group: '2G GSM',
    label: '2G GSM 900 MHz',
    tech: 'GSM',
    range: [880, 915],
    patterns: [/E?-?GSM\s*-?\s*900/i, /\bP-?GSM\b/i, /GSM\s*900/i]
  },
  {
    id: 'DCS1800',
    group: '2G GSM',
    label: '2G DCS 1800 MHz',
    tech: 'GSM',
    range: [1710, 1785],
    patterns: [/DCS\s*-?\s*1800/i, /GSM\s*-?\s*1800/i]
  },

  // 4-5: 3G WCDMA
  {
    id: 'WCDMA_B8',
    group: '3G WCDMA',
    label: '3G WCDMA B1 900 MHz',
    tech: 'WCDMA',
    range: [880, 915],
    patterns: [/(WCDMA|UMTS|HSPA\+?|UTRA\s*FDD)[^\n]{0,25}?(Band\s*(VIII|8|1|I)|900\s*MHz)/i, /WCDMA[^\n]{0,15}?900/i],
    ctxPatterns: [/\b(Band\s*(VIII|8|1|I)|B8|B1|900\s*MHz)\b/i]
  },
  {
    id: 'WCDMA_B1',
    group: '3G WCDMA',
    label: '3G WCDMA B1 2100 MHz',
    tech: 'WCDMA',
    range: [1920, 1980],
    patterns: [/(WCDMA|UMTS|HSPA\+?|UTRA\s*FDD)[^\n]{0,25}?(Band\s*(I|1)|2100\s*MHz)/i, /WCDMA[^\n]{0,15}?2100/i],
    ctxPatterns: [/\b(Band\s*(I|1)|B1|2100\s*MHz)\b/i]
  },

  // 6-12: 4G LTE
  {
    id: 'LTE_B28',
    group: '4G LTE',
    label: '4G LTE Band 28 (700 MHz)',
    tech: 'LTE',
    range: [703, 748],
    patterns: [/(LTE|E-?UTRA)[^\n]{0,25}?(Band\s*|B)28\b/i, /LTE[^\n]{0,15}?700\s*MHz/i],
    ctxPatterns: [/(?<![nN\w])(Band\s*|B)28\b/i]
  },
  {
    id: 'LTE_B5',
    group: '4G LTE',
    label: '4G LTE Band 5 (850 MHz)',
    tech: 'LTE',
    range: [824, 849],
    patterns: [/(LTE|E-?UTRA)[^\n]{0,25}?(Band\s*|B)5\b/i, /LTE[^\n]{0,15}?850\s*MHz/i],
    ctxPatterns: [/(?<![nN\w])(Band\s*|B)5\b/i]
  },
  {
    id: 'LTE_B8',
    group: '4G LTE',
    label: '4G LTE Band 8 (900 MHz)',
    tech: 'LTE',
    range: [880, 915],
    patterns: [/(LTE|E-?UTRA)[^\n]{0,25}?(Band\s*|B)8\b/i, /LTE[^\n]{0,15}?900\s*MHz/i],
    ctxPatterns: [/(?<![nN\w])(Band\s*|B)8\b/i]
  },
  {
    id: 'LTE_B3',
    group: '4G LTE',
    label: '4G LTE Band 3 (1800 MHz)',
    tech: 'LTE',
    range: [1710, 1785],
    patterns: [/(LTE|E-?UTRA)[^\n]{0,25}?(Band\s*|B)3\b/i, /LTE[^\n]{0,15}?1800\s*MHz/i],
    ctxPatterns: [/(?<![nN\w])(Band\s*|B)3\b/i]
  },
  {
    id: 'LTE_B1',
    group: '4G LTE',
    label: '4G LTE Band 1 (2100 MHz)',
    tech: 'LTE',
    range: [1920, 1980],
    patterns: [/(LTE|E-?UTRA)[^\n]{0,25}?(Band\s*|B)1\b/i, /LTE[^\n]{0,15}?2100\s*MHz/i],
    ctxPatterns: [/(?<![nN\w])(Band\s*|B)1\b/i]
  },
  {
    id: 'LTE_B40',
    group: '4G LTE',
    label: '4G LTE Band 40 (2300 MHz)',
    tech: 'LTE',
    range: [2300, 2400],
    patterns: [/(LTE|E-?UTRA)[^\n]{0,25}?(Band\s*|B)40\b/i, /LTE[^\n]{0,15}?2300\s*MHz/i],
    ctxPatterns: [/(?<![nN\w])(Band\s*|B)40\b/i]
  },
  {
    id: 'LTE_B41',
    group: '4G LTE',
    label: '4G LTE Band 41 (2500 MHz)',
    tech: 'LTE',
    range: [2496, 2690],
    patterns: [/(LTE|E-?UTRA)[^\n]{0,25}?(Band\s*|B)41\b/i, /LTE[^\n]{0,15}?2500\s*MHz/i],
    ctxPatterns: [/(?<![nN\w])(Band\s*|B)41\b/i]
  },

  // 13-19: 5G NR
  {
    id: 'NR_n28',
    group: '5G NR',
    label: '5G NR Band 28 (700 MHz)',
    tech: 'NR',
    range: [703, 748],
    patterns: [/(?<![\w.])n28\b/i, /(NR|5G)[^\n]{0,15}?Band\s*n?28\b/i, /(NR|5G)[^\n]{0,15}?700\s*MHz/i],
    ctxPatterns: [/Band\s*n?28\b/i]
  },
  {
    id: 'NR_n5',
    group: '5G NR',
    label: '5G NR Band 5 (850 MHz)',
    tech: 'NR',
    range: [824, 849],
    patterns: [/(?<![\w.])n5\b/i, /(NR|5G)[^\n]{0,15}?Band\s*n?5\b/i, /(NR|5G)[^\n]{0,15}?850\s*MHz/i],
    ctxPatterns: [/Band\s*n?5\b/i]
  },
  {
    id: 'NR_n8',
    group: '5G NR',
    label: '5G NR Band 8 (900 MHz)',
    tech: 'NR',
    range: [880, 915],
    patterns: [/(?<![\w.])n8\b/i, /(NR|5G)[^\n]{0,15}?Band\s*n?8\b/i, /(NR|5G)[^\n]{0,15}?900\s*MHz/i],
    ctxPatterns: [/Band\s*n?8\b/i]
  },
  {
    id: 'NR_n3',
    group: '5G NR',
    label: '5G NR Band 3 (1800 MHz)',
    tech: 'NR',
    range: [1710, 1785],
    patterns: [/(?<![\w.])n3\b/i, /(NR|5G)[^\n]{0,15}?Band\s*n?3\b/i, /(NR|5G)[^\n]{0,15}?1800\s*MHz/i],
    ctxPatterns: [/Band\s*n?3\b/i]
  },
  {
    id: 'NR_n1',
    group: '5G NR',
    label: '5G NR Band 1 (2100 MHz)',
    tech: 'NR',
    range: [1920, 1980],
    patterns: [/(?<![\w.])n1\b/i, /(NR|5G)[^\n]{0,15}?Band\s*n?1\b/i, /(NR|5G)[^\n]{0,15}?2100\s*MHz/i],
    ctxPatterns: [/Band\s*n?1\b/i]
  },
  {
    id: 'NR_n40',
    group: '5G NR',
    label: '5G NR Band 40 (2300 MHz)',
    tech: 'NR',
    range: [2300, 2400],
    patterns: [/(?<![\w.])n40\b/i, /(NR|5G)[^\n]{0,15}?Band\s*n?40\b/i, /(NR|5G)[^\n]{0,15}?2300\s*MHz/i],
    ctxPatterns: [/Band\s*n?40\b/i]
  },
  {
    id: 'NR_n41',
    group: '5G NR',
    label: '5G NR Band 41 (2500 MHz)',
    tech: 'NR',
    range: [2496, 2690],
    patterns: [/(?<![\w.])n41\b/i, /(NR|5G)[^\n]{0,15}?Band\s*n?41\b/i, /(NR|5G)[^\n]{0,15}?2500\s*MHz/i],
    ctxPatterns: [/Band\s*n?41\b/i]
  },

  // 20-24: WLAN / Wi-Fi
  {
    id: 'WLAN24',
    group: 'WLAN',
    label: 'WLAN 2.4 GHz',
    tech: 'WLAN',
    range: [2400, 2484],
    patterns: [/2\.4\s*G(Hz)?/i, /802\.11\s*b\/?g/i, /\b802\.11b\b/i, /WLAN\s*2\.4/i]
  },
  {
    id: 'WLAN51',
    group: 'WLAN',
    label: 'WLAN 5.1 GHz',
    tech: 'WLAN',
    range: [5150, 5250],
    patterns: [/5\.1\s*G(Hz)?/i, /51[5-9]\d|52[0-5]\d/i, /U-?NII-?1\b/i, /5\.2G\s*Band\s*1/i]
  },
  {
    id: 'WLAN52',
    group: 'WLAN',
    label: 'WLAN 5.2 GHz',
    tech: 'WLAN',
    range: [5250, 5350],
    patterns: [/5\.2\s*G(Hz)?/i, /52[5-9]\d|53[0-5]\d/i, /U-?NII-?2A?\b/i]
  },
  {
    id: 'WLAN58',
    group: 'WLAN',
    label: 'WLAN 5.8 GHz',
    tech: 'WLAN',
    range: [5725, 5850],
    patterns: [/5\.8\s*G(Hz)?/i, /57[2-9]\d|58[0-5]\d/i, /U-?NII-?3\b/i]
  },
  {
    id: 'WLAN6',
    group: 'WLAN',
    label: 'WLAN 6 GHz',
    tech: 'WLAN',
    range: [5925, 7125],
    patterns: [/(?<![\d.])6\s*G(Hz)?\b/i, /U-?NII-?[5-8]/i, /Wi-?Fi\s*6E\b/i, /802\.11ax\s*6G/i]
  },

  // 25: Bluetooth
  {
    id: 'BT',
    group: 'Bluetooth',
    label: 'Bluetooth',
    tech: 'BT',
    range: [2400, 2484],
    patterns: [/Bluetooth/i, /\bBDR\b|\bEDR\b|\bBR\/EDR\b/i, /\bBLE\b/i, /Bluetooth\s*LE/i]
  }
];

export const FEATURE_MAP = Object.fromEntries(FEATURES.map((f) => [f.id, f]));
export const GROUPS = [...new Set(FEATURES.map((f) => f.group))];

export function detectTech(line) {
  if (/\b(LTE|E-?UTRA)\b/i.test(line)) return 'LTE';
  if (/\b(5G\s*NR|NR|5G)\b/.test(line)) return 'NR';
  if (/\b(WCDMA|UMTS|HSPA|HSDPA|HSUPA)\b/i.test(line)) return 'WCDMA';
  if (/\b(GSM|GPRS|EDGE|DCS|PCS)\b/i.test(line)) return 'GSM';
  if (/\b(WLAN|Wi-?Fi|802\.11)/i.test(line)) return 'WLAN';
  if (/\b(Bluetooth|BLE|BDR|EDR)\b/i.test(line)) return 'BT';
  return null;
}

/** Fitur yang disebut pada sebuah baris (judul tabel), dengan konteks teknologi terakhir. */
export function detectFeatures(line, techCtx, candidates) {
  const hits = [];
  for (const f of candidates) {
    if (f.patterns.some((p) => p.test(line))) {
      hits.push(f.id);
      continue;
    }
    if (f.ctxPatterns && techCtx === f.tech && f.ctxPatterns.some((p) => p.test(line))) {
      hits.push(f.id);
    }
  }
  return hits;
}
