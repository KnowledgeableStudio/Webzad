/**
 * open-site-server.cjs - Static web server with Gemini AI Chat Proxy & Rate Limiting.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolvePublicPath } = require('./server-public-paths.cjs');

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
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

const { TOOL_DEFINITIONS, SYSTEM_INSTRUCTION, buildSystemInstruction,
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
    const instruction = buildSystemInstruction(body.context) || SYSTEM_INSTRUCTION;
    const wantsStream = (req.headers.accept || '').includes('text/event-stream');
    const fetchFn = options.fetch || globalThis.fetch;
    let model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    let geminiRes = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const mode = wantsStream ? ':streamGenerateContent?alt=sse&' : ':generateContent?';
      geminiRes = await fetchFn(`${GEMINI_API_URL}/${model}${mode}key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: instruction }] }, contents, tools: TOOL_DEFINITIONS,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
          ],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 900, temperature: 0.7 } }),
        signal: AbortSignal.timeout(20000)
      });
      if (geminiRes.status !== 503) break;
      model = 'gemini-3.1-flash-lite';
      await new Promise(r => setTimeout(r, 600));
    }
    if (geminiRes.ok && wantsStream && geminiRes.body) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      for await (const chunk of geminiRes.body) res.write(chunk);
      res.end();
      return;
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

const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/f11c4df9cac5fcb3a134c796bf5ee19c';
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const VISITOR_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per visitor

const visitorDedupStore = new Map();

/** Clears all stored visitor deduplication entries for testing teardown. */
function clearVisitorDedup() {
  visitorDedupStore.clear();
}

/** Hashes visitor IP using a daily salt to protect user privacy. */
function hashVisitorIp(ip, salt = new Date().toISOString().slice(0, 10)) {
  return crypto.createHash('sha256').update(String(ip || '127.0.0.1') + salt).digest('hex').slice(0, 24);
}

/** Extracts approximate location from standard reverse-proxy headers. */
function extractLocationFromHeaders(headers = {}) {
  const country = headers['cf-ipcountry'] || headers['x-vercel-ip-country'] || headers['x-country'] || '';
  const city = headers['cf-ipcity'] || headers['x-vercel-ip-city'] || headers['x-city'] || '';
  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  if (city) return city;
  return 'Undisclosed / Direct';
}

/** Handles POST /api/notify-visitor */
async function handleVisitorNotification(req, res, options = {}) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return sendJson(res, 429, { error: 'Too Many Requests' });
  try {
    const body = await readJsonBody(req, res);
    if (!body) return;

    const hashKey = hashVisitorIp(ip);
    const now = Date.now();
    const lastNotified = visitorDedupStore.get(hashKey) || 0;

    if (now - lastNotified < VISITOR_COOLDOWN_MS) {
      return sendJson(res, 200, { success: true, notified: false, reason: 'cooldown' });
    }

    visitorDedupStore.set(hashKey, now);

    const location = extractLocationFromHeaders(req.headers);
    const device = String(body.device || 'Desktop');
    const browser = String(body.browser || req.headers['user-agent'] || 'Modern Web Browser');
    const screen = String(body.screen || 'Unknown');
    const referrer = String(body.referrer || 'Direct Visit');
    const landingPath = String(body.path || '/');
    const timezone = String(body.timezone || 'UTC');
    let visitDate;
    try {
      visitDate = new Date().toLocaleString('en-US', { timeZone: timezone || 'UTC', dateStyle: 'full', timeStyle: 'long' });
    } catch {
      visitDate = new Date().toUTCString();
    }

    const web3Key = process.env.WEB3FORMS_ACCESS_KEY || '';
    const subject = `🚀 New Webzad Visitor [${device} | ${location}]`;

    // Web3Forms API accepts server-side calls (needs WEB3FORMS_ACCESS_KEY);
    // FormSubmit is kept as fallback but is bot-challenged server-side.
    const { endpoint, payload } = web3Key
      ? {
          endpoint: WEB3FORMS_ENDPOINT,
          payload: {
            access_key: web3Key,
            subject,
            from_name: 'Webzad Site',
            'Visitor Time': visitDate,
            'Device & Platform': `${device} (${browser})`,
            'Screen Resolution': screen,
            'Approximate Location': location,
            'Referral Source': referrer,
            'Landing Page': landingPath
          }
        }
      : {
          endpoint: FORMSUBMIT_ENDPOINT,
          payload: {
            _subject: subject,
            'Visitor Time': visitDate,
            'Device & Platform': `${device} (${browser})`,
            'Screen Resolution': screen,
            'Approximate Location': location,
            'Referral Source': referrer,
            'Landing Page': landingPath,
            _template: 'table',
            _captcha: 'false'
          }
        };

    const fetchFn = options.fetchFn || globalThis.fetch;
    let delivered = false;
    try {
      const notifyRes = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const ct = notifyRes.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const data = await notifyRes.json().catch(() => ({}));
        delivered = notifyRes.ok && (data.success === true || String(data.success).toLowerCase() === 'true');
        if (!delivered) console.warn('[API/notify-visitor] email delivery failed:', data.message || notifyRes.status);
      } else {
        console.warn('[API/notify-visitor] email delivery failed: bot challenge', notifyRes.status);
      }
    } catch (e) {
      console.warn('[API/notify-visitor] email dispatch failed:', e.message);
    }

    return sendJson(res, 200, { success: true, notified: true, delivered });
  } catch (err) {
    console.error('[API/notify-visitor] Internal catch error:', err.message);
    return sendJson(res, 500, { error: 'Failed to process visitor notification' });
  }
}

