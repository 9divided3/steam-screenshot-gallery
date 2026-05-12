const express = require('express');
const { get, all, run } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { buildOrderBy, buildPlaceholders } = require('../utils/queryHelpers');

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

// POST /api/follows/:userId — follow a user
router.post('/:userId', (req, res) => {
  const targetId = parseInt(req.params.userId);
  const myId = req.user.id;

  if (targetId === myId) {
    return res.status(400).json({ error: '不能关注自己' });
  }

  const target = get('SELECT id FROM users WHERE id = ?', [targetId]);
  if (!target) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const existing = get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [myId, targetId]);
  if (existing) {
    return res.json({ success: true, following: true });
  }

  run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [myId, targetId]);
  res.status(201).json({ success: true, following: true });
});

// DELETE /api/follows/:userId — unfollow a user
router.delete('/:userId', (req, res) => {
  const targetId = parseInt(req.params.userId);
  const myId = req.user.id;

  const existing = get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [myId, targetId]);
  if (!existing) {
    return res.json({ success: true, following: false });
  }

  run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [myId, targetId]);
  res.json({ success: true, following: false });
});

// GET /api/follows/status/:userId — check if I'm following a user
router.get('/status/:userId', (req, res) => {
  const targetId = parseInt(req.params.userId);
  const myId = req.user.id;
  const follow = get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [myId, targetId]);
  res.json({ is_following: !!follow });
});

// GET /api/follows/following — users a user is following (default: me)
router.get('/following', (req, res) => {
  const userId = req.query.userId ? parseInt(req.query.userId) : req.user.id;
  const rows = all(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, f.created_at as followed_at
     FROM follows f
     JOIN users u ON f.following_id = u.id
     WHERE f.follower_id = ?
     ORDER BY f.created_at DESC`,
    [userId]
  );
  res.json({ users: rows });
});

// GET /api/follows/followers — users following a user (default: me)
router.get('/followers', (req, res) => {
  const userId = req.query.userId ? parseInt(req.query.userId) : req.user.id;
  const rows = all(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, f.created_at as followed_at
     FROM follows f
     JOIN users u ON f.follower_id = u.id
     WHERE f.following_id = ?
     ORDER BY f.created_at DESC`,
    [userId]
  );
  res.json({ users: rows });
});

// GET /api/follows/feed — screenshots from followed users
router.get('/feed', (req, res) => {
  const { page = 1, limit = 40, sort } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const followed = all('SELECT following_id FROM follows WHERE follower_id = ?', [req.user.id]);
  if (followed.length === 0) {
    return res.json({ screenshots: [], total: 0, page: 1, limit: parseInt(limit) });
  }

  const ids = followed.map((f) => f.following_id);
  const placeholders = buildPlaceholders(ids);

  const orderBy = buildOrderBy(sort);

  const rows = all(
    `SELECT s.*, g.name as game_name, g.steam_app_id, u.username, u.display_name
     FROM screenshots s
     LEFT JOIN games g ON s.game_id = g.id
     LEFT JOIN users u ON s.user_id = u.id
     WHERE s.is_public = 1 AND s.user_id IN (${placeholders})
     ${orderBy}
     LIMIT ? OFFSET ?`,
    [...ids, parseInt(limit), offset]
  );

  const countRow = get(
    `SELECT COUNT(*) as total FROM screenshots WHERE is_public = 1 AND user_id IN (${placeholders})`,
    ids
  );

  res.json({
    screenshots: rows,
    total: countRow?.total || 0,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

module.exports = router;
