/**
 * Integration & unit tests for Gemini API Proxy (/api/chat, /api/verify-key)
 * and Rate Limiting on open-site-server.cjs.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Import server exports under test
const {
  handleChatRequest,
  handleVerifyKeyRequest,
  handleRequest,
  isRateLimited,
  clearRateLimits,
  TOOL_DEFINITIONS,
  SYSTEM_INSTRUCTION,
  MAX_BODY_BYTES,
  MAX_TURNS
} = require('../open-site-server.cjs');

test('server-side chat API and rate limiting', async (t) => {
  t.beforeEach(() => {
    if (typeof clearRateLimits === 'function') {
      clearRateLimits();
    }
  });

  await t.test('rate limiter throttles requests over 15/minute per IP', () => {
    const ip = '192.168.1.100';
    for (let i = 0; i < 15; i++) {
      assert.equal(isRateLimited(ip), false, `Request ${i + 1} should not be throttled`);
    }
    assert.equal(isRateLimited(ip), true, 'Request 16 should be throttled');
  });

  await t.test('rate limiter resets after sliding window passes', () => {
    const ip = '192.168.1.101';
    const baseTime = 1000000;
    for (let i = 0; i < 15; i++) {
      assert.equal(isRateLimited(ip, 60000, 15, baseTime + i * 100), false);
    }
    assert.equal(isRateLimited(ip, 60000, 15, baseTime + 2000), true);
    // After 60 seconds (60001 ms)
    assert.equal(isRateLimited(ip, 60000, 15, baseTime + 60100), false);
  });

  await t.test('rejects payload exceeding 64KB body limit via content-length', (t, done) => {
    const mockReq = {
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-length': '70000' },
      socket: { remoteAddress: '127.0.0.1' },
      on: (ev, cb) => {
        if (ev === 'data') cb(Buffer.alloc(70000, 'x'));
        if (ev === 'end') cb();
      }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.equal(this.statusCode, 413);
        assert.ok(payload.includes('Payload Too Large'));
        done();
      }
    };
    handleChatRequest(mockReq, mockRes);
  });

  await t.test('rejects payload exceeding 64KB during streaming chunks', (t, done) => {
    const listeners = {};
    const mockReq = {
      method: 'POST',
      url: '/api/chat',
      headers: {}, // no content-length
      socket: { remoteAddress: '127.0.0.2' },
      on: (ev, cb) => { listeners[ev] = cb; },
      pause: () => {},
      resume: () => {},
      destroy: () => {}
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.equal(this.statusCode, 413);
        assert.ok(payload.includes('Payload Too Large'));
        done();
      }
    };
    handleChatRequest(mockReq, mockRes);
    // Send two 35KB chunks = 70KB > 64KB
    listeners['data'](Buffer.alloc(35000, 'a'));
    listeners['data'](Buffer.alloc(35000, 'b'));
  });

  await t.test('enforces rate limit returning HTTP 429 when client exceeds 15 req/min', (t, done) => {
    const ip = '10.0.0.99';
    // Fill up 15 requests
    for (let i = 0; i < 15; i++) {
      isRateLimited(ip);
    }
    const mockReq = {
      method: 'POST',
      url: '/api/chat',
      headers: {},
      socket: { remoteAddress: ip },
      on: () => {}
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.equal(this.statusCode, 429);
        const parsed = JSON.parse(payload);
        assert.ok(parsed.error.includes('Too Many Requests'));
        done();
      }
    };
    handleChatRequest(mockReq, mockRes);
  });

  await t.test('returns 401 when neither server nor client API key is provided', (t, done) => {
    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const mockReq = {
      method: 'POST',
      url: '/api/chat',
      headers: {},
      socket: { remoteAddress: '127.0.0.10' },
      on: (ev, cb) => {
        if (ev === 'data') cb(Buffer.from(JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] })));
        if (ev === 'end') cb();
      }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        process.env.GEMINI_API_KEY = savedKey;
        assert.equal(this.statusCode, 401);
        const parsed = JSON.parse(payload);
        assert.ok(parsed.error.includes('Gemini API key is not configured'));
        done();
      }
    };
    handleChatRequest(mockReq, mockRes);
  });

  await t.test('uses developer override key from x-gemini-api-key header when server key absent', (t, done) => {
    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    let interceptedUrl = null;

    const mockFetch = async (url, options) => {
      interceptedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Hello from developer mode!' }],
              role: 'model'
            }
          }]
        })
      };
    };

    const mockReq = {
      method: 'POST',
      url: '/api/chat',
      headers: { 'x-gemini-api-key': 'dev-override-key-123' },
      socket: { remoteAddress: '127.0.0.11' },
      on: (ev, cb) => {
        if (ev === 'data') cb(Buffer.from(JSON.stringify({ messages: [{ role: 'user', content: 'Test dev' }] })));
        if (ev === 'end') cb();
      }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        process.env.GEMINI_API_KEY = savedKey;
        assert.equal(this.statusCode, 200);
        assert.ok(interceptedUrl.includes('key=dev-override-key-123'));
        const parsed = JSON.parse(payload);
        assert.equal(parsed.text, 'Hello from developer mode!');
        done();
      }
    };

    handleChatRequest(mockReq, mockRes, { fetch: mockFetch });
  });

  await t.test('clamps message history to max 20 turns before forwarding to Gemini', (t, done) => {
    let forwardedContents = null;
    const mockFetch = async (url, options) => {
      forwardedContents = JSON.parse(options.body).contents;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Done' }] } }]
        })
      };
    };

    // Build 25 turns
    const messages = [];
    for (let i = 1; i <= 25; i++) {
      messages.push({ role: i % 2 === 1 ? 'user' : 'model', content: `Turn ${i}` });
    }

    const mockReq = {
      method: 'POST',
      url: '/api/chat',
      headers: { 'x-gemini-api-key': 'dummy-key' },
      socket: { remoteAddress: '127.0.0.12' },
      on: (ev, cb) => {
        if (ev === 'data') cb(Buffer.from(JSON.stringify({ messages })));
        if (ev === 'end') cb();
      }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.equal(this.statusCode, 200);
        assert.ok(forwardedContents.length <= 20, 'Should clamp to <= 20 turns');
        assert.equal(forwardedContents[0].parts[0].text, 'Turn 6');
        assert.equal(forwardedContents[19].parts[0].text, 'Turn 25');
        done();
      }
    };

    handleChatRequest(mockReq, mockRes, { fetch: mockFetch });
  });

  await t.test('tool schemas and function calls are forwarded and extracted properly', (t, done) => {
    let sentTools = null;
    let sentSystemInstruction = null;

    const mockFetch = async (url, options) => {
      const body = JSON.parse(options.body);
      sentTools = body.tools;
      sentSystemInstruction = body.systemInstruction;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [
                { text: 'Navigating to services...' },
                { functionCall: { name: 'scrollToSection', args: { sectionId: 'services' } } }
              ],
              role: 'model'
            }
          }]
        })
      };
    };

    const mockReq = {
      method: 'POST',
      url: '/api/chat',
      headers: { 'x-gemini-api-key': 'dummy-key' },
      socket: { remoteAddress: '127.0.0.13' },
      on: (ev, cb) => {
        if (ev === 'data') cb(Buffer.from(JSON.stringify({ message: 'Take me to services' })));
        if (ev === 'end') cb();
      }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.equal(this.statusCode, 200);
        assert.ok(sentTools && sentTools.length > 0);
        assert.ok(sentSystemInstruction && sentSystemInstruction.parts[0].text.includes('Zada'));

        const parsed = JSON.parse(payload);
        assert.equal(parsed.text, 'Navigating to services...');
        assert.equal(parsed.toolCalls.length, 1);
        assert.equal(parsed.toolCalls[0].name, 'scrollToSection');
        assert.deepEqual(parsed.toolCalls[0].params, { sectionId: 'services' });
        done();
      }
    };

    handleChatRequest(mockReq, mockRes, { fetch: mockFetch });
  });

  await t.test('safe error masking never exposes API key or internal stack traces', (t, done) => {
    const sensitiveKey = 'AIzaSyA_SUPER_SECRET_KEY_12345';
    const mockFetch = async () => {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 400,
            message: `API key ${sensitiveKey} was invalid or expired at /internal/lib/gemini.ts:145`
          }
        })
      };
    };

    const mockReq = {
      method: 'POST',
      url: '/api/chat',
      headers: { 'x-gemini-api-key': sensitiveKey },
      socket: { remoteAddress: '127.0.0.14' },
      on: (ev, cb) => {
        if (ev === 'data') cb(Buffer.from(JSON.stringify({ message: 'Hello' })));
        if (ev === 'end') cb();
      }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.notEqual(this.statusCode, 200);
        assert.ok(!payload.includes(sensitiveKey), 'Payload MUST NOT contain sensitive API key');
        assert.ok(!payload.includes('/internal/lib/gemini.ts'), 'Payload MUST NOT contain internal stack or file paths');
        done();
      }
    };

    handleChatRequest(mockReq, mockRes, { fetch: mockFetch });
  });

  await t.test('verify-key endpoint validates key via probe request', (t, done) => {
    const mockFetch = async (url) => {
      if (url.includes('good-key')) {
        return { ok: true, status: 200, json: async () => ({ models: [] }) };
      }
      return { ok: false, status: 400, json: async () => ({ error: { message: 'Bad key' } }) };
    };

    const mockReq = {
      method: 'POST',
      url: '/api/verify-key',
      headers: { 'x-gemini-api-key': 'good-key' },
      socket: { remoteAddress: '127.0.0.15' },
      on: (ev, cb) => {
        if (ev === 'end') cb();
      }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.equal(this.statusCode, 200);
        const parsed = JSON.parse(payload);
        assert.equal(parsed.valid, true);
        assert.equal(parsed.mode, 'client');
        done();
      }
    };

    handleVerifyKeyRequest(mockReq, mockRes, { fetch: mockFetch });
  });

  await t.test('verify-key returns valid=false on failed verification probe', (t, done) => {
    const mockFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid API key' } })
    });

    const mockReq = {
      method: 'POST',
      url: '/api/verify-key',
      headers: { 'x-gemini-api-key': 'bad-key' },
      socket: { remoteAddress: '127.0.0.16' },
      on: (ev, cb) => {
        if (ev === 'end') cb();
      }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.equal(this.statusCode, 200);
        const parsed = JSON.parse(payload);
        assert.equal(parsed.valid, false);
        assert.ok(parsed.error);
        done();
      }
    };

    handleVerifyKeyRequest(mockReq, mockRes, { fetch: mockFetch });
  });

  await t.test('TOOL_DEFINITIONS exports all five required tools with correct parameters', () => {
    const decls = TOOL_DEFINITIONS[0].functionDeclarations;
    const names = decls.map(d => d.name);
    assert.ok(names.includes('scrollToSection'));
    assert.ok(names.includes('openProjectPreview'));
    assert.ok(names.includes('prefillContactBrief'));
    assert.ok(names.includes('toggleAudioOutput'));
    assert.ok(names.includes('openDevSettings'));
  });

  await t.test('handleRequest router rejects GET /api/chat with 405 Method Not Allowed', (t, done) => {
    const mockReq = {
      method: 'GET',
      url: '/api/chat',
      headers: {},
      socket: { remoteAddress: '127.0.0.17' }
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(payload) {
        assert.equal(this.statusCode, 405);
        assert.equal(this.headers['Allow'], 'POST');
        done();
      }
    };
    handleRequest(mockReq, mockRes);
  });

  await t.test('full HTTP server responds to static files and routes', async () => {
    const server = http.createServer(handleRequest);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const resRoot = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(resRoot.status, 200);
      assert.ok(resRoot.headers.get('content-type').includes('text/html'));
      const textRoot = await resRoot.text();
      assert.ok(textRoot.includes('Webzad'));

      const res404 = await fetch(`http://127.0.0.1:${port}/does-not-exist.png`);
      assert.equal(res404.status, 404);

      const postData = JSON.stringify({ message: 'x'.repeat(70000) });
      const resOversize = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: postData
      });
      assert.equal(resOversize.status, 413);
      const errText = await resOversize.text();
      assert.ok(errText.includes('Payload Too Large'));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});