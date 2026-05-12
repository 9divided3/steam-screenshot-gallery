/**
 * Phase 2: For each 'discovered' row, fetch the shared-file detail page
 * to extract the og:image URL. Updates steam_discovered_files with image_url/title.
 *
 * Processes sequentially with spacing to avoid Steam 429 rate limiting.
 */
const { proxyFetch } = require('../proxyFetch');
const { run, all } = require('../../db/database');
const { withRetry } = require('./retry');

const REQUEST_SPACING_MS = 300;
const DOWNLOAD_TRIGGER_EVERY = 40;
const BATCH_PAUSE_MS = 180000;

/**
 * Fetch detail page for a single fileId and extract og:image.
 * Returns { ok, imageUrl, title, appId, fileId } or { ok: false }.
 */
async function _fetchOne(fileId, listingAppId, logger) {
  const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${fileId}`;

  const { ok, result: response, attempts } = await withRetry(
    () => proxyFetch(url, { timeout: 30000 }),
    {
      maxRetries: 2,
      baseDelayMs: 5000,
      retryOnStatus: [429, 403, 503],
      onRetry: (a, cause, delay) => {
        if (logger) logger.event('resolve', 'rate_limited', { fileId, status: cause, attempt: a, delayMs: delay });
        if (!logger) console.log(`[Steam] Rate limited on ${fileId} (${cause}), retry ${a}/3 in ${delay}ms`);
      },
    }
  );

  if (!ok || !response || !response.ok) {
    const status = response ? response.status : 'error';
    if (logger) logger.event('resolve', 'detail_failed', { fileId, status, attempts });
    const reason = response && response.status === 429 ? 'rate_limited'
      : response && response.status === 404 ? 'not_found'
      : 'network_error';
    return { ok: false, attempts, reason };
  }

  const html = await response.text();

  // Extract og:image — the canonical full-res CDN URL
  const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
  if (!ogMatch) {
    if (logger) logger.event('resolve', 'no_og_image', { fileId, attempts });
    return { ok: false, attempts, reason: 'no_og_image' };
  }

  let imageUrl = ogMatch[1]
    .replace('steamuserimages-a.akamaihd.net', 'images.steamusercontent.com')
    .replace('steamuserimages-b.akamaihd.net', 'images.steamusercontent.com');

  if (!imageUrl.includes('?')) {
    imageUrl += '?imw=5000&ima=fit';
  }

  // Extract appId: prefer detail page, fall back to listing page
  let appId = null;
  const appMatch = html.match(/steam\/apps\/(\d+)\//);
  if (appMatch) {
    appId = parseInt(appMatch[1]);
  } else {
    appId = listingAppId;
  }

  // Extract title from <title> tag
  let title = '';
  const titleMatch = html.match(/<title>[^<]+::\s*(.+?)<\/title>/);
  if (titleMatch) {
    const raw = titleMatch[1].trim();
    if (raw && raw !== 'Screenshot') title = raw;
  }
  if (!title) title = `Screenshot ${fileId}`;

  if (logger) logger.event('resolve', 'detail_ok', { fileId, title, appId, attempts });

  return { ok: true, imageUrl, title, appId, fileId, attempts };
}

/**
 * @param {number} userId
 * @param {string} steamId
 * @param {import('../debugLogger').DebugLogger} logger
 * @param {function(): Promise<void>} [onBatchResolved] — called periodically for progressive download
 * @returns {Promise<{ resolved: number, failed: number }>}
 */
async function resolvePhase(userId, steamId, logger = null, onBatchResolved = null, isAborted = null) {
  const phase = 'resolve';
  if (logger) logger.startPhase(phase, { userId, steamId });

  const pending = all(
    `SELECT * FROM steam_discovered_files
     WHERE user_id = ? AND steam_id = ? AND status = 'discovered'
     ORDER BY id`,
    [userId, steamId]
  );

  if (pending.length === 0) {
    if (logger) { logger.info(phase, 'No pending files to resolve'); logger.endPhase(phase, { resolved: 0, failed: 0 }); }
    return { resolved: 0, failed: 0 };
  }

  if (logger) logger.info(phase, `${pending.length} pending fileIds to resolve`);

  let resolved = 0;
  let failed = 0;
  let resolvedSinceDownload = 0;

  for (let i = 0; i < pending.length; i++) {
    if (isAborted && isAborted()) return { resolved, failed };
    const row = pending[i];
    const detail = await _fetchOne(row.file_id, row.app_id, logger);

    if (detail && detail.ok) {
      run(
        `UPDATE steam_discovered_files
         SET status = 'resolved', image_url = ?, title = ?, app_id = COALESCE(app_id, ?),
             error_msg = NULL, retries = retries + ?, updated_at = datetime('now')
         WHERE id = ?`,
        [detail.imageUrl, detail.title, detail.appId, detail.attempts || 1, row.id]
      );
      resolved++;
      resolvedSinceDownload++;
    } else {
      const attempts = (detail && detail.attempts) ? detail.attempts : 1;
      let errMsg;
      const reason = detail ? detail.reason : 'unknown';
      if (reason === 'rate_limited') errMsg = 'Rate limited after retries';
      else if (reason === 'not_found') errMsg = 'Screenshot deleted or made private';
      else if (reason === 'no_og_image') errMsg = 'No og:image found on detail page';
      else errMsg = 'Failed to resolve image URL after retries';
      run(
        `UPDATE steam_discovered_files
         SET status = 'failed', error_msg = ?,
             retries = retries + ?, updated_at = datetime('now')
         WHERE id = ?`,
        [errMsg, attempts, row.id]
      );
      failed++;
    }

    if (logger) {
      logger.event(phase, 'batch_done', {
        progress: `${i + 1}/${pending.length}`,
        totalResolved: resolved,
        totalFailed: failed,
      });
    }

    // Trigger download after resolving a full batch, then pause 3 min
    if (resolvedSinceDownload >= DOWNLOAD_TRIGGER_EVERY && onBatchResolved) {
      try { await onBatchResolved(); } catch (e) { /* don't stop resolve on download error */ }
      resolvedSinceDownload = 0;
      if (logger) logger.info(phase, `Batch complete, waiting 3 minutes before next batch...`);
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }

    // Space out requests to avoid triggering Steam 429 rate limit
    if (i < pending.length - 1) {
      await new Promise((r) => setTimeout(r, REQUEST_SPACING_MS));
    }
  }

  // Final download trigger for remaining resolved items
  if (resolvedSinceDownload > 0 && onBatchResolved) {
    try { await onBatchResolved(); } catch (e) { /* don't stop resolve on download error */ }
  }

  const result = { resolved, failed };
  if (logger) logger.endPhase(phase, result);
  return result;
}

module.exports = { resolvePhase };
