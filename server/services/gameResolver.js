/**
 * Shared game resolution helper — used by both import routes and download phase.
 */
const { get, run } = require('../db/database');
const { getGameName } = require('./steamApi');

/**
 * Resolve or create a game ID for a Steam appId.
 * @param {number} userId
 * @param {number|null} appId
 * @returns {Promise<number|null>}
 */
async function resolveGameId(userId, appId) {
  if (!appId) return null;
  const game = get('SELECT id, name FROM games WHERE user_id = ? AND steam_app_id = ?', [userId, parseInt(appId)]);

  if (game) {
    // Fix placeholder names from old buggy code
    if (game.name && game.name.startsWith('App ')) {
      const realName = await getGameName(parseInt(appId));
      run('UPDATE games SET name = ? WHERE id = ?', [realName, game.id]);
    }
    return game.id;
  }

  // Fetch real game name from Steam Store API, then INSERT OR IGNORE
  // to safely handle concurrent imports resolving the same appId.
  const gameName = await getGameName(parseInt(appId));
  const r = run('INSERT OR IGNORE INTO games (user_id, steam_app_id, name) VALUES (?, ?, ?)', [
    userId, parseInt(appId), gameName,
  ]);
  if (r.lastInsertRowid) return r.lastInsertRowid;

  // Another concurrent call inserted first — re-query
  const existing = get('SELECT id FROM games WHERE user_id = ? AND steam_app_id = ?', [userId, parseInt(appId)]);
  return existing?.id ?? null;
}

module.exports = { resolveGameId };
