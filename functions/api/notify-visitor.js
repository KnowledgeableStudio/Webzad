/**
 * functions/api/notify-visitor.js - POST /api/notify-visitor FormSubmit email dispatch.
 */

import { json, getClientIp, isRateLimited, readJsonBody, methodNotAllowed } from '../_shared/http.js';

const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/f11c4df9cac5fcb3a134c796bf5ee19c';
const VISITOR_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per visitor

/** Per-isolate dedup store (best-effort; resets when the isolate is evicted). */
const visitorDedupStore = new Map();

/** Hashes visitor IP using a daily salt to protect user privacy. */
async function hashVisitorIp(ip, salt = new Date().toISOString().slice(0, 10)) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(ip || '127.0.0.1') + salt));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

/** Extracts approximate location from Cloudflare request metadata and headers. */
function extractLocation(request) {
  const country = request.cf?.country || request.headers.get('cf-ipcountry') || '';
  const city = request.cf?.city || request.headers.get('cf-ipcity') || '';
  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  if (city) return city;
  return 'Undisclosed / Direct';
}

export async function onRequestPost(context) {
  const { request } = context;
  const ip = getClientIp(request);
  if (isRateLimited(ip)) return json({ error: 'Too Many Requests' }, 429);

  try {
    const body = await readJsonBody(request);
    if (body.response) return body.response;

    const hashKey = await hashVisitorIp(ip);
    const now = Date.now();
    const lastNotified = visitorDedupStore.get(hashKey) || 0;
    if (now - lastNotified < VISITOR_COOLDOWN_MS) {
      return json({ success: true, notified: false, reason: 'cooldown' });
    }
    visitorDedupStore.set(hashKey, now);

    const location = extractLocation(request);
    const device = String(body.data.device || 'Desktop');
    const browser = String(body.data.browser || request.headers.get('user-agent') || 'Modern Web Browser');
    const screen = String(body.data.screen || 'Unknown');
    const referrer = String(body.data.referrer || 'Direct Visit');
    const landingPath = String(body.data.path || '/');
    const timezone = String(body.data.timezone || 'UTC');
    let visitDate;
    try {
      visitDate = new Date().toLocaleString('en-US', { timeZone: timezone || 'UTC', dateStyle: 'full', timeStyle: 'long' });
    } catch {
      visitDate = new Date().toUTCString();
    }

    const emailPayload = {
      _subject: `🚀 New Webzad Visitor [${device} | ${location}]`,
      'Visitor Time': visitDate,
      'Device & Platform': `${device} (${browser})`,
      'Screen Resolution': screen,
      'Approximate Location': location,
      'Referral Source': referrer,
      'Landing Page': landingPath,
      _template: 'table'
    };

    const notify = fetch(FORMSUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(emailPayload)
    }).catch(e => console.warn('[API/notify-visitor] FormSubmit dispatch failed:', e.message));

    if (context.waitUntil) context.waitUntil(notify); else await notify;

    return json({ success: true, notified: true });
  } catch (err) {
    console.error('[API/notify-visitor] Internal catch error:', err.message);
    return json({ error: 'Failed to process visitor notification' }, 500);
  }
}

export function onRequest() { return methodNotAllowed(); }
