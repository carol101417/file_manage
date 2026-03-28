const path = require('path');

/**
 * 去除文件名中的路径部分和控制字符
 * @param {string} filename - 原始文件名
 * @returns {string} 清理后的文件名
 */
function stripPathAndControls(filename) {
  const base = path.basename(String(filename || ''));
  // Remove NUL and other control chars that can confuse logs/headers.
  return base.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

/**
 * 将 Latin1 编码的字符串重新解释为 UTF-8 编码
 * @param {string} str - Latin1 编码的字符串
 * @returns {string} 以 UTF-8 解码后的字符串
 */
function latin1ToUtf8(str) {
  return Buffer.from(str, 'latin1').toString('utf8');
}

/**
 * CP1252 编码中 Unicode 码点到字节值的映射表
 * 用于处理 0x80-0x9F 范围内 CP1252 特有的字符
 * @type {Map<number, number>}
 */
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

/**
 * CP1252 编码中字节值到 Unicode 码点的反向映射表
 * @type {Map<number, number>}
 */
const CP1252_BYTE_TO_UNICODE = new Map(Array.from(CP1252_UNICODE_TO_BYTE.entries()).map(([u, b]) => [b, u]));

/**
 * 将类二进制字符串（每个字符的码点 <= 0xFF 或属于 CP1252 特殊字符）转换为字节 Buffer
 * @param {string} str - 类二进制字符串
 * @returns {Buffer|null} 转换后的 Buffer，如果字符串中包含无法映射的字符则返回 null
 */
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

/**
 * 尝试将类二进制字符串解码为 UTF-8 字符串
 * @param {string} str - 类二进制字符串
 * @returns {string|null} 解码后的 UTF-8 字符串，失败时返回 null
 */
function binaryishToUtf8(str) {
  const buf = bytesFromBinaryishString(str);
  if (!buf) return null;
  return buf.toString('utf8');
}

/**
 * 检测字符串中是否包含 CJK（中日韩）字符
 * @param {string} str - 待检测字符串
 * @returns {boolean} 是否包含 CJK 字符
 */
function hasCJK(str) {
  // CJK Unified Ideographs + common adjacent blocks for Japanese/Korean.
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(str);
}

/**
 * 规范化上传的文件名
 * 处理 multer/busboy 中 Latin1 乱码、百分号编码等常见文件名编码问题，
 * 尝试将乱码文件名恢复为正确的 UTF-8 中文文件名
 * @param {string} filename - 原始文件名（可能是乱码）
 * @returns {string} 修正后的文件名
 */
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

/**
 * 安全地提取文件扩展名
 * 仅允许由点号加 1-12 个字母数字组成的扩展名
 * @param {string} filename - 文件名
 * @returns {string} 安全的文件扩展名，不符合格式则返回空字符串
 */
function safeExtname(filename) {
  const ext = path.extname(filename || '');
  // Keep a conservative subset: dot + up to 12 alnum chars.
  if (!ext) return '';
  if (!/^\.[A-Za-z0-9]{1,12}$/.test(ext)) return '';
  return ext;
}

/**
 * 将 UTF-8 字符串转换为 Latin1 乱码形式
 * 用于在数据库中搜索可能以 Latin1 乱码存储的文件名
 * @param {string} utf8String - UTF-8 编码的字符串
 * @returns {string} Latin1 乱码形式的字符串
 */
function toLatin1MojibakeFromUtf8(utf8String) {
  return Buffer.from(String(utf8String || ''), 'utf8').toString('latin1');
}

/**
 * 将 UTF-8 字符串转换为 CP1252 乱码形式
 * 在 Latin1 乱码基础上，将 0x80-0x9F 范围的字节替换为对应的 CP1252 Unicode 字符
 * @param {string} utf8String - UTF-8 编码的字符串
 * @returns {string} CP1252 乱码形式的字符串
 */
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
