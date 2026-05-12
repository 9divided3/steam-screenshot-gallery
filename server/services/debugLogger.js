/**
 * Debug logger — writes detailed import session logs to server/debug/.
 *
 * Two output files per session:
 *   import_{steamId}_{timestamp}.log  — human-readable text log
 *   import_{steamId}_{timestamp}.json — structured data for analysis
 *
 * All writes are sync to survive crashes; JSON is rewritten on every event.
 */
const fs = require('fs');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, '..', 'debug');

class DebugLogger {
  constructor(steamId) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeId = steamId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
    this.baseName = `import_${safeId}_${ts}`;
    this.logPath = path.join(DEBUG_DIR, `${this.baseName}.log`);
    this.jsonPath = path.join(DEBUG_DIR, `${this.baseName}.json`);

    this.json = {
      session: { steamId, startedAt: new Date().toISOString() },
      phases: {},
    };

    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

    this._writeLog(`══════ Import Session Started ══════`);
    this._writeLog(`Steam ID: ${steamId}`);
    this._writeLog(`Log:     ${this.logPath}`);
    this._writeLog(`JSON:    ${this.jsonPath}`);
  }

  // ── internal ──

  _writeLog(line) {
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const entry = `[${ts}] ${line}`;
    fs.appendFileSync(this.logPath, entry + '\n');
    console.log(entry);
  }

  _flushJson() {
    this.json.savedAt = new Date().toISOString();
    fs.writeFileSync(this.jsonPath, JSON.stringify(this.json, null, 2));
  }

  // ── phase lifecycle ──

  startPhase(name, meta = {}) {
    this._writeLog(`── Phase: ${name} ──`);
    if (Object.keys(meta).length) this._writeLog(`   ${JSON.stringify(meta)}`);
    this.json.phases[name] = { startedAt: new Date().toISOString(), meta, events: [] };
    this._flushJson();
  }

  endPhase(name, result = {}) {
    if (this.json.phases[name]) {
      this.json.phases[name].endedAt = new Date().toISOString();
      this.json.phases[name].result = result;
    }
    this._writeLog(`── ${name} done: ${JSON.stringify(result)}`);
    this._flushJson();
  }

  // ── events ──

  event(phase, type, data = {}) {
    const entry = { at: new Date().toISOString(), type, ...data };
    if (this.json.phases[phase]) {
      this.json.phases[phase].events.push(entry);
    }
    this._writeLog(`  [${type}] ${JSON.stringify(data)}`);
    this._flushJson();
  }

  // ── convenience ──

  info(phase, msg) {
    this._writeLog(`  ${msg}`);
  }

  finalMessage(msg) {
    this._writeLog(msg);
  }

  error(phase, err, context = {}) {
    const entry = {
      at: new Date().toISOString(),
      type: 'error',
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 4).join('\n'),
      ...context,
    };
    if (this.json.phases[phase]) {
      this.json.phases[phase].events.push(entry);
    }
    this._writeLog(`  [ERROR] ${err.message} ${JSON.stringify(context)}`);
    this._flushJson();
  }
}

module.exports = { DebugLogger };
