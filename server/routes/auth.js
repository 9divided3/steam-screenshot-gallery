const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../db/database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function generateAuthResponse(user) {
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  return {
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name },
  };
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 30) {
    return res.status(400).json({ error: '用户名长度需在 2-30 个字符之间' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少 6 位' });
  }

  const existing = get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(409).json({ error: '用户名已被注册' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
  const userId = result.lastInsertRowid;

  run('INSERT INTO user_config (user_id) VALUES (?)', [userId]);

  const newUser = get('SELECT id, username, display_name FROM users WHERE id = ?', [userId]);
  res.status(201).json(generateAuthResponse(newUser));
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = get('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  res.json(generateAuthResponse(user));
});

router.get('/me', authMiddleware, (req, res) => {
  const user = get('SELECT id, username, display_name FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: user || req.user });
});

module.exports = router;