const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_SERVICES = new Set([
  'Signature Website', 'AI & Workflow Automation', 'Website Redesign',
  'Landing Page', 'E-Commerce', 'Custom Web App', 'Branding & Graphics', ''
]);
const contactLine = (v, max = 150) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const contactBlock = (v, max = 4000) => String(v || '').replace(/\r/g, '').trim().slice(0, max);

/** Handles POST /api/contact — validates the project brief and relays via Web3Forms. */
async function handleContactRequest(req, res, options = {}) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return sendJson(res, 429, { error: 'Too Many Requests' });
  try {
    const body = await readJsonBody(req, res);
    if (!body) return;
    const d = body || {};

    // Honeypot — bots filling the hidden "website" field get a fake success.
    if (d.website) return sendJson(res, 200, { success: true });

    const name = contactLine(d.name, 100);
    const email = contactLine(d.email, 150);
    const company = contactLine(d.company, 100);
    const service = contactLine(d.service, 60);
    const timeline = contactLine(d.timeline, 100);
    const goals = contactBlock(d.goals, 4000);

    if (!name || !email || !goals) return sendJson(res, 400, { error: 'Name, email, and project goals are required.' });
    if (!CONTACT_EMAIL_RE.test(email)) return sendJson(res, 400, { error: 'Please provide a valid email address.' });
    if (service && !CONTACT_SERVICES.has(service)) return sendJson(res, 400, { error: 'Invalid service selection.' });

    const accessKey = process.env.WEB3FORMS_ACCESS_KEY || '';
    if (!accessKey) {
      console.error('[API/contact] WEB3FORMS_ACCESS_KEY not configured');
      return sendJson(res, 503, { error: 'Contact service is not configured. Please email us directly.' });
    }

    const payload = {
      access_key: accessKey,
      subject: `📋 New Project Brief — ${name}${company ? ` (${company})` : ''}`,
      from_name: 'Webzad Contact Form',
      replyto: email,
      name, email,
      company: company || '—',
      service: service || '—',
      timeline: timeline || '—',
      message: goals
    };

    const fetchFn = options.fetchFn || globalThis.fetch;
    let delivered = false;
    try {
      const notifyRes = await fetchFn(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(Math.max(1, Math.min(10000, Number(options.providerTimeoutMs) || 10000)))
      });
      const ct = notifyRes.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const data = await notifyRes.json().catch(() => ({}));
        delivered = notifyRes.ok && (data.success === true || String(data.success).toLowerCase() === 'true');
        if (!delivered) console.error('[API/contact] Web3Forms rejected:', data.message || notifyRes.status);
      } else {
        console.error('[API/contact] Web3Forms non-JSON response:', notifyRes.status);
      }
    } catch (e) {
      console.error('[API/contact] dispatch failed:', e.message);
    }

    if (!delivered) {
      return sendJson(res, 502, { error: 'Could not send your message right now. Please email knowledgablellc@gmail.com directly.' });
    }
    return sendJson(res, 200, { success: true });
  } catch (err) {
    console.error('[API/contact] Internal catch error:', err.message);
    return sendJson(res, 500, { error: 'Could not send your message right now. Please email knowledgablellc@gmail.com directly.' });
  }
}

