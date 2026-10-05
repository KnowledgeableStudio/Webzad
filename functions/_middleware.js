/**
 * functions/_middleware.js - Path denylist + CORS.
 * Blocks dotfiles and development/internal paths before static serving, and applies
 * CORS to /api/* for the webzad.dev origin (served by GitHub Pages) until the apex
 * domain is migrated to Cloudflare. Same-origin requests are unaffected.
 */

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?webzad\.dev$/,
  /^https:\/\/([a-z0-9-]+\.)?webzad\.pages\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
];

// Deny dotfiles/dot-dirs and dev/internal paths — these should never be deployed,
// but guard anyway so a misconfigured deploy can't leak them.
const BLOCKED_PATH = /^\/(?:\.|docs\/|test\/|node_modules\/|functions_src|.*\.(?:cjs|mjs|ts|ps1|cmd|bat|sh|toml|log|map|md|sqlite|diff|env|vars)$)/i;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (BLOCKED_PATH.test(url.pathname)) {
    return new Response('Not found', { status: 404 });
  }

  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.some(re => re.test(origin));

  if (request.method === 'OPTIONS') {
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
