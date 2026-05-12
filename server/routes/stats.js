const express = require('express');
const { get } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats — user's stats (requires auth)
router.get('/stats', authMiddleware, (req, res) => {
  const userId = req.user.id;

  const row = get(
    `SELECT
      (SELECT COUNT(*) FROM screenshots WHERE user_id = ?) as totalScreenshots,
      (SELECT COUNT(*) FROM games WHERE user_id = ?) as totalGames,
      (SELECT COUNT(*) FROM screenshots WHERE user_id = ? AND is_public = 1) as publicCount,
      (SELECT created_at FROM screenshots WHERE user_id = ? ORDER BY created_at DESC LIMIT 1) as latestImport`,
    [userId, userId, userId, userId]
  );

  res.json({
    totalScreenshots: row?.totalScreenshots || 0,
    totalGames: row?.totalGames || 0,
    publicCount: row?.publicCount || 0,
    latestImport: row?.latestImport || null,
  });
});

// GET /api/public/stats — platform stats (no auth)
router.get('/public/stats', (req, res) => {
  const row = get(
    `SELECT
      COUNT(*) as totalScreenshots,
      COUNT(DISTINCT user_id) as totalUsers,
      COUNT(DISTINCT game_id) as totalGames
    FROM screenshots
    WHERE is_public = 1`
  );

  res.json({
    totalScreenshots: row?.totalScreenshots || 0,
    totalUsers: row?.totalUsers || 0,
    totalGames: row?.totalGames || 0,
  });
});

module.exports = router;
