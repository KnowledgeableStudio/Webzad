/**
 * open-site-server.cjs - Static web server with Gemini AI Chat Proxy & Rate Limiting.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_TURNS = 20;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 15;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Automatically loads local .env variables into process.env if present. */
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const raw of content.split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq > 0) {
          const k = line.slice(0, eq).trim();
          const v = line.slice(eq + 1).trim().replace(/^['"](.*)['"]$/, '$1');
          if (k && !(k in process.env)) process.env[k] = v;
        }
      }
    } catch {}
  }
}
loadEnv();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary',
  '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2'
};

const { TOOL_DEFINITIONS, SYSTEM_INSTRUCTION,
  formatGeminiContents, extractGeminiResponse } = require('./server-gemini-tools.cjs');

const rateLimitStore = new Map();

/** Clears all stored rate limit timestamps for testing teardown. */
function clearRateLimits() { rateLimitStore.clear(); }
/** Checks and updates sliding window rate limit for client IP, deleting expired keys. */
function isRateLimited(ip, windowMs = RATE_LIMIT_WINDOW_MS, maxRequests = RATE_LIMIT_MAX, now = Date.now()) {
  if (!ip) return false;
  const stored = rateLimitStore.get(ip) || [];
  const timestamps = stored.filter(t => now - t < windowMs);
  if (timestamps.length === 0 && stored.length > 0) rateLimitStore.delete(ip);
  if (timestamps.length >= maxRequests) {
    rateLimitStore.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);
  return false;
}

/** Extracts client IP address from proxy headers or connection socket. */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
}

/** Dispatches HTTP response with headers and guards against multiple writes. */
function send(res, status, type, body) {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.writableEnded = true;
  res.end(body);
}

/** Helper to send JSON responses consistently. */
function sendJson(res, statusCode, payload) {
  send(res, statusCode, 'application/json; charset=utf-8', JSON.stringify(payload));
}
/** Masks API keys, file paths, line numbers, and stack traces to prevent secret leakage. */
function maskSensitiveError(errMessage, sensitiveKey = '') {
  let masked = String(errMessage || '');
  if (sensitiveKey && sensitiveKey.length > 5) masked = masked.split(sensitiveKey).join('[REDACTED]');
  return masked.replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]')
    .replace(/(?:[a-zA-Z]:)?[\\/][^\s:]+:\d+(?::\d+)?/g, '[REDACTED_PATH]')
    .replace(/[a-zA-Z]:\\[^\s:]+/g, '[REDACTED_PATH]')
    .replace(/^\s*at\s+.*$/gm, '').trim();
}

