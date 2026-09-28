/**
 * open-site-server.cjs - Static web server with secure Gemini AI Chat Proxy & Rate Limiting.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname, MAX_BODY_BYTES = 64 * 1024, MAX_TURNS = 20, RATE_LIMIT_WINDOW_MS = 60000, RATE_LIMIT_MAX = 15;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

const decl = (name, description, properties = {}, required) => ({ name, description, parameters: { type: 'object', properties, ...(required ? { required } : {}) } });
const TOOL_DEFINITIONS = [{ functionDeclarations: [
  decl('scrollToSection', 'Scroll to website section', { sectionId: { type: 'string', enum: ['hero', 'services', 'work', 'process', 'contact'] } }, ['sectionId']),
  decl('openProjectPreview', 'Open project preview lightbox', { projectId: { type: 'string', enum: ['growth', 'hospitality', 'services'] } }, ['projectId']),
  decl('prefillContactBrief', 'Prefill contact brief form', { serviceType: { type: 'string', enum: ['signature-website', 'landing-page', 'web-app', 'autonomous-business', 'custom-ai'] }, details: { type: 'string' } }),
  decl('toggleAudioOutput', 'Toggle audio voice output', { enabled: { type: 'boolean' } }, ['enabled']),
  decl('openDevSettings', 'Open developer settings modal')
] }];

const SYSTEM_INSTRUCTION = 'You are Zada, an intelligent sci-fi 3D AI companion for Webzad (webzad.dev). Voice: Friendly, professional, concise, family-friendly. Services: Signature Websites, Landing Pages, Web Apps, Autonomous Business, Custom AI. Sections: hero, services, work, process, contact. Projects: growth, hospitality, services. Use tools when navigating, previewing projects, prefilling contact details, or toggling audio. Never auto-submit forms.';
const rateLimitStore = new Map();

/** Clears all stored rate limit timestamps for testing teardown. */
function clearRateLimits() { rateLimitStore.clear(); }

/** Checks and updates sliding window rate limit for client IP. */
function isRateLimited(ip, windowMs = RATE_LIMIT_WINDOW_MS, maxRequests = RATE_LIMIT_MAX, now = Date.now()) {
  if (!ip) return false;
  const timestamps = (rateLimitStore.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) return rateLimitStore.set(ip, timestamps), true;
  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);
  return false;
}

/** Extracts client IP address from proxy headers or connection socket. */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
}

/** Helper to send JSON responses consistently. */
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/** Masks API keys and internal file paths to prevent secret leakage. */
function maskSensitiveError(errMessage, sensitiveKey = '') {
  let masked = String(errMessage || '');
  if (sensitiveKey && sensitiveKey.length > 5) masked = masked.split(sensitiveKey).join('[REDACTED]');
  return masked.replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED]').replace(/(?:\/[^\s:]+)+:\d+:\d+/g, '[REDACTED_PATH]');
}

