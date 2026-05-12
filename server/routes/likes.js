const express = require('express');
const { get, all, run } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/likes/top — top liked public screenshots (no auth required for public view)
router.get('/top', (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const rows = all(
    `SELECT s.*, g.name as game_name, g.steam_app_id, u.username, u.display_name,
            (SELECT COUNT(*) FROM likes l WHERE l.screenshot_id = s.id) as likes_count
     FROM screenshots s
     LEFT JOIN games g ON s.game_id = g.id
     LEFT JOIN users u ON s.user_id = u.id
     WHERE s.is_public = 1
     ORDER BY likes_count DESC, s.created_at DESC
     LIMIT ?`,
    [limit]
  );
  res.json({ screenshots: rows });
});

// GET /api/likes/status/:screenshotId — check if current user liked this screenshot
router.get('/status/:id', authMiddleware, (req, res) => {
  const row = get(
    'SELECT id FROM likes WHERE user_id = ? AND screenshot_id = ?',
    [req.user.id, parseInt(req.params.id)]
  );
  res.json({ liked: !!row });
});

// GET /api/likes/mylikes — get all screenshot IDs the current user has liked
router.get('/mylikes', authMiddleware, (req, res) => {
  const rows = all('SELECT screenshot_id FROM likes WHERE user_id = ?', [req.user.id]);
  res.json({ likedIds: rows.map((r) => r.screenshot_id) });
});

// POST /api/likes/:id — like a screenshot
router.post('/:id', authMiddleware, (req, res) => {
  const screenshotId = parseInt(req.params.id);
  const screenshot = get('SELECT id FROM screenshots WHERE id = ? AND is_public = 1', [screenshotId]);
  if (!screenshot) {
    return res.status(404).json({ error: '截图不存在或未公开' });
  }
  const result = run(
    'INSERT OR IGNORE INTO likes (user_id, screenshot_id) VALUES (?, ?)',
    [req.user.id, screenshotId]
  );
  const count = get('SELECT COUNT(*) as count FROM likes WHERE screenshot_id = ?', [screenshotId]);
  res.json({ liked: true, likes_count: count.count, already_liked: result.changes === 0 });
});

// DELETE /api/likes/:id — unlike a screenshot
router.delete('/:id', authMiddleware, (req, res) => {
  const screenshotId = parseInt(req.params.id);
  run('DELETE FROM likes WHERE user_id = ? AND screenshot_id = ?', [req.user.id, screenshotId]);
  const count = get('SELECT COUNT(*) as count FROM likes WHERE screenshot_id = ?', [screenshotId]);
  res.json({ liked: false, likes_count: count.count });
});

module.exports = router;