/** Only allowlisted public files are readable, with bounded streaming for media. */
async function handleStaticRequest(req, res, pathname) {
  const filePath = await resolvePublicPath(root, pathname);
  if (!filePath) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  try {
    const stat = await fs.promises.stat(filePath);
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    let start = 0, end = stat.size - 1, status = 200;
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        res.setHeader('Content-Range', `bytes */${stat.size}`);
        return send(res, 416, 'text/plain; charset=utf-8', 'Invalid range');
      }
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
        res.setHeader('Content-Range', `bytes */${stat.size}`);
        return send(res, 416, 'text/plain; charset=utf-8', 'Invalid range');
      }
      status = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    }
    res.statusCode = status;
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', Math.max(0, end - start + 1));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD' || stat.size === 0) return res.end();
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', () => { if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'Unable to read file'); else res.destroy(); });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch { send(res, 404, 'text/plain; charset=utf-8', 'Not found'); }
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' blob: https://webzad.pages.dev; media-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()'
};

/** Main request handler routing API and static file requests. */
function handleRequest(req, res) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
  let cleanUrl;
  try {
    cleanUrl = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return send(res, 400, 'text/plain; charset=utf-8', 'Bad Request');
  }
  if (/[\\\0]/.test(cleanUrl)) return send(res, 400, 'text/plain; charset=utf-8', 'Bad Request');
  if (cleanUrl === '/api/chat' || cleanUrl === '/api/verify-key' || cleanUrl === '/api/notify-visitor' || cleanUrl === '/api/contact') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    }
    if (cleanUrl === '/api/chat') return handleChatRequest(req, res);
    if (cleanUrl === '/api/verify-key') return handleVerifyKeyRequest(req, res);
    if (cleanUrl === '/api/contact') return handleContactRequest(req, res);
    return handleVisitorNotification(req, res);
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed'); }
  return handleStaticRequest(req, res, (req.url || '/').split('?')[0]);
}

const server = http.createServer(handleRequest);
if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT must be an integer from 1 to 65535.'); process.exit(1); }
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Close the other Webzad server or set PORT to another free port.` : 'Could not start Webzad: ' + error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}/`;
    console.log(`Webzad is ready: ${url}\nKeep this window open. Press Ctrl+C to stop.`);
    if (process.argv.includes('--open')) {
      const command = process.platform === 'win32' ? ['cmd.exe', ['/d','/c','start','',url]] : process.platform === 'darwin' ? ['open',[url]] : ['xdg-open',[url]];
      const child = require('node:child_process').spawn(command[0], command[1], { detached: true, stdio: 'ignore' });
      child.on('error', () => console.log(`Open your browser at ${url}`)); child.unref();
    }
  });
}

module.exports = {
  handleChatRequest, handleVerifyKeyRequest, handleVisitorNotification, handleContactRequest, handleRequest,
  isRateLimited, clearRateLimits, clearVisitorDedup, hashVisitorIp, extractLocationFromHeaders,
  maskSensitiveError, rateLimitStore, visitorDedupStore,
  TOOL_DEFINITIONS, SYSTEM_INSTRUCTION, MAX_BODY_BYTES, MAX_TURNS, server
};