/** Reads streaming request body with strict 64KB size enforcement. */
function readJsonBody(req, res, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const rejectTooLarge = () => {
      sendJson(res, 413, { error: 'Payload Too Large: Maximum allowed size is 64KB' });
      resolve(null);
    };
    if (Number(req.headers['content-length'] || 0) > maxBytes) return rejectTooLarge();
    let received = 0;
    const chunks = [];
    req.on('data', chunk => {
      received += chunk.length;
      if (received <= maxBytes) return chunks.push(chunk);
      rejectTooLarge();
      if (typeof req.destroy === 'function') req.destroy();
    });
    req.on('end', () => {
      if (res.writableEnded) return resolve(null);
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch {
        sendJson(res, 400, { error: 'Invalid JSON payload' });
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

/** Handles POST /api/chat requests with Gemini proxying and rate limiting. */
async function handleChatRequest(req, res, options = {}) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return sendJson(res, 429, { error: 'Too Many Requests: Rate limit exceeded (max 15/min)' });
  let apiKey = '';
  try {
    const body = await readJsonBody(req, res);
    if (!body) return;
    const headerKey = req.headers['x-gemini-api-key'];
    const serverKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined') ? process.env.GEMINI_API_KEY : '';
    apiKey = serverKey || headerKey || body.apiKey || body.key;
    if (!apiKey) {
      console.warn('[API/chat] 401: No Gemini API key provided in server env, headers, or body');
      return sendJson(res, 401, { error: 'Gemini API key is not configured' });
    }
    const contents = formatGeminiContents(body.messages || body.message || 'Hello');
    const fetchFn = options.fetch || globalThis.fetch;
    let model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    let geminiRes = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      geminiRes = await fetchFn(`${GEMINI_API_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }, contents, tools: TOOL_DEFINITIONS }),
        signal: AbortSignal.timeout(15000)
      });
      if (geminiRes.status !== 503) break;
      model = 'gemini-3.1-flash-lite';
      await new Promise(r => setTimeout(r, 600));
    }
    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      let errMsg = maskSensitiveError(data?.error?.message || 'Gemini API request failed', apiKey);
      if (headerKey) errMsg = maskSensitiveError(errMsg, headerKey);
      if (geminiRes.status === 402 || data?.error?.status === 'RESOURCE_EXHAUSTED' || errMsg.toLowerCase().includes('prepayment')) {
        errMsg = 'Your Google AI Studio prepayment credits are depleted. Please visit https://ai.studio/projects to manage your project and billing.';
      }
      console.error('[API/chat] Gemini API error:', geminiRes.status, errMsg);
      return sendJson(res, geminiRes.status >= 400 && geminiRes.status < 600 ? geminiRes.status : 502, { error: errMsg });
    }
    return sendJson(res, 200, extractGeminiResponse(data));
  } catch (err) {
    let errMsg = maskSensitiveError(err.message, apiKey);
    if (req.headers['x-gemini-api-key']) errMsg = maskSensitiveError(errMsg, req.headers['x-gemini-api-key']);
    console.error('[API/chat] Internal catch error:', errMsg);
    return sendJson(res, 502, { error: errMsg || 'Service temporarily unavailable' });
  }
}

/** Handles POST /api/verify-key to test developer or server API key. */
async function handleVerifyKeyRequest(req, res, options = {}) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return sendJson(res, 429, { error: 'Too Many Requests: Rate limit exceeded (max 15/min)' });
  try {
    const body = await readJsonBody(req, res);
    if (!body) return;
    const headerKey = req.headers['x-gemini-api-key'];
    const serverKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined') ? process.env.GEMINI_API_KEY : '';
    const apiKey = headerKey || body.apiKey || body.key || serverKey;
    if (!apiKey) return sendJson(res, 200, { valid: false, error: 'No API key provided or configured' });
    const mode = (headerKey || body.apiKey || body.key) ? 'client' : 'server';
    const fetchFn = options.fetch || globalThis.fetch;
    const probeRes = await fetchFn(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'GET', signal: AbortSignal.timeout(5000)
    });
    console.log('[API/verify-key] Verification probe result:', probeRes.ok, 'status:', probeRes.status);
    return sendJson(res, 200, probeRes.ok ? { valid: true, mode } : { valid: false, error: 'Invalid API key or unauthorized' });
  } catch (err) {
    console.error('[API/verify-key] Verification failed:', err.message);
    return sendJson(res, 200, { valid: false, error: 'Failed to verify key with Gemini API' });
  }
}

/** Serves static file buffer or 404 with single read and SPA fallback. */
function handleStaticRequest(res, relativePath) {
  const resolvedRoot = path.resolve(root);
  const filePath = path.resolve(path.join(root, relativePath));
  if (!filePath.startsWith(resolvedRoot)) return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (!err) return send(res, 200, MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream', data);
    if (path.extname(relativePath)) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
    fs.readFile(path.join(root, 'index.html'), (spaErr, spaData) => {
      send(res, spaErr ? 404 : 200, spaErr ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8', spaErr ? 'Not found' : spaData);
    });
  });
}

/** Main request handler routing API and static file requests. */
function handleRequest(req, res) {
  let cleanUrl;
  try {
    cleanUrl = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return send(res, 400, 'text/plain; charset=utf-8', 'Bad Request');
  }
  if (cleanUrl === '/api/chat' || cleanUrl === '/api/verify-key') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    }
    return cleanUrl === '/api/chat' ? handleChatRequest(req, res) : handleVerifyKeyRequest(req, res);
  }
  handleStaticRequest(res, cleanUrl === '/' ? '/index.html' : cleanUrl);
}

const server = http.createServer(handleRequest);
if (require.main === module) {
  server.listen(process.env.PORT || 4173, '127.0.0.1', () => console.log('Webzad server running at http://127.0.0.1:4173/'));
}

module.exports = {
  handleChatRequest, handleVerifyKeyRequest, handleRequest, isRateLimited,
  clearRateLimits, maskSensitiveError, rateLimitStore,
  TOOL_DEFINITIONS, SYSTEM_INSTRUCTION, MAX_BODY_BYTES, MAX_TURNS, server
};
