/**
 * functions/api/notify-visitor.js - POST /api/notify-visitor FormSubmit email dispatch.
 */

import { json, getClientIp, isRateLimited, readJsonBody, methodNotAllowed } from '../_shared/http.js';

const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/f11c4df9cac5fcb3a134c796bf5ee19c';
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
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

    const web3Key = context.env?.WEB3FORMS_ACCESS_KEY || '';
    const subject = `🚀 New Webzad Visitor [${device} | ${location}]`;

    // Web3Forms API accepts server-side calls (needs WEB3FORMS_ACCESS_KEY secret);
    // FormSubmit is kept as fallback but is bot-challenged from Workers.
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

    const result = await (async () => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const ct = res.headers.get('content-type') || '';
        let delivered = res.ok, reason = '';
        if (ct.includes('json')) {
          const data = await res.json().catch(() => ({}));
          if (res.ok && (data.success === true || String(data.success).toLowerCase() === 'true')) {
            delivered = true;
          } else {
            delivered = false;
            reason = data.message || `upstream ${res.status}`;
          }
        } else {
          delivered = false;
          reason = `bot challenge (${res.status})`;
        }
        if (!delivered) console.warn('[API/notify-visitor] email delivery failed:', reason);
        return { delivered, reason };
      } catch (e) {
        console.warn('[API/notify-visitor] email dispatch failed:', e.message);
        return { delivered: false, reason: e.message };
      }
    })();

    return json({ success: true, notified: true, delivered: result.delivered, ...(result.reason ? { reason: result.reason } : {}) });
  } catch (err) {
    console.error('[API/notify-visitor] Internal catch error:', err.message);
    return json({ error: 'Failed to process visitor notification' }, 500);
  }
}

export function onRequest() { return methodNotAllowed(); }
