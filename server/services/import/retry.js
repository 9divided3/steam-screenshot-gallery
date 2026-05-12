/**
 * Unified retry utility with exponential backoff.
 *
 * Supports:
 *   - Automatic retry on thrown errors
 *   - Automatic retry on HTTP status codes (when fn returns { ok: false, status })
 *   - Custom shouldRetry predicate
 *   - Progress callback (onRetry) for logging
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retry an async operation with exponential backoff.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=2]         — total attempts = maxRetries + 1
 * @param {number} [opts.baseDelayMs=3000]     — first delay, doubles each retry
 * @param {number[]} [opts.retryOnStatus]       — HTTP status codes that trigger retry
 * @param {function(number, string, number):void} [opts.onRetry] — (attempt, cause, delayMs) => void
 * @param {function(number, Error):boolean} [opts.shouldRetry]   — return false to stop retrying
 * @returns {Promise<{ ok: boolean, result?: T, attempts: number, error?: Error }>}
 */
async function withRetry(fn, opts = {}) {
  const {
    maxRetries = 2,
    baseDelayMs = 3000,
    retryOnStatus = [],
    onRetry = null,
    shouldRetry = null,
  } = opts;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Check if result signals a retryable HTTP status
      if (
        result &&
        result.ok === false &&
        result.status != null &&
        retryOnStatus.includes(result.status) &&
        attempt < maxRetries
      ) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        const cause = `HTTP ${result.status}`;
        if (onRetry) onRetry(attempt + 1, cause, delay);
        await sleep(delay);
        lastError = new Error(`HTTP ${result.status}`);
        continue;
      }

      return { ok: true, result, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        if (shouldRetry && !shouldRetry(attempt, err)) {
          return { ok: false, attempts: attempt + 1, error: err };
        }
        const delay = baseDelayMs * Math.pow(2, attempt);
        if (onRetry) onRetry(attempt + 1, err.message, delay);
        await sleep(delay);
      }
    }
  }

  return { ok: false, attempts: maxRetries + 1, error: lastError };
}

module.exports = { withRetry, sleep };
