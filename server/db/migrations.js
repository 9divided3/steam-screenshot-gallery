/**
 * Schema definitions and incremental migrations.
 *
 * @param {import('sql.js').Database} db   - raw sql.js database instance
 * @param {function}                 all  - query helper: returns array of row objects
 * @param {function}                 save - persists the database to disk
 */
function runMigrations(db, all, save) {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      steam_app_id INTEGER,
      name TEXT NOT NULL,
      icon_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, steam_app_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
      title TEXT,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      source TEXT NOT NULL DEFAULT 'upload',
      steam_file_id TEXT,
      is_public INTEGER DEFAULT 0,
      width INTEGER,
      height INTEGER,
      file_size INTEGER,
      taken_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      steam_api_key TEXT,
      steam_id TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS steam_discovered_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      steam_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      app_id INTEGER,
      status TEXT NOT NULL DEFAULT 'discovered',
      image_url TEXT,
      title TEXT,
      error_msg TEXT,
      retries INTEGER DEFAULT 0,
      downloaded INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, file_id)
    )
  `);

  // ── Incremental migrations ──

  function columnExists(table, column) {
    const cols = all(`PRAGMA table_info(${table})`);
    return cols.some((c) => c.name === column);
  }

  if (!columnExists('steam_discovered_files', 'downloaded')) {
    db.run('ALTER TABLE steam_discovered_files ADD COLUMN downloaded INTEGER DEFAULT 0');
  }

  if (!columnExists('users', 'avatar_url')) {
    db.run("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''");
  }
  if (!columnExists('users', 'display_name')) {
    db.run("ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''");
  }
  if (!columnExists('users', 'bio')) {
    db.run("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");
  }

  if (!columnExists('screenshots', 'showcased')) {
    db.run('ALTER TABLE screenshots ADD COLUMN showcased INTEGER DEFAULT 0');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS import_state (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      steam_id TEXT,
      phase TEXT DEFAULT 'idle',
      total_discovered INTEGER DEFAULT 0,
      total_resolved INTEGER DEFAULT 0,
      total_failed INTEGER DEFAULT 0,
      total_downloaded INTEGER DEFAULT 0,
      error_msg TEXT,
      started_at TEXT,
      updated_at TEXT
    )
  `);

  if (!columnExists('import_state', 'resolve_baseline')) {
    db.run('ALTER TABLE import_state ADD COLUMN resolve_baseline INTEGER DEFAULT 0');
  }
  if (!columnExists('import_state', 'download_baseline')) {
    db.run('ALTER TABLE import_state ADD COLUMN download_baseline INTEGER DEFAULT 0');
  }
  if (!columnExists('import_state', 'failed_baseline')) {
    db.run('ALTER TABLE import_state ADD COLUMN failed_baseline INTEGER DEFAULT 0');
  }
  if (!columnExists('import_state', 'download_failed_baseline')) {
    db.run('ALTER TABLE import_state ADD COLUMN download_failed_baseline INTEGER DEFAULT 0');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      screenshot_id INTEGER NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, screenshot_id)
    )
  `);

  save();
}

module.exports = { runMigrations };
