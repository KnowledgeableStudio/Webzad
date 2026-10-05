/**
 * functions/api/contact.js - POST /api/contact project brief relay.
 * Validates and sanitizes the contact form, then relays to Web3Forms server-side
 * (access key stays secret; FormSubmit is not used — it bot-challenges Workers).
 */

import { json, getClientIp, isRateLimited, readJsonBody, methodNotAllowed } from '../_shared/http.js';

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SERVICES = new Set([
  'Signature Website', 'AI & Workflow Automation', 'Website Redesign',
  'Landing Page', 'E-Commerce', 'Custom Web App', 'Branding & Graphics', ''
]);

/** Strips CR/LF to prevent email header injection and clamps length. */
const line = (v, max = 150) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const block = (v, max = 4000) => String(v || '').replace(/\r/g, '').trim().slice(0, max);

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = getClientIp(request);
  if (isRateLimited(ip)) return json({ error: 'Too Many Requests: Rate limit exceeded (max 15/min)' }, 429);

  try {
    const body = await readJsonBody(request);
    if (body.response) return body.response;
    const d = body.data || {};

    // Honeypot — bots filling the hidden "website" field get a fake success.
    if (d.website) return json({ success: true });

    const name = line(d.name, 100);
    const email = line(d.email, 150);
    const company = line(d.company, 100);
    const service = line(d.service, 60);
    const timeline = line(d.timeline, 100);
    const goals = block(d.goals, 4000);

    if (!name || !email || !goals) return json({ error: 'Name, email, and project goals are required.' }, 400);
    if (!EMAIL_RE.test(email)) return json({ error: 'Please provide a valid email address.' }, 400);
    if (service && !SERVICES.has(service)) return json({ error: 'Invalid service selection.' }, 400);

    const accessKey = env.WEB3FORMS_ACCESS_KEY || '';
    if (!accessKey) {
      console.error('[API/contact] WEB3FORMS_ACCESS_KEY not configured');
      return json({ error: 'Contact service is not configured. Please email us directly.' }, 503);
    }

    const payload = {
      access_key: accessKey,
      subject: `📋 New Project Brief — ${name}${company ? ` (${company})` : ''}`,
      from_name: 'Webzad Contact Form',
      replyto: email,
      name,
      email,
      company: company || '—',
      service: service || '—',
      timeline: timeline || '—',
      message: goals
    };

    const res = await fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json().catch(() => ({})) : {};
    const ok = res.ok && (data.success === true || String(data.success).toLowerCase() === 'true');
    if (!ok) {
      console.error('[API/contact] Web3Forms delivery failed:', res.status, data.message || ct);
      return json({ error: 'Could not send your message right now. Please email knowledgablellc@gmail.com directly.' }, 502);
    }
    return json({ success: true });
  } catch (err) {
    console.error('[API/contact] Internal error:', err.message);
    return json({ error: 'Could not send your message right now. Please email knowledgablellc@gmail.com directly.' }, 500);
  }
}

export function onRequest() { return methodNotAllowed(); }
