const test = require('node:test');
const assert = require('node:assert/strict');

// Import server exports under test
const {
  handleVisitorNotification,
  clearVisitorDedup,
  hashVisitorIp,
  extractLocationFromHeaders
} = require('../open-site-server.cjs');

test('Visitor Detection & Email Notification Endpoint (/api/notify-visitor)', async (t) => {
  t.beforeEach(() => {
    if (typeof clearVisitorDedup === 'function') {
      clearVisitorDedup();
    }
  });

  await t.test('hashVisitorIp generates one-way hash without raw IP leakage', () => {
    const ip = '203.0.113.195';
    const hash = hashVisitorIp(ip);
    assert.equal(typeof hash, 'string');
    assert.ok(hash.length >= 16);
    assert.ok(!hash.includes(ip));
    assert.equal(hashVisitorIp(ip), hash); // Deterministic for same IP
    assert.notEqual(hashVisitorIp('203.0.113.196'), hash); // Unique per IP
  });

  await t.test('extractLocationFromHeaders extracts country and city if available', () => {
    const headers = {
      'cf-ipcountry': 'US',
      'cf-ipcity': 'New York'
    };
    const loc = extractLocationFromHeaders(headers);
    assert.equal(loc, 'New York, US');

    const headersCountryOnly = {
      'cf-ipcountry': 'GB'
    };
    assert.equal(extractLocationFromHeaders(headersCountryOnly), 'GB');

    const headersEmpty = {};
    assert.equal(extractLocationFromHeaders(headersEmpty), 'Undisclosed / Direct');
  });

  await t.test('new visitor triggers notification and dispatches to FormSubmit', async () => {
    let dispatchedUrl = '';
    let dispatchedBody = null;

    const mockFetch = async (url, opts) => {
      dispatchedUrl = url;
      dispatchedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      };
    };

    const mockReq = {
      method: 'POST',
      url: '/api/notify-visitor',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0',
        'cf-ipcountry': 'US',
        'cf-ipcity': 'San Francisco'
      },
      socket: { remoteAddress: '198.51.100.42' },
      on: (ev, cb) => {
        if (ev === 'data') {
          cb(Buffer.from(JSON.stringify({
            device: 'Desktop',
            browser: 'Chrome on Windows 10',
            screen: '1920x1080',
            referrer: 'https://news.ycombinator.com',
            path: '/',
            timezone: 'America/Los_Angeles'
          })));
        }
        if (ev === 'end') cb();
      }
    };

    let responseStatus = 0;
    let responseBody = null;
    const mockRes = {
      statusCode: 200,
      setHeader() {},
      end(body) {
        responseStatus = this.statusCode;
        responseBody = JSON.parse(body);
      }
    };

    await handleVisitorNotification(mockReq, mockRes, { fetchFn: mockFetch });

    assert.equal(responseStatus, 200);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.notified, true);

    // Verify FormSubmit payload
    assert.ok(dispatchedUrl.includes('formsubmit.co/ajax/f11c4df9cac5fcb3a134c796bf5ee19c'));
    assert.ok(dispatchedBody._subject.includes('New Webzad Visitor'));
    assert.equal(dispatchedBody['Device & Platform'], 'Desktop (Chrome on Windows 10)');
    assert.equal(dispatchedBody['Approximate Location'], 'San Francisco, US');
    assert.equal(dispatchedBody['Referral Source'], 'https://news.ycombinator.com');
    // Ensure raw IP is NEVER in email payload
    assert.ok(!JSON.stringify(dispatchedBody).includes('198.51.100.42'));
  });

  await t.test('deduplication prevents repeat notifications for same visitor in cooldown window', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return { ok: true, json: async () => ({}) };
    };

    const makeReq = () => ({
      method: 'POST',
      url: '/api/notify-visitor',
      headers: { 'user-agent': 'Chrome Test' },
      socket: { remoteAddress: '198.51.100.77' },
      on: (ev, cb) => {
        if (ev === 'data') cb(Buffer.from(JSON.stringify({ device: 'Mobile' })));
        if (ev === 'end') cb();
      }
    });

    let resBody1 = null;
    const res1 = { statusCode: 200, setHeader() {}, end(b) { resBody1 = JSON.parse(b); } };
    await handleVisitorNotification(makeReq(), res1, { fetchFn: mockFetch });

    assert.equal(resBody1.notified, true);
    assert.equal(callCount, 1);

    // Second immediate request from same IP
    let resBody2 = null;
    const res2 = { statusCode: 200, setHeader() {}, end(b) { resBody2 = JSON.parse(b); } };
    await handleVisitorNotification(makeReq(), res2, { fetchFn: mockFetch });

    assert.equal(resBody2.notified, false);
    assert.equal(resBody2.reason, 'cooldown');
    assert.equal(callCount, 1); // No second email sent!
  });
});