/** Reads streaming request body with strict 64KB size enforcement. */
function readJsonBody(req, res, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] || 0) > maxBytes) {
      return sendJson(res, 413, { error: 'Payload Too Large: Maximum allowed size is 64KB' }), resolve(null);
    }
    let received = 0;
    const chunks = [];
    req.on('data', chunk => {
      received += chunk.length;
      if (received > maxBytes) {
        if (!res.writableEnded) sendJson(res, 413, { error: 'Payload Too Large: Maximum allowed size is 64KB' });
        if (typeof req.destroy === 'function') req.destroy();
        return resolve(null);
      }
      chunks.push(chunk);
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

/** Formats chat history into Gemini contents schema clamped to maxTurns. */
function formatGeminiContents(rawMessages, maxTurns = MAX_TURNS) {
  return (Array.isArray(rawMessages) ? rawMessages : [{ role: 'user', content: String(rawMessages || '') }])
    .slice(-maxTurns).map(m => ({
      role: (m.role === 'model' || m.sender === 'zada' || m.role === 'assistant') ? 'model' : 'user',
      parts: [{ text: String(m.parts?.[0]?.text || m.content || m.text || '') }]
    }));
}

/** Extracts text and toolCalls from Gemini candidate parts. */
function extractGeminiResponse(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return {
    text: parts.filter(p => p.text).map(p => p.text).join('\n'),
    toolCalls: parts.filter(p => p.functionCall).map(p => ({ name: p.functionCall.name, params: p.functionCall.args || {}, args: p.functionCall.args || {} })),
    candidates: data.candidates
  };
}

/** Handles POST /api/chat requests with Gemini proxying and rate limiting. */
async function handleChatRequest(req, res, options = {}) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return sendJson(res, 429, { error: 'Too Many Requests: Rate limit exceeded (max 15/min)' });
  const body = await readJsonBody(req, res);
  if (!body) return;
  const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-api-key'] || body.apiKey;
  if (!apiKey) return sendJson(res, 401, { error: 'Gemini API key is not configured' });

  const contents = formatGeminiContents(body.messages || body.message || 'Hello');
  const fetchFn = options.fetch || globalThis.fetch;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  try {
    const geminiRes = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }, contents, tools: TOOL_DEFINITIONS }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      const errMsg = maskSensitiveError(data?.error?.message || 'Gemini API request failed', apiKey);
      return sendJson(res, geminiRes.status >= 400 && geminiRes.status < 600 ? geminiRes.status : 502, { error: errMsg });
    }
    return sendJson(res, 200, extractGeminiResponse(data));
  } catch (err) {
    return sendJson(res, 502, { error: maskSensitiveError(err.message, apiKey) || 'Service temporarily unavailable' });
  }
}

/** Handles POST /api/verify-key to test developer or server API key. */
async function handleVerifyKeyRequest(req, res, options = {}) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return sendJson(res, 429, { error: 'Too Many Requests: Rate limit exceeded (max 15/min)' });
  const body = await readJsonBody(req, res);
  if (!body) return;
  const headerKey = req.headers['x-gemini-api-key'];
  const apiKey = headerKey || body.apiKey || process.env.GEMINI_API_KEY;
  const mode = (headerKey || body.apiKey) ? 'client' : 'server';
  if (!apiKey) return sendJson(res, 200, { valid: false, error: 'No API key provided or configured' });

  const fetchFn = options.fetch || globalThis.fetch;
  try {
    const probeRes = await fetchFn(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return sendJson(res, 200, probeRes.ok ? { valid: true, mode } : { valid: false, error: 'Invalid API key or unauthorized' });
  } catch {
    return sendJson(res, 200, { valid: false, error: 'Failed to verify key with Gemini API' });
  }
}

/** Sends static file with appropriate Content-Type header. */
function sendFile(res, filePath, statusCode = 200) {
  fs.readFile(filePath, (error, data) => {
    if (error) return res.statusCode = 404, res.setHeader('Content-Type', 'text/plain; charset=utf-8'), res.end('Not found');
    res.statusCode = statusCode;
    res.setHeader('Content-Type', MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    res.end(data);
  });
}

/** Main request handler routing API and static file requests. */
function handleRequest(req, res) {
  const cleanUrl = decodeURIComponent((req.url || '/').split('?')[0]);
  if (cleanUrl === '/api/chat' || cleanUrl === '/api/verify-key') {
    if (req.method !== 'POST') return res.statusCode = 405, res.setHeader('Allow', 'POST'), res.end('Method Not Allowed');
    return cleanUrl === '/api/chat' ? handleChatRequest(req, res) : handleVerifyKeyRequest(req, res);
  }
  const relativePath = cleanUrl === '/' ? '/index.html' : cleanUrl;
  const filePath = path.join(root, relativePath);
  fs.readFile(filePath, error => {
    if (!error) return sendFile(res, filePath);
    if (!path.extname(relativePath)) return sendFile(res, path.join(root, 'index.html'));
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
  });
}

const server = http.createServer(handleRequest);
if (require.main === module) {
  server.listen(process.env.PORT || 4173, '127.0.0.1', () => console.log(`Webzad server running at http://127.0.0.1:4173/`));
}

module.exports = {
  handleChatRequest, handleVerifyKeyRequest, handleRequest, isRateLimited,
  clearRateLimits, TOOL_DEFINITIONS, SYSTEM_INSTRUCTION, MAX_BODY_BYTES, MAX_TURNS, server
};