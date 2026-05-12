const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'gallery.db');

let db = null;
let SQL = null;

function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, buffer);
}

async function init() {
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  const { runMigrations } = require('./migrations');
  runMigrations(db, all, save);
}

/**
 * Execute a write statement (INSERT/UPDATE/DELETE/DDL).
 * Returns { changes, lastInsertRowid } — lastInsertRowid is 0 for non-INSERT.
 */
function run(sql, params) {
  if (params) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  let lastId = 0;
  if (typeof sql === 'string' && sql.trim().toUpperCase().startsWith('INSERT')) {
    try {
      const res = db.exec('SELECT last_insert_rowid() AS id');
      if (res && res[0] && res[0].values && res[0].values[0]) {
        lastId = res[0].values[0][0];
      }
    } catch { /* last_insert_rowid not available */ }
  }
  save();
  return {
    changes: db.getRowsModified(),
    lastInsertRowid: lastId,
  };
}

/** Execute a query and return the first row as an object, or undefined if no rows. */
function get(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

/** Execute a query and return all rows as an array of objects. */
function all(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

module.exports = { db: () => db, init, run, get, all, save };
