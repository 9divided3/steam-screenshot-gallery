const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { get, all, run } = require('../db/database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { buildPlaceholders } = require('../utils/queryHelpers');

const router = express.Router();

function getUserStats(userId) {
  const screenshotCount = get(
    'SELECT COUNT(*) AS count FROM screenshots WHERE user_id = ?',
    [userId]
  )?.count ?? 0;

  const gameCount = get(
    'SELECT COUNT(*) AS count FROM games WHERE user_id = ?',
    [userId]
  )?.count ?? 0;

  const publicCount = get(
    'SELECT COUNT(*) AS count FROM screenshots WHERE user_id = ? AND is_public = 1',
    [userId]
  )?.count ?? 0;

  const totalSize = get(
    'SELECT COALESCE(SUM(file_size), 0) AS total FROM screenshots WHERE user_id = ?',
    [userId]
  )?.total ?? 0;

  const followingCount = get('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?', [userId])?.count ?? 0;
  const followersCount = get('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?', [userId])?.count ?? 0;

  return {
    screenshots: screenshotCount,
    games: gameCount,
    public: publicCount,
    storageBytes: totalSize,
    followers_count: followersCount,
    following_count: followingCount,
  };
}

// Avatar upload setup
const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: avatarsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `avatar_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// GET /api/profile — fetch current user's profile
router.get('/', authMiddleware, (req, res) => {
  const user = get(
    'SELECT id, username, display_name, bio, avatar_url, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const { followers_count, following_count, ...stats } = getUserStats(req.user.id);

  res.json({
    profile: {
      ...user,
      followers_count,
      following_count,
      stats,
    },
  });
});

// GET /api/profile/showcase/:userId? — get showcased screenshots for a user
router.get('/showcase/:userId?', optionalAuth, (req, res) => {
  const userId = req.params.userId ? parseInt(req.params.userId) : (req.user?.id);
  if (!userId) return res.status(401).json({ error: '请登录' });

  const rows = all(
    `SELECT s.id, s.file_path, s.thumbnail_path, s.title, s.width, s.height, g.name as game_name
     FROM screenshots s
     LEFT JOIN games g ON s.game_id = g.id
     WHERE s.user_id = ? AND s.showcased = 1
     ORDER BY s.id DESC
     LIMIT 6`,
    [userId]
  );
  res.json({ screenshots: rows });
});

// PUT /api/profile/showcase — set showcased screenshots (own only)
router.put('/showcase', authMiddleware, (req, res) => {
  const { ids } = req.body;
  const userId = req.user.id;

  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }
  if (ids.length > 6) {
    return res.status(400).json({ error: '最多展示 6 张图片' });
  }

  // Clear all existing showcased for this user
  run('UPDATE screenshots SET showcased = 0 WHERE user_id = ?', [userId]);

  // Set new showcased screenshots
  if (ids.length > 0) {
    const placeholders = buildPlaceholders(ids);
    run(
      `UPDATE screenshots SET showcased = 1 WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...ids]
    );
  }

  const rows = all(
    `SELECT s.id, s.file_path, s.thumbnail_path, s.title, s.width, s.height, g.name as game_name
     FROM screenshots s
     LEFT JOIN games g ON s.game_id = g.id
     WHERE s.user_id = ? AND s.showcased = 1
     ORDER BY s.id DESC`,
    [userId]
  );
  res.json({ screenshots: rows });
});

// GET /api/profile/:userId — view another user's public profile
router.get('/:userId', optionalAuth, (req, res) => {
  const targetId = parseInt(req.params.userId);
  const myId = req.user?.id;

  const user = get(
    'SELECT id, username, display_name, bio, avatar_url, created_at FROM users WHERE id = ?',
    [targetId]
  );
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const { followers_count, following_count, ...stats } = getUserStats(targetId);

  let isFollowing = false;
  if (myId && myId !== targetId) {
    const follow = get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [myId, targetId]);
    isFollowing = !!follow;
  }

  res.json({
    profile: {
      ...user,
      followers_count,
      following_count,
      is_following: isFollowing,
      stats,
    },
  });
});

// PUT /api/profile — update profile fields + optional avatar
router.put('/', authMiddleware, upload.single('avatar'), (req, res) => {
  const { display_name, bio } = req.body;
  const userId = req.user.id;

  if (display_name !== undefined) {
    if (display_name.length > 50) {
      return res.status(400).json({ error: '显示名称不能超过50个字符' });
    }
    run('UPDATE users SET display_name = ? WHERE id = ?', [display_name.trim(), userId]);
  }

  if (bio !== undefined) {
    if (bio.length > 500) {
      return res.status(400).json({ error: '个人简介不能超过500个字符' });
    }
    run('UPDATE users SET bio = ? WHERE id = ?', [bio.trim(), userId]);
  }

  // Handle avatar upload
  if (req.file) {
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete old avatar file if it exists
    const user = get('SELECT avatar_url FROM users WHERE id = ?', [userId]);
    if (user?.avatar_url) {
      const oldPath = path.join(__dirname, '..', user.avatar_url);
      try {
        fs.unlinkSync(oldPath);
      } catch { /* file doesn't exist, ignore */ }
    }

    run('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
  }

  // Return updated profile
  const updated = get(
    'SELECT id, username, display_name, bio, avatar_url, created_at FROM users WHERE id = ?',
    [userId]
  );

  res.json({ profile: updated });
});

module.exports = router;
