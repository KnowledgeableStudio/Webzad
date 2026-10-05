/**
 * functions/api/chat.js - POST /api/chat Gemini proxy with SSE streaming for Cloudflare Pages Functions.
 */

import { TOOL_DEFINITIONS, SYSTEM_INSTRUCTION, buildSystemInstruction, formatGeminiContents, extractGeminiResponse } from '../_shared/gemini.js';
import { json, getClientIp, isRateLimited, maskSensitiveError, readJsonBody, methodNotAllowed } from '../_shared/http.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

function geminiBody(contents, instruction) {
  return JSON.stringify({ systemInstruction: { parts: [{ text: instruction }] }, contents, tools: TOOL_DEFINITIONS });
}

async function callGemini(model, apiKey, contents, instruction, stream) {
  const mode = stream ? ':streamGenerateContent?alt=sse&' : ':generateContent?';
  return fetch(`${GEMINI_API_URL}/${model}${mode}key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: geminiBody(contents, instruction),
    signal: AbortSignal.timeout(20000)
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = getClientIp(request);
  if (isRateLimited(ip)) return json({ error: 'Too Many Requests: Rate limit exceeded (max 15/min)' }, 429);

  let apiKey = '';
  try {
    const body = await readJsonBody(request);
    if (body.response) return body.response;

    const headerKey = request.headers.get('x-gemini-api-key') || '';
    const serverKey = (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'undefined') ? env.GEMINI_API_KEY : '';
    apiKey = serverKey || headerKey || body.data.apiKey || body.data.key;
    if (!apiKey) {
      console.warn('[API/chat] 401: No Gemini API key provided in env, headers, or body');
      return json({ error: 'Gemini API key is not configured' }, 401);
    }

    const contents = formatGeminiContents(body.data.messages || body.data.message || 'Hello');
    const instruction = buildSystemInstruction(body.data.context) || SYSTEM_INSTRUCTION;
    const wantsStream = (request.headers.get('accept') || '').includes('text/event-stream');
    let model = env.GEMINI_MODEL || DEFAULT_MODEL;
    let geminiRes = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      geminiRes = await callGemini(model, apiKey, contents, instruction, wantsStream);
      if (geminiRes.status !== 503) break;
      model = DEFAULT_MODEL;
      await new Promise(r => setTimeout(r, 600));
    }

    if (geminiRes.ok && wantsStream) {
      return new Response(geminiRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no'
        }
      });
    }

    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      let errMsg = maskSensitiveError(data?.error?.message || 'Gemini API request failed', apiKey);
      if (headerKey) errMsg = maskSensitiveError(errMsg, headerKey);
      if (geminiRes.status === 402 || data?.error?.status === 'RESOURCE_EXHAUSTED' || errMsg.toLowerCase().includes('prepayment')) {
        errMsg = 'Your Google AI Studio prepayment credits are depleted. Please visit https://ai.studio/projects to manage your project and billing.';
      }
      console.error('[API/chat] Gemini API error:', geminiRes.status, errMsg);
      return json({ error: errMsg }, geminiRes.status >= 400 && geminiRes.status < 600 ? geminiRes.status : 502);
    }
    return json(extractGeminiResponse(data));
  } catch (err) {
    let errMsg = maskSensitiveError(err.message, apiKey);
    if (request.headers.get('x-gemini-api-key')) errMsg = maskSensitiveError(errMsg, request.headers.get('x-gemini-api-key'));
    console.error('[API/chat] Internal catch error:', errMsg);
    return json({ error: errMsg || 'Service temporarily unavailable' }, 502);
  }
}

export function onRequest() { return methodNotAllowed(); }
