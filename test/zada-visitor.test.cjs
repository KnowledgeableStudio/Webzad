const test = require('node:test');
const assert = require('node:assert/strict');

// Headless DOM & Storage mocks
function createMockEnvironment(overrides = {}) {
  const sessionStorageStore = new Map();
  return {
    sessionStorage: {
      getItem: (k) => sessionStorageStore.get(k) || null,
      setItem: (k, v) => sessionStorageStore.set(k, String(v)),
      removeItem: (k) => sessionStorageStore.delete(k),
      clear: () => sessionStorageStore.clear()
    },
    navigator: {
      doNotTrack: overrides.doNotTrack || '0',
      userAgent: overrides.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36'
    },
    screen: {
      width: overrides.screenWidth || 1920,
      height: overrides.screenHeight || 1080
    },
    window: {
      innerWidth: overrides.innerWidth || 1440,
      innerHeight: overrides.innerHeight || 900,
      location: {
        pathname: overrides.pathname || '/',
        hash: overrides.hash || ''
      }
    },
    document: {
      referrer: overrides.referrer || 'https://google.com'
    }
  };
}

const { ZadaVisitorTracker } = require('../assets/js/zada-visitor.js');

test('ZadaVisitorTracker client telemetry & deduplication', async (t) => {
  await t.test('detects device type accurately based on viewport width and user-agent', () => {
    assert.equal(ZadaVisitorTracker.getDeviceType(375, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'Mobile');
    assert.equal(ZadaVisitorTracker.getDeviceType(820, 'Mozilla/5.0 (iPad; CPU OS 17_0)'), 'Tablet');
    assert.equal(ZadaVisitorTracker.getDeviceType(1440, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Desktop');
  });

  await t.test('detects browser name cleanly from user agent', () => {
    assert.ok(ZadaVisitorTracker.getBrowserName('Mozilla/5.0 Chrome/126.0.0.0').includes('Chrome'));
    assert.ok(ZadaVisitorTracker.getBrowserName('Mozilla/5.0 Safari/605.1.15').includes('Safari'));
    assert.ok(ZadaVisitorTracker.getBrowserName('Mozilla/5.0 Firefox/128.0').includes('Firefox'));
    assert.ok(ZadaVisitorTracker.getBrowserName('Mozilla/5.0 Edg/126.0.0.0').includes('Edge'));
  });

  await t.test('sends visitor beacon on fresh session and records sessionStorage token', async () => {
    const env = createMockEnvironment();
    let sentUrl = '';
    let sentBody = null;

    const mockFetch = async (url, opts) => {
      sentUrl = url;
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ success: true, notified: true }) };
    };

    const tracker = new ZadaVisitorTracker({
      env,
      fetchFn: mockFetch,
      endpoint: '/api/notify-visitor'
    });

    const result = await tracker.trackVisit();
    assert.equal(result.sent, true);
    assert.equal(sentUrl, '/api/notify-visitor');
    assert.equal(sentBody.device, 'Desktop');
    assert.equal(sentBody.referrer, 'https://google.com');
    assert.equal(env.sessionStorage.getItem('webzad_visited_session') !== null, true);

    // Second call in same session should NOT send beacon
    sentUrl = '';
    const secondResult = await tracker.trackVisit();
    assert.equal(secondResult.sent, false);
    assert.equal(secondResult.reason, 'session_exists');
    assert.equal(sentUrl, '');
  });

  await t.test('respects Do Not Track preference without sending telemetry', async () => {
    const env = createMockEnvironment({ doNotTrack: '1' });
    let sent = false;
    const mockFetch = async () => { sent = true; return { ok: true }; };

    const tracker = new ZadaVisitorTracker({
      env,
      fetchFn: mockFetch
    });

    const result = await tracker.trackVisit();
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'do_not_track');
    assert.equal(sent, false);
  });
});
