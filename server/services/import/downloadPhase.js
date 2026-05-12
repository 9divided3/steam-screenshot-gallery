/**
 * Phase 3: Download resolved images via proxy, generate thumbnails,
 * insert into screenshots table. Marks downloaded=1 on success or
 * status='download_failed' on permanent failure.
 *
 * Concurrency: 40 parallel downloads.
 */
const path = require('path');
const fs = require('fs');
const { proxyFetch } = require('../proxyFetch');
const { generate: generateThumbnail, getDimensions } = require('../thumbnail');
const { run, get, all } = require('../../db/database');
const { withRetry } = require('./retry');
const { resolveGameId } = require('../gameResolver');

const CONCURRENCY = 1; // download one by one

/**
 * @param {number} userId
 * @param {string} steamId
 * @param {import('../debugLogger').DebugLogger} logger
 * @returns {Promise<{ added: number, skipped: number, failed: number }>}
 */
async function downloadPhase(userId, steamId, logger = null, isAborted = null) {
  const phase = 'download';
  if (logger) logger.startPhase(phase, { userId, steamId });

  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

  // Find resolved-but-not-downloaded items
  const pending = all(
    `SELECT * FROM steam_discovered_files
     WHERE user_id = ? AND steam_id = ? AND status = 'resolved' AND downloaded = 0
     ORDER BY id`,
    [userId, steamId]
  );

  if (pending.length === 0) {
    if (logger) { logger.info(phase, 'No items to download'); logger.endPhase(phase, { added: 0, skipped: 0, failed: 0 }); }
    return { added: 0, skipped: 0, failed: 0 };
  }

  if (logger) logger.info(phase, `${pending.length} items to download`);

  // Dedup against screenshots table
  const toDownload = [];
  let skipped = 0;
  for (const row of pending) {
    if (row.file_id) {
      const existing = get(
        'SELECT id FROM screenshots WHERE user_id = ? AND steam_file_id = ?',
        [userId, row.file_id]
      );
      if (existing) {
        // Already downloaded — mark it
        run('UPDATE steam_discovered_files SET downloaded = 1 WHERE id = ?', [row.id]);
        skipped++;
        continue;
      }
    }
    toDownload.push({
      id: row.id,
      fileId: row.file_id,
      title: row.title || `Screenshot ${row.file_id}`,
      imageUrl: row.image_url,
      appId: row.app_id,
    });
  }
  if (logger) logger.event(phase, 'dedup_done', { candidates: pending.length, toDownload: toDownload.length, skipped });

  if (toDownload.length === 0) {
    if (logger) logger.endPhase(phase, { added: 0, skipped, failed: 0 });
    return { added: 0, skipped, failed: 0 };
  }

  // Pre-resolve game IDs in parallel
  const appIds = new Set();
  for (const item of toDownload) {
    if (item.appId) appIds.add(parseInt(item.appId));
  }
  const gameIdMap = new Map();
  await Promise.all(
    Array.from(appIds).map(async (appId) => {
      const gameId = await resolveGameId(userId, appId);
      gameIdMap.set(appId, gameId);
    })
  );

  if (logger) logger.info(phase, `Downloading ${toDownload.length} images (${appIds.size} unique games, concurrency ${CONCURRENCY})...`);

  // Download in parallel batches
  let added = 0;
  let failed = 0;

  for (let i = 0; i < toDownload.length; i += CONCURRENCY) {
    if (isAborted && isAborted()) return { added, skipped, failed };
    const batch = toDownload.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((item) => _downloadOne(item, userId, gameIdMap, uploadsDir, logger))
    );

    for (let j = 0; j < batchResults.length; j++) {
      if (batchResults[j].ok) {
        added++;
      } else {
        failed++;
        // Mark as permanently failed so it won't be retried on next import
        const item = batch[j];
        run(
          `UPDATE steam_discovered_files
           SET status = 'download_failed', error_msg = 'Image download exhausted retries',
               retries = retries + 1, updated_at = datetime('now')
           WHERE id = ?`,
          [item.id]
        );
      }
    }

    const done = Math.min(i + CONCURRENCY, toDownload.length);
    if (logger) {
      logger.event(phase, 'download_batch', { progress: `${done}/${toDownload.length}`, added, failed });
    }
  }

  const result = { added, skipped, failed };
  if (logger) logger.endPhase(phase, result);
  return result;
}

/**
 * Download a single image and insert into the database.
 * Returns { ok: true, id } on success, { ok: false } on failure.
 */
async function _downloadOne(item, userId, gameIdMap, uploadsDir, logger) {
  const phase = 'download';
  const fileId = item.fileId;

  const { ok, result: imgRes } = await withRetry(
    () => proxyFetch(item.imageUrl, { timeout: 60000 }),
    {
      maxRetries: 2,
      baseDelayMs: 3000,
      onRetry: (a, cause, delay) => {
        if (logger) logger.event(phase, 'download_retry', { fileId, attempt: a, cause, delayMs: delay });
        if (!logger) console.log(`[Steam] Image download retry ${a}/3 for ${fileId}: ${cause}`);
      },
    }
  );

  if (!ok || !imgRes || !imgRes.ok) {
    if (logger) logger.event(phase, 'download_failed', { fileId, attempts: imgRes ? 0 : 3 });
    return { ok: false };
  }

  try {
    const ab = await imgRes.arrayBuffer();
    const buffer = Buffer.from(ab);
    const localFilename = `steam_${fileId}_${Math.random().toString(36).slice(2, 6)}.jpg`;
    const uploadPath = path.join(uploadsDir, localFilename);
    fs.writeFileSync(uploadPath, buffer);

    let thumbPath = null;
    try {
      thumbPath = await generateThumbnail(uploadPath);
    } catch (e) {
      if (logger) logger.event(phase, 'thumb_failed', { fileId, error: e.message });
    }

    const dims = await getDimensions(uploadPath);
    const fileStat = fs.statSync(uploadPath);
    const gameId = item.appId ? gameIdMap.get(parseInt(item.appId)) : null;

    const r = run(
      `INSERT INTO screenshots (user_id, game_id, title, file_path, thumbnail_path, source, steam_file_id, is_public, file_size, width, height)
       VALUES (?, ?, ?, ?, ?, 'steam_api', ?, 0, ?, ?, ?)`,
      [userId, gameId, item.title, localFilename, thumbPath, fileId, fileStat.size, dims.width, dims.height]
    );

    // Mark as downloaded
    run('UPDATE steam_discovered_files SET downloaded = 1 WHERE id = ?', [item.id]);

    if (logger) {
      logger.event(phase, 'image_ok', {
        fileId, title: item.title,
        size: fileStat.size, width: dims.width, height: dims.height,
        screenshotId: r.lastInsertRowid,
      });
    }

    return { ok: true, id: r.lastInsertRowid };
  } catch (err) {
    if (logger) logger.event(phase, 'image_error', { fileId, error: err.message });
    return { ok: false };
  }
}

module.exports = { downloadPhase };
