/**
 * ZadaVisitorTracker - Privacy-Respecting Client Visitor Detection & Telemetry Beacon.
 * Notifies the backend when a new visitor lands, deduplicates across browser sessions,
 * and strictly honors Do Not Track preferences without collecting personal information.
 */

const SESSION_STORAGE_KEY = 'webzad_visited_session';

/** Resolves cross-origin API base: webzad.dev on static hosting proxies API calls to the Pages Functions origin. */
var ZADA_API_BASE = (typeof location !== 'undefined' && /^(www\.)?webzad\.dev$/.test(location.hostname)) ? 'https://webzad.pages.dev' : '';

class ZadaVisitorTracker {
  /**
   * @param {Object} [options] - Configuration and environment options.
   */
  constructor(options = {}) {
    this.options = options;
    this.env = options.env || this._resolveEnvironment();
    this.endpoint = options.endpoint || (ZADA_API_BASE + '/api/notify-visitor');
    this.fetchFn = options.fetchFn || (typeof globalThis !== 'undefined' ? globalThis.fetch : null);
  }

  /**
   * Resolves runtime browser environment objects safely.
   * @private
   */
  _resolveEnvironment() {
    return {
      sessionStorage: typeof sessionStorage !== 'undefined' ? sessionStorage : null,
      navigator: typeof navigator !== 'undefined' ? navigator : null,
      screen: typeof screen !== 'undefined' ? screen : null,
      window: typeof window !== 'undefined' ? window : null,
      document: typeof document !== 'undefined' ? document : null
    };
  }

  /**
   * Infers device category from screen width and User-Agent hints.
   * @param {number} width - Viewport width in pixels.
   * @param {string} ua - Navigator userAgent string.
   * @returns {'Mobile'|'Tablet'|'Desktop'}
   */
  static getDeviceType(width = 1200, ua = '') {
    const s = String(ua || '').toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(s) || (width >= 768 && width <= 1024)) {
      return 'Tablet';
    }
    if (/(mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop)/i.test(s) || width < 768) {
      return 'Mobile';
    }
    return 'Desktop';
  }

  /**
   * Parses human-readable browser brand from User-Agent.
   * @param {string} ua - Navigator userAgent string.
   * @returns {string}
   */
  static getBrowserName(ua = '') {
    const s = String(ua || '');
    if (/Edg\//i.test(s)) return 'Microsoft Edge';
    if (/Chrome\//i.test(s) && !/Chromium|Edg/i.test(s)) return 'Chrome';
    if (/Safari\//i.test(s) && !/Chrome|Chromium/i.test(s)) return 'Safari';
    if (/Firefox\//i.test(s)) return 'Firefox';
    if (/Opera|OPR\//i.test(s)) return 'Opera';
    return 'Web Browser';
  }

  /**
   * Gathers non-PII telemetry and transmits beacon if session is new and DNT is not set.
   * @returns {Promise<{ sent: boolean, reason?: string }>}
   */
  async trackVisit() {
    const env = this.env;
    if (!env) return { sent: false, reason: 'no_environment' };

    // Respect Do Not Track privacy preference
    const dnt = env.navigator?.doNotTrack || (env.window && env.window.doNotTrack);
    if (dnt === '1' || dnt === 'yes') {
      return { sent: false, reason: 'do_not_track' };
    }

    // Deduplicate per browser session
    try {
      if (env.sessionStorage && env.sessionStorage.getItem(SESSION_STORAGE_KEY)) {
        return { sent: false, reason: 'session_exists' };
      }
    } catch {}

    const width = env.window?.innerWidth || env.screen?.width || 1200;
    const ua = env.navigator?.userAgent || '';
    const device = ZadaVisitorTracker.getDeviceType(width, ua);
    const browser = ZadaVisitorTracker.getBrowserName(ua);
    const screenRes = `${env.screen?.width || 0}x${env.screen?.height || 0}`;
    const referrer = env.document?.referrer || 'Direct Visit';
    const landingPath = (env.window?.location?.pathname || '/') + (env.window?.location?.hash || '');

    let timezone = 'UTC';
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      }
    } catch {}

    const payload = {
      device,
      browser,
      screen: screenRes,
      referrer,
      path: landingPath,
      timezone,
      timestamp: Date.now()
    };

    try {
      if (typeof this.fetchFn === 'function') {
        await this.fetchFn(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        });
      }
      try {
        if (env.sessionStorage) {
          env.sessionStorage.setItem(SESSION_STORAGE_KEY, String(Date.now()));
        }
      } catch {}
      return { sent: true };
    } catch (err) {
      // Mark session even on network failure to avoid spamming errors
      try {
        if (env.sessionStorage) {
          env.sessionStorage.setItem(SESSION_STORAGE_KEY, String(Date.now()));
        }
      } catch {}
      return { sent: false, reason: err.message };
    }
  }

  /**
   * Automatically initializes tracker on page load.
   */
  static init(options = {}) {
    const tracker = new ZadaVisitorTracker(options);
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
        tracker.trackVisit();
      } else {
        window.addEventListener('load', () => tracker.trackVisit(), { once: true });
      }
    }
    return tracker;
  }
}

// Auto-initialize when loaded in browser unless explicitly disabled
if (typeof window !== 'undefined' && !window.__ZADA_DISABLE_AUTO_VISITOR__) {
  ZadaVisitorTracker.init();
}

// Universal export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZadaVisitorTracker, SESSION_STORAGE_KEY };
}
if (typeof window !== 'undefined') {
  window.ZadaVisitorTracker = ZadaVisitorTracker;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ZadaVisitorTracker = ZadaVisitorTracker;
}
