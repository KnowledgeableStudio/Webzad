/**
 * _shared/http.js - Shared request helpers for Pages Functions (port of open-site-server.cjs utilities).
 */

export const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 15;

/** Per-isolate rate limit store. Not globally consistent across isolates; for strict limits bind a Rate Limiting binding or KV. */
export const rateLimitStore = new Map();

/** Builds a JSON Response with the given status code. */
export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

/** Extracts client IP from Cloudflare headers or x-forwarded-for. */
export function getClientIp(request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || '127.0.0.1';
}

/** Checks and updates sliding window rate limit for client IP. */
export function isRateLimited(ip, windowMs = RATE_LIMIT_WINDOW_MS, maxRequests = RATE_LIMIT_MAX, now = Date.now()) {
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

/** Masks API keys, file paths, and stack traces to prevent secret leakage. */
export function maskSensitiveError(errMessage, sensitiveKey = '') {
  let masked = String(errMessage || '');
  if (sensitiveKey && sensitiveKey.length > 5) masked = masked.split(sensitiveKey).join('[REDACTED]');
  return masked.replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]')
    .replace(/(?:[a-zA-Z]:)?[\\/][^\s:]+:\d+(?::\d+)?/g, '[REDACTED_PATH]')
    .replace(/[a-zA-Z]:\\[^\s:]+/g, '[REDACTED_PATH]')
    .replace(/^\s*at\s+.*$/gm, '').trim();
}

/**
 * Reads request JSON body with 64KB size enforcement.
 * @returns {Promise<{data: Object}|{response: Response}>} Parsed body or an error Response to return.
 */
export async function readJsonBody(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return { response: json({ error: 'Payload Too Large: Maximum allowed size is 64KB' }, 413) };
  }
  // Bound streamed bytes before decoding; a character count undercounts UTF-8 input.
  let raw = '';
  if (request.body?.getReader) {
    const reader = request.body.getReader();
    const chunks = []; let received = 0;
    try {
      while (true) {
        const {done,value} = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_BODY_BYTES) {
          await reader.cancel();
          return {response:json({error:'Payload Too Large: Maximum allowed size is 64KB'},413)};
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(received); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
    raw = new TextDecoder().decode(bytes).trim();
  } else {
    raw = (await request.text()).trim();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return {response:json({error:'Payload Too Large: Maximum allowed size is 64KB'},413)};
  }
  if (!raw) return {data:{}};
  try {
    return { data: JSON.parse(raw) };
  } catch {
    return { response: json({ error: 'Invalid JSON payload' }, 400) };
  }
}

/** Shared POST-only guard for non-POST methods on API routes. */
export function methodNotAllowed() {
  return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
}

/**
 * Edge rate-limit check: uses the globally-consistent RATE_LIMITER binding when
 * the platform attaches it, otherwise falls back to the per-isolate limiter.
 */
export async function checkRateLimit(request, env) {
  const ip = getClientIp(request);
  if (env?.RATE_LIMITER?.limit) {
    try {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      return !success;
    } catch {
      // binding failure shouldn't take the API down — fall back to in-memory
    }
  }
  return isRateLimited(ip);
}
