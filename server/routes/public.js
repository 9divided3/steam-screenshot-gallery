const express = require('express');
const { get, all } = require('../db/database');
const { buildOrderBy } = require('../utils/queryHelpers');

const router = express.Router();

// GET /api/public/screenshots
router.get('/screenshots', (req, res) => {
  const { game_id, page = 1, limit = 40, user_id, search, user_search, sort } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE s.is_public = 1';
  const params = [];

  if (game_id) {
    where += ' AND s.game_id = ?';
    params.push(parseInt(game_id));
  }
  if (user_id) {
    where += ' AND s.user_id = ?';
    params.push(parseInt(user_id));
  }
  if (search) {
    where += ' AND (s.title LIKE ? OR g.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (user_search) {
    const matchingUsers = all(
      'SELECT id FROM users WHERE username LIKE ? OR display_name LIKE ?',
      [`%${user_search}%`, `%${user_search}%`]
    );
    if (matchingUsers.length === 0) {
      return res.json({ screenshots: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
    }
    const userIds = matchingUsers.map((u) => u.id);
    where += ` AND s.user_id IN (${userIds.map(() => '?').join(',')})`;
    params.push(...userIds);
  }

  const orderBy = buildOrderBy(sort);

  const likesSubquery = '(SELECT COUNT(*) FROM likes l WHERE l.screenshot_id = s.id) as likes_count';

  const rows = all(
    `SELECT s.*, g.name as game_name, g.steam_app_id, u.username, u.display_name, ${likesSubquery}
     FROM screenshots s
     LEFT JOIN games g ON s.game_id = g.id
     LEFT JOIN users u ON s.user_id = u.id
     ${where}
     ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const countRow = get(
    `SELECT COUNT(*) as total FROM screenshots s LEFT JOIN games g ON s.game_id = g.id ${where}`,
    params
  );

  res.json({
    screenshots: rows,
    total: countRow?.total || 0,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// GET /api/public/games
router.get('/games', (_req, res) => {
  const rows = all(
    `SELECT g.id, g.name, g.steam_app_id, COUNT(s.id) as screenshot_count
     FROM games g
     JOIN screenshots s ON s.game_id = g.id AND s.is_public = 1
     GROUP BY g.id
     ORDER BY screenshot_count DESC
     LIMIT 50`
  );
  res.json({ games: rows });
});

module.exports = router;
