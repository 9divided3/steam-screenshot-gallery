/**
 * Phase 1: Scrape Steam Community profile screenshot listing pages
 * to discover fileIds + appIds.
 *
 * Stores results into steam_discovered_files (INSERT OR IGNORE for idempotency).
 */
const { proxyFetch } = require('../proxyFetch');
const { run } = require('../../db/database');
const { withRetry } = require('./retry');

/**
 * Extract fileIds and optional appIds from a listing-page HTML string.
 * Uses data-publishedfileid / data-appid attributes on <a> tags.
 */
function extractListingItems(html) {
  const items = [];
  const regex = /<a\s[^>]*data-publishedfileid="(\d+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const fileId = match[1];
    const appIdMatch = match[0].match(/data-appid="(\d+)"/i);
    const appId = appIdMatch ? parseInt(appIdMatch[1]) : null;
    items.push({ fileId, appId });
  }
  return items;
}

function extractTotalCount(html) {
  const profileDataMatch = html.match(/g_rgProfileData\s*=\s*(\{.+?\});/s);
  if (profileDataMatch) {
    try {
      const data = JSON.parse(profileDataMatch[1]);
      if (data.total_count != null) return parseInt(data.total_count);
    } catch { /* fall through */ }
  }
  const headerMatch = html.match(/Screenshots\s*\((\d+)\)/i);
  if (headerMatch) return parseInt(headerMatch[1]);
  return null;
}

/**
 * @param {string} steamId — 64-bit Steam ID
 * @param {number} userId
 * @param {import('../debugLogger').DebugLogger} logger
 * @returns {Promise<{ discovered: number, new: number }>}
 */
async function discoverPhase(steamId, userId, logger = null, isAborted = null) {
  const phase = 'discover';
  if (logger) logger.startPhase(phase, { steamId, userId });
  else console.log('[Steam] discoverPhase started');

  const baseUrl = `https://steamcommunity.com/profiles/${steamId}/screenshots/`;

  // ---- Fetch first listing page ----

  if (logger) logger.info(phase, 'Fetching first listing page...');

  const firstResult = await withRetry(
    () => proxyFetch(baseUrl, { timeout: 30000 }),
    { maxRetries: 2, baseDelayMs: 2000 }
  );

  if (!firstResult.ok) {
    const err = firstResult.error || new Error('Unknown error');
    if (logger) logger.error(phase, err, { url: baseUrl });
    const hint = err.message.includes('TLS')
      ? 'TLS 证书验证失败，请确认 hosts 加速已配置'
      : err.message.includes('timed out') || err.message.includes('Timeout')
        ? '连接 Steam Community 超时，请检查网络或稍后重试'
        : err.message.includes('connect') || err.message.includes('ECONNREFUSED')
          ? '无法连接 Steam Community，请确认 hosts 加速已配置'
          : '请确认 hosts 加速已配置';
    throw new Error(`无法访问 Steam Community（${err.message}），${hint}`);
  }

  const firstResponse = firstResult.result;

  if (!firstResponse.ok) {
    if (logger) logger.event(phase, 'first_page_error', { status: firstResponse.status });
    if (firstResponse.status === 302 || firstResponse.status === 301) {
      throw new Error('Steam 个人资料未公开，请设置为公开');
    }
    throw new Error(`Steam Community returned ${firstResponse.status} — 请确认 Steam 个人资料截图权限为「公开」`);
  }

  const firstHtml = await firstResponse.text();
  if (logger) logger.event(phase, 'first_page_ok', { bytes: firstHtml.length });

  const listingItems = extractListingItems(firstHtml);
  if (listingItems.length === 0) {
    if (logger) { logger.info(phase, 'No screenshots found'); logger.endPhase(phase, { discovered: 0, new: 0 }); }
    return { discovered: 0, new: 0 };
  }

  const totalCount = extractTotalCount(firstHtml);
  if (totalCount != null) {
    if (logger) logger.info(phase, `Total screenshots reported by Steam: ${totalCount}`);
    run(
      `UPDATE import_state SET total_discovered = ?, updated_at = datetime('now') WHERE user_id = ?`,
      [totalCount, userId]
    );
  }

  // ---- Reset previously-failed items before discovery ----
  const resetResult = run(
    `UPDATE steam_discovered_files
     SET status = 'discovered', error_msg = NULL
     WHERE user_id = ? AND steam_id = ? AND status IN ('failed', 'download_failed')`,
    [userId, steamId]
  );
  if (resetResult.changes > 0 && logger) {
    logger.event(phase, 'reset_failed', { count: resetResult.changes });
  }

  // Helper: insert items immediately with dedup so getProgress sees incremental counts
  const seen = new Set();
  let newCount = 0;
  function insertItems(items) {
    for (const item of items) {
      if (!seen.has(item.fileId)) {
        seen.add(item.fileId);
        const result = run(
          `INSERT OR IGNORE INTO steam_discovered_files (user_id, steam_id, file_id, app_id)
           VALUES (?, ?, ?, ?)`,
          [userId, steamId, item.fileId, item.appId]
        );
        if (result.changes > 0) newCount++;
      }
    }
  }

  // Insert first-page items right away
  insertItems(listingItems);

  // ---- Paginate remaining pages ----

  const PAGE_BATCH = 3;
  let page = 2;
  let consecutiveEmpty = 0;

  while (consecutiveEmpty < 3 && page <= 200) {
    const batchSize = Math.min(PAGE_BATCH, 200 - page + 1);
    const urls = [];
    for (let i = 0; i < batchSize; i++) {
      urls.push({ page: page + i, url: `${baseUrl}?appid=0&browsefilter=mostrecent&p=${page + i}` });
    }

    const pages = await Promise.all(
      urls.map(async ({ page: p, url }) => {
        const { ok, result: res } = await withRetry(
          () => proxyFetch(url, { timeout: 30000 }),
          {
            maxRetries: 2,
            baseDelayMs: 2000,
            onRetry: (a, cause, delay) => {
              if (logger) logger.event(phase, 'page_retry', { page: p, attempt: a, cause, delayMs: delay });
              if (!logger) console.log(`[Steam] Page ${p} error: ${cause}, retry ${a}/3`);
            },
          }
        );
        if (ok && res && res.ok) return { page: p, html: await res.text() };
        if (!logger) console.log(`[Steam] Page ${p} failed after 3 attempts`);
        return { page: p, html: '' };
      })
    );

    for (const { page: pageNum, html } of pages) {
      if (isAborted && isAborted()) return { discovered: 0, new: 0 };
      const pageItems = extractListingItems(html);

      if (pageItems.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 3) break;
      } else {
        consecutiveEmpty = 0;
        insertItems(pageItems);
      }
    }
    page += batchSize;
  }

  const result = { discovered: seen.size, new: newCount };
  if (logger) {
    logger.endPhase(phase, { discovered: seen.size, new: newCount, alreadyKnown: seen.size - newCount });
  }
  return result;
}

module.exports = { discoverPhase, extractListingItems, extractTotalCount };
