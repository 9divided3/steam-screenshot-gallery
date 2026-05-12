const express = require('express');
const { get, all } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/games — user's games with screenshot count
router.get('/', authMiddleware, (req, res) => {
  const rows = all(
    `SELECT g.*, COUNT(s.id) as screenshot_count
     FROM games g
     LEFT JOIN screenshots s ON s.game_id = g.id
     WHERE g.user_id = ?
     GROUP BY g.id
     ORDER BY g.name`,
    [req.user.id]
  );
  res.json({ games: rows });
});

// GET /api/games/search
router.get('/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = all('SELECT * FROM games WHERE user_id = ? AND name LIKE ? ORDER BY name LIMIT 10', [
      req.user.id,
      `%${q}%`,
    ]);
  } else {
    rows = all('SELECT * FROM games WHERE user_id = ? ORDER BY name LIMIT 50', [req.user.id]);
  }
  res.json({ games: rows });
});

// GET /api/games/:id
router.get('/:id', authMiddleware, (req, res) => {
  const row = get(
    `SELECT g.*, COUNT(s.id) as screenshot_count
     FROM games g
     LEFT JOIN screenshots s ON s.game_id = g.id
     WHERE g.id = ? AND g.user_id = ?
     GROUP BY g.id`,
    [parseInt(req.params.id), req.user.id]
  );
  if (!row) return res.status(404).json({ error: '游戏不存在' });
  res.json({ game: row });
});

module.exports = router;
