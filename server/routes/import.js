const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { get, run, all } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { generate: generateThumbnail, getDimensions, validate: validateImage } = require('../services/thumbnail');
const { resolveSteamId, getGameName, extractAppIdFromPath } = require('../services/steamApi');
const { resolveGameId } = require('../services/gameResolver');
const { SteamImportService } = require('../services/import/SteamImportService');
const { DebugLogger } = require('../services/debugLogger');

const router = express.Router();

// ── Multer setup ──────────────────────────────────────────

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Shared helper ─────────────────────────────────────────

/**
 * Resolve user-provided Steam input and save to user_config.
 */
async function resolveSteamInput(bodySteamId, userId) {
  let steamId = bodySteamId;
  if (!steamId) {
    const config = get('SELECT steam_id FROM user_config WHERE user_id = ?', [userId]);
    steamId = config?.steam_id;
  }
  if (!steamId) {
    throw new Error('请提供 Steam 个人资料链接或 64 位 Steam ID');
  }
  steamId = await resolveSteamId(steamId);
  run(
    `INSERT OR REPLACE INTO user_config (user_id, steam_id, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [userId, steamId]
  );
  return steamId;
}

// ──────────────────────────────────────────────────────────
//  POST /import/steam-api  —  start background import
// ──────────────────────────────────────────────────────────

router.post('/import/steam-api', authMiddleware, async (req, res) => {
  try {
    const steamId = await resolveSteamInput(req.body.steam_id, req.user.id);
    const userId = req.user.id;

    // Atomic claim via transaction
    if (!SteamImportService.claimSlot(userId, steamId)) {
      return res.json({ started: false, message: '已有导入任务正在进行中' });
    }

    res.json({ started: true });

    // Run in background — don't block the response
    const logger = new DebugLogger(steamId);
    const service = new SteamImportService(userId, steamId, logger);
    service.run().catch((err) => {
      console.error('Background import crashed:', err);
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Steam 导入失败' });
    }
  }
});

// ──────────────────────────────────────────────────────────
//  GET /import/progress  —  poll background import status
// ──────────────────────────────────────────────────────────

router.get('/import/progress', authMiddleware, (req, res) => {
  try {
    const state = SteamImportService.getProgress(req.user.id);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────
//  POST /import/cancel  —  cancel an active import
// ──────────────────────────────────────────────────────────

router.post('/import/cancel', authMiddleware, (req, res) => {
  const cancelled = SteamImportService.cancelImport(req.user.id);
  res.json({ cancelled });
});

// ──────────────────────────────────────────────────────────
//  DELETE /import/progress  —  dismiss completed import state
// ──────────────────────────────────────────────────────────

router.delete('/import/progress', authMiddleware, (req, res) => {
  SteamImportService.resetState(req.user.id);
  res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
//  POST /import/steam-retry-failed  —  retry failed items
// ──────────────────────────────────────────────────────────

router.post('/import/steam-retry-failed', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Resolve steam_id from pending items or user_config
    let steamId = req.body.steam_id;
    if (!steamId) {
      const row = get(
        `SELECT steam_id FROM steam_discovered_files WHERE user_id = ? AND status IN ('failed', 'discovered') LIMIT 1`,
        [userId]
      );
      steamId = row?.steam_id;
    }
    if (!steamId) {
      const config = get('SELECT steam_id FROM user_config WHERE user_id = ?', [userId]);
      steamId = config?.steam_id;
    }
    if (!steamId) {
      return res.status(400).json({ error: '未找到 Steam ID。请手动输入 Steam ID 后重试' });
    }
    steamId = await resolveSteamId(steamId);

    // Count pending items (failed + download_failed + discovered)
    const failedCount = get(
      "SELECT COUNT(*) as c FROM steam_discovered_files WHERE user_id = ? AND steam_id = ? AND status IN ('failed', 'download_failed')",
      [userId, steamId]
    );
    const discoveredCount = get(
      "SELECT COUNT(*) as c FROM steam_discovered_files WHERE user_id = ? AND steam_id = ? AND status = 'discovered'",
      [userId, steamId]
    );
    const pendingCount = (failedCount?.c || 0) + (discoveredCount?.c || 0);
    if (pendingCount === 0) {
      return res.json({ started: true, retried: 0, message: '没有需要重试的项' });
    }

    // Reset failed/download_failed → discovered
    if (failedCount && failedCount.c > 0) {
      run(
        `UPDATE steam_discovered_files SET status = 'discovered', error_msg = NULL WHERE user_id = ? AND steam_id = ? AND status IN ('failed', 'download_failed')`,
        [userId, steamId]
      );
    }

    // Atomic claim
    if (!SteamImportService.claimSlot(userId, steamId)) {
      return res.json({ started: false, message: '已有导入任务正在进行中' });
    }

    run(
      `UPDATE import_state SET total_discovered = ? WHERE user_id = ?`,
      [pendingCount, userId]
    );

    res.json({ started: true, retried: pendingCount });

    // Run in background
    const logger = new DebugLogger(steamId + '_retry');
    const service = new SteamImportService(userId, steamId, logger);
    service.run({ retry: true }).catch((err) => {
      console.error('Background retry crashed:', err);
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || '重试失败' });
    }
  }
});

// ──────────────────────────────────────────────────────────
//  POST /import/steam-image  —  single image from browser
// ──────────────────────────────────────────────────────────

router.post('/import/steam-image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, pubDate, appId, fileId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: '没有上传图片' });
    }

    const isValid = await validateImage(req.file.path);
    if (!isValid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '文件不是有效的图片格式' });
    }

    // Dedup by steam file_id
    if (fileId) {
      const existing = get('SELECT id FROM screenshots WHERE user_id = ? AND steam_file_id = ?', [userId, fileId]);
      if (existing) {
        fs.unlinkSync(req.file.path);
        return res.json({ skipped: true, id: existing.id });
      }
    }

    const gameId = await resolveGameId(userId, appId);

    let thumbPath = null;
    try {
      thumbPath = await generateThumbnail(req.file.path);
    } catch (e) { console.warn('缩略图生成失败:', e.message); }

    const dims = await getDimensions(req.file.path);
    const stat = fs.statSync(req.file.path);

    const r = run(
      `INSERT INTO screenshots (user_id, game_id, title, file_path, thumbnail_path, source, steam_file_id, width, height, file_size, taken_at)
       VALUES (?, ?, ?, ?, ?, 'steam_api', ?, ?, ?, ?, ?)`,
      [userId, gameId, title || req.file.originalname, req.file.filename, thumbPath, fileId || null, dims.width, dims.height, stat.size, pubDate || null]
    );

    // Record in steam_discovered_files so server-side import knows it's handled
    if (fileId) {
      const config = get('SELECT steam_id FROM user_config WHERE user_id = ?', [userId]);
      const savedSteamId = config?.steam_id;
      if (savedSteamId) {
        run(
          `INSERT OR IGNORE INTO steam_discovered_files (user_id, steam_id, file_id, app_id, status, image_url, title, downloaded)
           VALUES (?, ?, ?, ?, 'resolved', NULL, ?, 1)`,
          [userId, savedSteamId, fileId, appId || null, title || req.file.originalname]
        );
      }
    }

    res.json({ added: true, id: r.lastInsertRowid, gameId });
  } catch (err) {
    console.error('Steam image import error:', err);
    res.status(500).json({ error: err.message || '导入失败' });
  }
});

// ──────────────────────────────────────────────────────────
//  POST /import/folder  —  browser folder upload
// ──────────────────────────────────────────────────────────

router.post('/import/folder', authMiddleware, upload.array('files', 100), async (req, res) => {
  const { game_id, game_name, folder_path } = req.body;
  const userId = req.user.id;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: '没有上传任何文件' });
  }

  // Resolve game
  let gameId = game_id ? parseInt(game_id) : null;
  if (!gameId && game_name) {
    let steamAppId = null;
    if (folder_path) {
      steamAppId = extractAppIdFromPath(folder_path);
    }
    const existing = get('SELECT id FROM games WHERE user_id = ? AND name = ?', [userId, game_name]);
    if (existing) {
      gameId = existing.id;
    } else {
      const r = run('INSERT INTO games (user_id, steam_app_id, name) VALUES (?, ?, ?)', [userId, steamAppId, game_name]);
      gameId = r.lastInsertRowid;
    }
  }

  const results = [];
  for (const file of files) {
    const isValid = await validateImage(file.path);
    if (!isValid) {
      fs.unlinkSync(file.path);
      continue;
    }

    let thumbPath = null;
    try {
      thumbPath = await generateThumbnail(file.path);
    } catch (e) { console.warn('缩略图生成失败:', e.message); }

    const dims = await getDimensions(file.path);
    const stat = fs.statSync(file.path);

    const r = run(
      `INSERT INTO screenshots (user_id, game_id, title, file_path, thumbnail_path, source, width, height, file_size)
       VALUES (?, ?, ?, ?, ?, 'folder', ?, ?, ?)`,
      [userId, gameId, file.originalname, file.filename, thumbPath, dims.width, dims.height, stat.size]
    );
    results.push({ id: r.lastInsertRowid, filename: file.originalname, thumbnailPath: thumbPath });
  }

  // Try to infer steam_app_id from folder path
  if (folder_path && gameId) {
    const appId = extractAppIdFromPath(folder_path);
    if (appId) {
      run('UPDATE games SET steam_app_id = ? WHERE id = ? AND steam_app_id IS NULL', [appId, gameId]);
    }
  }

  res.json({ added: results.length, screenshots: results, game_id: gameId });
});

module.exports = { router, resolveGameId };
