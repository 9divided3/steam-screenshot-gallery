const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }

  const devKeyPath = path.join(__dirname, '..', 'data', '.jwt_secret');
  try {
    return fs.readFileSync(devKeyPath, 'utf-8').trim();
  } catch {
    const secret = crypto.randomBytes(64).toString('hex');
    const dir = path.dirname(devKeyPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(devKeyPath, secret);
    console.log('[auth] 已生成开发环境 JWT 密钥');
    return secret;
  }
}

const JWT_SECRET = loadJwtSecret();

const BEARER_PREFIX = 'Bearer ';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = header.slice(BEARER_PREFIX.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// Optional auth - sets req.user if token present, but doesn't reject
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith(BEARER_PREFIX)) {
    try {
      req.user = jwt.verify(header.slice(BEARER_PREFIX.length), JWT_SECRET);
    } catch { /* ignore invalid token */ }
  } else if (req.query.token && typeof req.query.token === 'string') {
    try {
      req.user = jwt.verify(req.query.token, JWT_SECRET);
    } catch { /* ignore invalid token */ }
  }
  next();
}

module.exports = { authMiddleware, optionalAuth, JWT_SECRET };
