const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { init, get } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

['uploads', 'uploads/avatars', 'thumbnails'].forEach((dir) => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (_req, res) => {
  try {
    const row = get('SELECT 1 AS ok');
    res.json({ status: row ? 'ok' : 'degraded', db: !!row, timestamp: Date.now() });
  } catch {
    res.status(503).json({ status: 'error', db: false, timestamp: Date.now() });
  }
});

app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads', 'avatars')));

const authRouter = require('./routes/auth');
const screenshotsRouter = require('./routes/screenshots');
const importRouter = require('./routes/import');
const gamesRouter = require('./routes/games');
const statsRouter = require('./routes/stats');
const profileRouter = require('./routes/profile');
const followsRouter = require('./routes/follows');
const publicRouter = require('./routes/public');
const likesRouter = require('./routes/likes');
const configRouter = require('./routes/config');
const steamProxyRouter = require('./routes/steamProxy');

function mountRoutes() {
  app.use('/api/auth', authRouter);
  app.use('/api/screenshots', importRouter.router);
  app.use('/api/screenshots', screenshotsRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api', statsRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/follows', followsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/likes', likesRouter);
  app.use('/api/config', configRouter);
  app.use('/api', steamProxyRouter);
}

function errorHandler(err, req, res, _next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  if (res.headersSent) return;
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? '服务器内部错误'
    : err.message || '服务器内部错误';
  res.status(status).json({ error: message });
}

async function start() {
  await init();
  console.log('Database initialized');

  mountRoutes();

  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
