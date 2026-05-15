const express = require('express');
const { URL } = require('url');
const { authMiddleware } = require('../middleware/auth');
const { proxyFetch } = require('../services/proxyFetch');

const router = express.Router();

const ALLOWED_DOMAINS = [
  'steamcommunity.com',
  'images.steamusercontent.com',
  'store.steampowered.com',
];

function isAllowedHost(hostname) {
  return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
}

function getContentType(url) {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

router.get('/steam-fetch', authMiddleware, async (req, res, next) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'url required' });

    const host = new URL(targetUrl).hostname;
    if (!isAllowedHost(host)) {
      return res.status(403).json({ error: 'domain not allowed' });
    }

    const result = await proxyFetch(targetUrl);
    const arrayBuffer = await result.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    res.set('Content-Type', getContentType(targetUrl));
    res.status(result.status).send(buf);
  } catch (err) {
    next(err);
  }
});

router.get('/steam-fetch-html', authMiddleware, async (req, res, next) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'url required' });

    const host = new URL(targetUrl).hostname;
    if (!isAllowedHost(host)) {
      return res.status(403).json({ error: 'domain not allowed' });
    }

    const result = await proxyFetch(targetUrl);
    const text = await result.text();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
