const express = require('express');
const { get, run } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const row = get('SELECT steam_api_key, steam_id FROM user_config WHERE user_id = ?', [req.user.id]);
  res.json({ config: row || { steam_api_key: '', steam_id: '' } });
});

router.put('/', authMiddleware, (req, res) => {
  const { steam_api_key, steam_id } = req.body;
  run('UPDATE user_config SET steam_api_key = ?, steam_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [
    steam_api_key || '',
    steam_id || '',
    req.user.id,
  ]);
  res.json({ success: true });
});

module.exports = router;
