/**
 * 校验密码复杂度
 * 要求至少 8 个字符，包含至少一个小写字母、一个大写字母和一个数字
 * @param {string} password - 待校验的密码
 * @returns {string|null} 校验失败时返回错误消息，通过时返回 null
 */
function validatePasswordComplexity(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

/**
 * 获取客户端真实 IP 地址
 * @param {import('express').Request} req - Express 请求对象
 * @returns {string} 客户端 IP 地址，无法获取时返回 'unknown'
 */
function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

module.exports = { validatePasswordComplexity, getClientIp };
