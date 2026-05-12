/**
 * SteamImportService — orchestrates the 3-phase Steam screenshot import pipeline.
 *
 * Usage:
 *   const svc = new SteamImportService(userId, steamId, logger);
 *   await svc.run();                 // full pipeline (discover → resolve → download)
 *   await svc.run({ retry: true });  // skip discover, retry failed
 *
 * Static helpers for route handlers:
 *   SteamImportService.claimSlot(userId, steamId)  — atomic transaction check
 *   SteamImportService.getProgress(userId)           — poll progress
 *   SteamImportService.resetState(userId)            — clear import state
 */
const { run, get, all } = require('../../db/database');
const { discoverPhase } = require('./discoverPhase');
const { resolvePhase } = require('./resolvePhase');
const { downloadPhase } = require('./downloadPhase');

const ABORTED_SIGNAL = Symbol('ABORTED');
const STALE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

class SteamImportService {
  /** @type {Map<number, SteamImportService>} */
  static _activeServices = new Map();

  /**
   * @param {number} userId
   * @param {string} steamId  — resolved 64-bit Steam ID
   * @param {import('../debugLogger').DebugLogger} logger
   */
  constructor(userId, steamId, logger = null) {
    this.userId = userId;
    this.steamId = steamId;
    this.logger = logger;
    this._totalDiscovered = 0;
    this._aborted = false;
  }

  // ──────────────────────────────────────────
  //  Public entry point
  // ──────────────────────────────────────────

  /**
   * Run the full pipeline. Idempotent — each phase queries by status.
   * @param {{ retry?: boolean }} [options]
   */
  async run(options = {}) {
    const { retry = false } = options;

    // Register as the active service for this user
    SteamImportService._activeServices.set(this.userId, this);

    try {
      // Phase 1: Discover (skip on retry)
      if (!retry) {
        this._transition('discover', { total_discovered: 0 });
        const { discovered } = await discoverPhase(this.steamId, this.userId, this.logger, () => this._aborted);
        this._checkAborted();
        this._totalDiscovered = discovered;
      } else {
        // On retry, use the total from remaining pending items
        const pending = all(
          `SELECT COUNT(*) as c FROM steam_discovered_files
           WHERE user_id = ? AND steam_id = ? AND status IN ('discovered', 'failed')`,
          [this.userId, this.steamId]
        );
        this._totalDiscovered = pending[0]?.c || 0;
      }

      // Phase 2+3: Resolve + progressive download
      // Downloads each batch immediately after its URLs are resolved,
      // instead of waiting for ALL items to finish resolving.
      let downloadedTotal = 0;
      let firstBatch = true;

      this._transition('resolve', { total_discovered: this._totalDiscovered });

      const { resolved, failed } = await resolvePhase(
        this.userId,
        this.steamId,
        this.logger,
        // Called after each batch: download newly resolved items immediately
        async () => {
          if (this._aborted) return;
          if (firstBatch) {
            this._transition('download', { total_discovered: this._totalDiscovered });
            firstBatch = false;
          }
          const r = await downloadPhase(this.userId, this.steamId, this.logger, () => this._aborted);
          downloadedTotal += r.added;
        },
        () => this._aborted
      );

      this._checkAborted();

      // Final download pass for any remaining resolved items
      if (firstBatch) {
        this._transition('download', { total_discovered: this._totalDiscovered });
      }
      const finalDl = await downloadPhase(this.userId, this.steamId, this.logger, () => this._aborted);
      downloadedTotal += finalDl.added;

      // Done
      this._transition('done', {
        total_discovered: this._totalDiscovered,
        total_resolved: resolved,
        total_failed: failed,
        total_downloaded: downloadedTotal,
      });

      if (this.logger) {
        this.logger.finalMessage(`── Import complete: ${downloadedTotal} added, ${failed} failed ──`);
      }

      return { resolved, failed, downloaded: downloadedTotal };
    } catch (err) {
      if (err === ABORTED_SIGNAL) {
        this._transition('idle', { error_msg: null });
        if (this.logger) this.logger.finalMessage('── Import cancelled by user ──');
        return { resolved: 0, failed: 0, downloaded: 0, aborted: true };
      }
      this._transition('error', { error_msg: err.message });
      if (this.logger) this.logger.error('import', err, { phase: this._currentPhase });
      throw err;
    } finally {
      SteamImportService._activeServices.delete(this.userId);
    }
  }

