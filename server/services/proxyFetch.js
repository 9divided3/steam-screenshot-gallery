/**
 * HTTPS fetch through hosts-based acceleration (direct connection).
 * No longer requires a local HTTP CONNECT proxy.
 */
const https = require('https');
const { URL } = require('url');

/**
 * Make an HTTPS request directly (hosts file handles domain→IP resolution).
 * Returns a response-like object with { ok, status, text(), arrayBuffer() }.
 */
function proxyFetch(url, options = {}, _redirectCount = 0) {
  const MAX_REDIRECTS = 10;
  if (_redirectCount >= MAX_REDIRECTS) {
    return Promise.reject(new Error('Too many redirects'));
  }

  const parsed = new URL(url);
  const timeout = options.timeout || 30000;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + (parsed.search || ''),
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: '*/*',
        Connection: 'close',
        ...options.headers,
      },
      timeout,
      agent: false,
      // Allow self-signed / mismatched certs when hosts points to CDN IPs
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '1',
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);

        // Handle redirect
        if (res.statusCode >= 300 && res.statusCode < 400) {
          const loc = res.headers.location;
          if (loc) {
            let redirectUrl = loc;
            if (!redirectUrl.startsWith('http')) {
              redirectUrl = `https://${parsed.hostname}${redirectUrl}`;
            }
            resolve(proxyFetch(redirectUrl, options, _redirectCount + 1));
            return;
          }
        }

        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          text: () => Promise.resolve(bodyBuffer.toString('utf-8')),
          json: () => {
            try {
              return Promise.resolve(JSON.parse(bodyBuffer.toString('utf-8')));
            } catch {
              return Promise.reject(new Error('Invalid JSON'));
            }
          },
          arrayBuffer: () => Promise.resolve(new Uint8Array(bodyBuffer).buffer),
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out (${timeout}ms)`));
    });

    req.on('error', (err) => {
      reject(new Error(`Request error: ${err.message}`));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

module.exports = { proxyFetch };
