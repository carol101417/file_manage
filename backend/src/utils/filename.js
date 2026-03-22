const path = require('path');

function stripPathAndControls(filename) {
  const base = path.basename(String(filename || ''));
  // Remove NUL and other control chars that can confuse logs/headers.
  return base.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function latin1ToUtf8(str) {
  return Buffer.from(str, 'latin1').toString('utf8');
}

const CP1252_UNICODE_TO_BYTE = new Map([
  [0x20AC, 0x80],
  [0x201A, 0x82],
  [0x0192, 0x83],
  [0x201E, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02C6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8A],
  [0x2039, 0x8B],
  [0x0152, 0x8C],
  [0x017D, 0x8E],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201C, 0x93],
  [0x201D, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02DC, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9A],
  [0x203A, 0x9B],
  [0x0153, 0x9C],
  [0x017E, 0x9E],
  [0x0178, 0x9F]
]);

const CP1252_BYTE_TO_UNICODE = new Map(Array.from(CP1252_UNICODE_TO_BYTE.entries()).map(([u, b]) => [b, u]));

function bytesFromBinaryishString(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i);
    if (codePoint > 0xffff) i++;

    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const mapped = CP1252_UNICODE_TO_BYTE.get(codePoint);
    if (typeof mapped === 'number') {
      bytes.push(mapped);
      continue;
    }

    return null;
  }
  return Buffer.from(bytes);
}

function binaryishToUtf8(str) {
  const buf = bytesFromBinaryishString(str);
  if (!buf) return null;
  return buf.toString('utf8');
}

function hasCJK(str) {
  // CJK Unified Ideographs + common adjacent blocks for Japanese/Korean.
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(str);
}

function normalizeUploadedFilename(filename) {
  const cleaned = stripPathAndControls(filename);
  if (!cleaned) return 'file';

  // If it already contains CJK characters, do not attempt Latin-1 re-decoding.
  // (Re-encoding real Unicode as Latin-1 would corrupt it.)
  if (hasCJK(cleaned)) return cleaned;

  // Some clients might send percent-encoded filenames.
  if (/%[0-9A-Fa-f]{2}/.test(cleaned)) {
    try {
      const uriDecoded = decodeURIComponent(cleaned);
      if (uriDecoded && !uriDecoded.includes('�') && hasCJK(uriDecoded)) return uriDecoded;
    } catch {
      // ignore
    }
  }

  // Common multer/busboy behavior: treat header params as latin1, resulting in mojibake.
  // If decoding latin1->utf8 yields valid CJK text, prefer it.
  const binaryDecoded = binaryishToUtf8(cleaned) || latin1ToUtf8(cleaned);
  if (binaryDecoded && !binaryDecoded.includes('�') && hasCJK(binaryDecoded)) return binaryDecoded;

  return cleaned;
}

function safeExtname(filename) {
  const ext = path.extname(filename || '');
  // Keep a conservative subset: dot + up to 12 alnum chars.
  if (!ext) return '';
  if (!/^\.[A-Za-z0-9]{1,12}$/.test(ext)) return '';
  return ext;
}

function toLatin1MojibakeFromUtf8(utf8String) {
  return Buffer.from(String(utf8String || ''), 'utf8').toString('latin1');
}

function toCp1252MojibakeFromUtf8(utf8String) {
  const latin1 = toLatin1MojibakeFromUtf8(utf8String);
  let out = '';
  for (let i = 0; i < latin1.length; i++) {
    const code = latin1.charCodeAt(i);
    if (code >= 0x80 && code <= 0x9f && CP1252_BYTE_TO_UNICODE.has(code)) {
      out += String.fromCodePoint(CP1252_BYTE_TO_UNICODE.get(code));
    } else {
      out += latin1[i];
    }
  }
  return out;
}

module.exports = {
  normalizeUploadedFilename,
  safeExtname,
  toLatin1MojibakeFromUtf8,
  toCp1252MojibakeFromUtf8
};
