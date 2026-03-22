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

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

module.exports = { validatePasswordComplexity, getClientIp };