  /** Throw ABORTED_SIGNAL if aborted */
  _checkAborted() {
    if (this._aborted) throw ABORTED_SIGNAL;
  }

  // ──────────────────────────────────────────
  //  State helpers
  // ──────────────────────────────────────────

  /**
   * Update import_state table and track the current phase in memory.
   * When entering 'resolve' phase, snapshots the current resolved/downloaded
   * counts as baselines so live_* counters reflect only this session's progress.
   */
  _transition(phase, fields = {}) {
    this._currentPhase = phase;

    let resolveBaseline = fields.resolve_baseline ?? 0;
    let downloadBaseline = fields.download_baseline ?? 0;
    let failedBaseline = fields.failed_baseline ?? 0;
    let downloadFailedBaseline = fields.download_failed_baseline ?? 0;

    // Snapshot baselines when entering resolve phase so live_* counters
    // show only the progress made during this session, not all-time totals.
    if (phase === 'resolve' && !fields.resolve_baseline) {
      const counts = get(
        `SELECT
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN downloaded = 1 THEN 1 ELSE 0 END) as downloaded,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'download_failed' THEN 1 ELSE 0 END) as download_failed
         FROM steam_discovered_files WHERE user_id = ? AND steam_id = ?`,
        [this.userId, this.steamId]
      );
      resolveBaseline = counts?.resolved || 0;
      downloadBaseline = counts?.downloaded || 0;
      failedBaseline = counts?.failed || 0;
      downloadFailedBaseline = counts?.download_failed || 0;
    } else if (phase !== 'resolve') {
      // Preserve existing baselines when switching to download/done/error
      // so INSERT OR REPLACE doesn't zero out the snapshots taken above.
      const cur = get(
        'SELECT resolve_baseline, download_baseline, failed_baseline, download_failed_baseline FROM import_state WHERE user_id = ?',
        [this.userId]
      );
      if (cur) {
        resolveBaseline = fields.resolve_baseline ?? cur.resolve_baseline ?? 0;
        downloadBaseline = fields.download_baseline ?? cur.download_baseline ?? 0;
        failedBaseline = fields.failed_baseline ?? cur.failed_baseline ?? 0;
        downloadFailedBaseline = fields.download_failed_baseline ?? cur.download_failed_baseline ?? 0;
      }
    }

    run(`INSERT OR REPLACE INTO import_state (user_id, steam_id, phase, total_discovered, total_resolved, total_failed, total_downloaded, resolve_baseline, download_baseline, failed_baseline, download_failed_baseline, error_msg, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        this.userId, this.steamId, phase,
        fields.total_discovered ?? 0,
        fields.total_resolved ?? 0,
        fields.total_failed ?? 0,
        fields.total_downloaded ?? 0,
        resolveBaseline,
        downloadBaseline,
        failedBaseline,
        downloadFailedBaseline,
        fields.error_msg ?? null,
      ]
    );
  }

  // ──────────────────────────────────────────
  //  Static helpers
  // ──────────────────────────────────────────

  /**
   * Check and claim the import slot for a user.
   * Safe without a transaction because Node.js is single-threaded
   * and there is no await between the check and the insert.
   * @returns {boolean} true if the slot was claimed
   */
  static claimSlot(userId, steamId) {
    const existing = get('SELECT phase FROM import_state WHERE user_id = ?', [userId]);
    if (existing && existing.phase !== 'idle' && existing.phase !== 'done' && existing.phase !== 'error') {
      return false;
    }
    run(
      `INSERT OR REPLACE INTO import_state (user_id, steam_id, phase, total_discovered, total_resolved, total_failed, total_downloaded, resolve_baseline, download_baseline, failed_baseline, download_failed_baseline, error_msg, started_at, updated_at)
       VALUES (?, ?, 'discover', 0, 0, 0, 0, 0, 0, 0, 0, NULL, datetime('now'), datetime('now'))`,
      [userId, steamId]
    );
    return true;
  }

  /**
   * Get current import state for the progress polling endpoint.
   * Returns phase + live counters computed from DB (no baselines needed).
   * @returns {object} ImportState for JSON response
   */
  static getProgress(userId) {
    const state = get('SELECT * FROM import_state WHERE user_id = ?', [userId]);

    if (!state) {
      return { phase: 'idle', ..._staleCounts(userId) };
    }

    // Auto-recover from server restart: if a non-terminal import is stale (>2 hours),
    // transition to error so the frontend stops polling and user can retry.
    const STALE_MS = STALE_TIMEOUT_MS;
    if (
      state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error' &&
      state.started_at
    ) {
      const age = Date.now() - new Date(state.started_at + 'Z').getTime();
      if (age > STALE_MS) {
        run(
          `UPDATE import_state SET phase = 'error', error_msg = '导入任务超时（服务器可能已重启），请重新开始', updated_at = datetime('now') WHERE user_id = ?`,
          [userId]
        );
        state.phase = 'error';
        state.error_msg = '导入任务超时（服务器可能已重启），请重新开始';
        state.stale_failed = _staleCounts(userId).stale_failed;
        state.stale_pending = _staleCounts(userId).stale_pending;
        return state;
      }
    }

    // Enrich with live counts. live_resolved and live_downloaded are
    // deltas from the baselines stored when entering the resolve phase,
    // so the frontend sees per-session progress, not all-time totals.
    if (state.phase !== 'idle' && state.phase !== 'error') {
      const counts = get(
        `SELECT
          SUM(CASE WHEN status = 'discovered' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'download_failed' THEN 1 ELSE 0 END) as download_failed,
          SUM(CASE WHEN downloaded = 1 THEN 1 ELSE 0 END) as downloaded
         FROM steam_discovered_files WHERE user_id = ? AND steam_id = ?`,
        [userId, state.steam_id]
      );
      if (counts) {
        state.live_pending = counts.pending || 0;
        state.live_resolved = Math.max(0, (counts.resolved || 0) - (state.resolve_baseline || 0));
        state.live_failed = Math.max(0, (counts.failed || 0) - (state.failed_baseline || 0));
        state.live_download_failed = Math.max(0, (counts.download_failed || 0) - (state.download_failed_baseline || 0));
        state.live_downloaded = Math.max(0, (counts.downloaded || 0) - (state.download_baseline || 0));
      }
    }

    // Always include stale counts
    const stale = _staleCounts(userId);
    state.stale_failed = stale.stale_failed;
    state.stale_pending = stale.stale_pending;
    state.resolve_baseline = 0;
    state.download_baseline = 0;
    state.failed_baseline = 0;
    state.download_failed_baseline = 0;

    return state;
  }

  /**
   * Reset import state to idle. Called when user dismisses the completion card.
   */
  static resetState(userId) {
    run('DELETE FROM import_state WHERE user_id = ?', [userId]);
  }

  /**
   * Cancel an active import for the given user.
   * Sets the abort flag on the running service instance and updates import_state.
   * @returns {boolean} true if an active import was found and cancelled
   */
  static cancelImport(userId) {
    const svc = SteamImportService._activeServices.get(userId);
    if (!svc) return false;
    svc._aborted = true;
    return true;
  }
}

/**
 * Query stale (failed/discovered) counts for retry UI.
 */
function _staleCounts(userId) {
  const failedCount = get(
    "SELECT COUNT(*) as c FROM steam_discovered_files WHERE user_id = ? AND status IN ('failed', 'download_failed')",
    [userId]
  );
  const pendingCount = get(
    "SELECT COUNT(*) as c FROM steam_discovered_files WHERE user_id = ? AND status = 'discovered'",
    [userId]
  );
  return { stale_failed: failedCount?.c || 0, stale_pending: pendingCount?.c || 0 };
}

module.exports = { SteamImportService };
