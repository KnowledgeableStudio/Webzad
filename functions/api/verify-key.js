/**
 * functions/api/verify-key.js - POST /api/verify-key to test developer or server API key.
 */

import { json, getClientIp, checkRateLimit, readJsonBody, methodNotAllowed } from '../_shared/http.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = getClientIp(request);
  if (await checkRateLimit(request, env)) return json({ error: 'Too Many Requests: Rate limit exceeded (max 15/min)' }, 429);

  try {
    const body = await readJsonBody(request);
    if (body.response) return body.response;

    const headerKey = request.headers.get('x-gemini-api-key') || '';
    const serverKey = (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'undefined') ? env.GEMINI_API_KEY : '';
    const apiKey = headerKey || body.data.apiKey || body.data.key || serverKey;
    if (!apiKey) return json({ valid: false, error: 'No API key provided or configured' });

    const mode = (headerKey || body.data.apiKey || body.data.key) ? 'client' : 'server';
    const probeRes = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'GET', signal: AbortSignal.timeout(5000)
    });
    console.log('[API/verify-key] Verification probe result:', probeRes.ok, 'status:', probeRes.status);
    return json(probeRes.ok ? { valid: true, mode } : { valid: false, error: 'Invalid API key or unauthorized' });
  } catch (err) {
    console.error('[API/verify-key] Verification failed:', err.message);
    return json({ valid: false, error: 'Failed to verify key with Gemini API' });
  }
}

export function onRequest() { return methodNotAllowed(); }
