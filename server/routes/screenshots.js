const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { get, run, all } = require('../db/database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { buildOrderBy, buildPlaceholders } = require('../utils/queryHelpers');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
const thumbsDir = path.join(__dirname, '..', 'thumbnails');

function deleteUploadedFiles(row) {
  let deleted = 0;
  [row.file_path, row.thumbnail_path].forEach((relPath) => {
    if (!relPath) return;
    const dir = relPath === row.thumbnail_path ? thumbsDir : uploadsDir;
    const absPath = path.join(dir, path.basename(relPath));
    try {
      if (fs.existsSync(absPath)) { fs.unlinkSync(absPath); deleted++; }
    } catch (e) {
      console.warn(`[Cleanup] 删除文件失败 ${absPath}:`, e.message);
    }
  });
  return deleted;
}

// ──────────────────────────────────────────────────────────
//  GET /  —  list user's screenshots
// ──────────────────────────────────────────────────────────

router.get('/', authMiddleware, (req, res) => {
  const { game_id, page = 1, limit = 40, search, public: publicFilter, sort, ids_only } = req.query;
  const userId = req.user.id;

  let where = 'WHERE s.user_id = ?';
  const params = [userId];

  if (game_id) {
    where += ' AND s.game_id = ?';
    params.push(parseInt(game_id));
  }
  if (publicFilter === '1') {
    where += ' AND s.is_public = 1';
  } else if (publicFilter === '0') {
    where += ' AND s.is_public = 0';
  }
  if (search) {
    where += ' AND (s.title LIKE ? OR g.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const countRow = get(
    `SELECT COUNT(*) as total FROM screenshots s LEFT JOIN games g ON s.game_id = g.id ${where}`,
    params
  );
  const total = countRow ? countRow.total : 0;

  if (ids_only) {
    const idRows = all(
      `SELECT s.id FROM screenshots s LEFT JOIN games g ON s.game_id = g.id ${where}`,
      params
    );
    return res.json({ ids: idRows.map((r) => r.id), total });
  }

  const orderBy = buildOrderBy(sort);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const rows = all(
    `SELECT s.*, g.name as game_name, g.steam_app_id
     FROM screenshots s
     LEFT JOIN games g ON s.game_id = g.id
     ${where}
     ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  res.json({ screenshots: rows, total, page: parseInt(page), limit: parseInt(limit) });
});

// ──────────────────────────────────────────────────────────
//  GET /:id  —  get single screenshot
// ──────────────────────────────────────────────────────────

router.get('/:id', authMiddleware, (req, res) => {
  const row = get(
    `SELECT s.*, g.name as game_name, g.steam_app_id
     FROM screenshots s
     LEFT JOIN games g ON s.game_id = g.id
     WHERE s.id = ? AND s.user_id = ?`,
    [parseInt(req.params.id), req.user.id]
  );
  if (!row) return res.status(404).json({ error: '截图不存在' });
  res.json({ screenshot: row });
});

// ──────────────────────────────────────────────────────────
//  DELETE /user-all  —  delete all screenshots for user
// ──────────────────────────────────────────────────────────

router.delete('/user-all', authMiddleware, (req, res) => {
  const userId = req.user.id;

  const rows = all('SELECT file_path, thumbnail_path FROM screenshots WHERE user_id = ?', [userId]);
  let deletedFiles = 0;
  for (const row of rows) {
    deletedFiles += deleteUploadedFiles(row);
  }

  run('DELETE FROM steam_discovered_files WHERE user_id = ?', [userId]);
  run('DELETE FROM screenshots WHERE user_id = ?', [userId]);
  run('DELETE FROM games WHERE id NOT IN (SELECT DISTINCT game_id FROM screenshots WHERE game_id IS NOT NULL)');

  res.json({ success: true, deleted: rows.length, deletedFiles });
});

// ──────────────────────────────────────────────────────────
//  DELETE /batch  —  batch delete screenshots
// ──────────────────────────────────────────────────────────

router.delete('/batch', authMiddleware, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请提供截图 ID 列表' });
  }
  const userId = req.user.id;

  const placeholders = buildPlaceholders(ids);
  const rows = all(
    `SELECT file_path, thumbnail_path FROM screenshots WHERE id IN (${placeholders}) AND user_id = ?`,
    [...ids, userId]
  );

  let deletedFiles = 0;
  for (const row of rows) {
    deletedFiles += deleteUploadedFiles(row);
  }

  run(
    `DELETE FROM steam_discovered_files
     WHERE user_id = ? AND file_id IN (SELECT steam_file_id FROM screenshots WHERE id IN (${placeholders}) AND user_id = ?)`,
    [userId, ...ids, userId]
  );
  run(`DELETE FROM screenshots WHERE id IN (${placeholders}) AND user_id = ?`, [...ids, userId]);
  run('DELETE FROM games WHERE id NOT IN (SELECT DISTINCT game_id FROM screenshots WHERE game_id IS NOT NULL)');

  res.json({ success: true, deleted: rows.length, deletedFiles });
});

// ──────────────────────────────────────────────────────────
//  DELETE /:id  —  delete single screenshot
// ──────────────────────────────────────────────────────────

router.delete('/:id', authMiddleware, (req, res) => {
  const row = get(
    'SELECT file_path, thumbnail_path, steam_file_id FROM screenshots WHERE id = ? AND user_id = ?',
    [parseInt(req.params.id), req.user.id]
  );
  if (!row) return res.status(404).json({ error: '截图不存在' });

  deleteUploadedFiles(row);

  run('DELETE FROM screenshots WHERE id = ? AND user_id = ?', [parseInt(req.params.id), req.user.id]);
  run('DELETE FROM steam_discovered_files WHERE user_id = ? AND file_id = ?', [req.user.id, row.steam_file_id]);
  run('DELETE FROM games WHERE id NOT IN (SELECT DISTINCT game_id FROM screenshots WHERE game_id IS NOT NULL)');

  res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
//  PUT /:id/public  —  toggle public
// ──────────────────────────────────────────────────────────

router.put('/:id/public', authMiddleware, (req, res) => {
  const { is_public } = req.body;
  const row = get('SELECT id FROM screenshots WHERE id = ? AND user_id = ?', [
    parseInt(req.params.id), req.user.id,
  ]);
  if (!row) return res.status(404).json({ error: '截图不存在' });

  run('UPDATE screenshots SET is_public = ? WHERE id = ?', [is_public ? 1 : 0, parseInt(req.params.id)]);
  res.json({ success: true, is_public: is_public ? 1 : 0 });
});

// ──────────────────────────────────────────────────────────
//  PUT /batch-public  —  batch toggle public
// ──────────────────────────────────────────────────────────

router.put('/batch-public', authMiddleware, (req, res) => {
  const { ids, is_public } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请提供截图 ID 列表' });
  }
  const userId = req.user.id;
  const placeholders = buildPlaceholders(ids);
  run(`UPDATE screenshots SET is_public = ? WHERE id IN (${placeholders}) AND user_id = ?`, [
    is_public ? 1 : 0, ...ids, userId,
  ]);
  res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
//  PUT /batch-game  —  batch assign game
// ──────────────────────────────────────────────────────────

router.put('/batch-game', authMiddleware, (req, res) => {
  const { ids, game_id } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !game_id) {
    return res.status(400).json({ error: '请提供截图 ID 列表和游戏 ID' });
  }
  const userId = req.user.id;
  const placeholders = buildPlaceholders(ids);
  run(`UPDATE screenshots SET game_id = ? WHERE id IN (${placeholders}) AND user_id = ?`, [
    game_id, ...ids, userId,
  ]);
  res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
//  POST /batch-download  —  batch download as ZIP
// ──────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  if (!name) return 'untitled';
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
}

function getAccessibleScreenshot(req, res) {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: '无效的截图 ID' });
    return null;
  }

  const row = get('SELECT id, user_id, file_path, thumbnail_path, is_public FROM screenshots WHERE id = ?', [id]);
  if (!row) {
    res.status(404).json({ error: '截图不存在' });
    return null;
  }
  if (!row.is_public && row.user_id !== req.user?.id) {
    res.status(403).json({ error: '无权访问该截图' });
    return null;
  }
  return row;
}

router.get('/:id/file', optionalAuth, (req, res) => {
  const row = getAccessibleScreenshot(req, res);
  if (!row) return;

  const absPath = path.join(uploadsDir, path.basename(row.file_path));
  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: '截图文件不存在' });
  }
  res.sendFile(absPath);
});

router.get('/:id/thumbnail', optionalAuth, (req, res) => {
  const row = getAccessibleScreenshot(req, res);
  if (!row) return;

  const relPath = row.thumbnail_path || row.file_path;
  const dir = row.thumbnail_path ? thumbsDir : uploadsDir;
  const absPath = path.join(dir, path.basename(relPath));
  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: '缩略图文件不存在' });
  }
  res.sendFile(absPath);
});

router.post('/batch-download', authMiddleware, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请提供截图 ID 列表' });
  }
  const userId = req.user.id;
  const placeholders = buildPlaceholders(ids);

  const rows = all(
    `SELECT s.file_path, s.title, g.name as game_name
     FROM screenshots s
     LEFT JOIN games g ON s.game_id = g.id
     WHERE s.id IN (${placeholders}) AND s.user_id = ?`,
    [...ids, userId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: '未找到可下载的截图' });
  }
  if (rows.length < ids.length) {
    return res.status(403).json({ error: '部分截图不属于您' });
  }

  const files = [];
  const usedNames = new Set();
  for (const row of rows) {
    const absPath = path.join(uploadsDir, path.basename(row.file_path));
    if (!fs.existsSync(absPath)) continue;

    const game = sanitizeFilename(row.game_name);
    const title = sanitizeFilename(row.title);
    const ext = path.extname(row.file_path) || '.jpg';
    const baseName = game ? `${game} - ${title}` : title;
    let entryName = `${baseName}${ext}`;
    if (usedNames.has(entryName)) {
      for (let i = 2; ; i++) {
        entryName = `${baseName} (${i})${ext}`;
        if (!usedNames.has(entryName)) break;
      }
    }
    usedNames.add(entryName);
    files.push({ absPath, entryName });
  }

  if (files.length === 0) {
    return res.status(404).json({ error: '未找到可下载的截图文件' });
  }

  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace(/:/g, '-');
  const zipName = `screenshots-${ts}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.on('error', (err) => {
    console.error('[BatchDownload] archive error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: '压缩失败' });
  });

  archive.pipe(res);
  for (const file of files) {
    archive.file(file.absPath, { name: file.entryName });
  }
  archive.finalize();
});

module.exports = router;
