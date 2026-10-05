/**
 * functions/_middleware.js - CORS for /api/* routes.
 * Allows the webzad.dev origin (served by GitHub Pages) to reach the Pages Functions API
 * until the apex domain is migrated to Cloudflare. Same-origin requests are unaffected.
 */

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?webzad\.dev$/,
  /^https:\/\/([a-z0-9-]+\.)?webzad\.pages\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
];

export async function onRequest(context) {
  const origin = context.request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.some(re => re.test(origin));

  if (context.request.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 204 });
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-gemini-api-key',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
  }

  const res = await context.next();
  if (!allowed) return res;
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.append('Vary', 'Origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
