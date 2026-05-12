const ORDER_MAP = {
  // "Sort by name" uses game name as primary sort because the screenshot title
  // (s.title) is often identical across many rows ("Screenshot"), which would
  // produce arbitrary ordering. s.title acts as a tiebreaker within the same game.
  name_asc: 'ORDER BY g.name COLLATE NOCASE ASC, s.title COLLATE NOCASE ASC',
  name_desc: 'ORDER BY g.name COLLATE NOCASE DESC, s.title COLLATE NOCASE DESC',
  date_asc: 'ORDER BY s.created_at ASC',
  date_desc: 'ORDER BY s.created_at DESC',
  popular: 'ORDER BY likes_count DESC, s.created_at DESC',
};

/**
 * Builds a safe ORDER BY clause from a whitelist of allowed sort keys.
 *
 * @param {string} sort - One of: 'name_asc', 'name_desc', 'date_asc', 'date_desc'
 * @returns {string} A hardcoded ORDER BY clause. Unrecognized input falls back
 *   to 'ORDER BY s.created_at DESC'. This function MUST NEVER interpolate user
 *   input into the returned string — callers must interpolate the result via
 *   template literal, which is safe because all return values are hardcoded.
 */
function buildOrderBy(sort) {
  const clause = ORDER_MAP[sort] || 'ORDER BY s.created_at DESC';
  if (process.env.DEBUG_SORT) {
    console.log('[queryHelpers] sort:', JSON.stringify(sort), '->', clause);
  }
  return clause;
}

/**
 * Builds a SQL placeholders string like '?, ?, ?' from an array.
 * @param {any[]} array
 * @returns {string}
 */
function buildPlaceholders(array) {
  return array.map(() => '?').join(',');
}

module.exports = { buildOrderBy, buildPlaceholders };
