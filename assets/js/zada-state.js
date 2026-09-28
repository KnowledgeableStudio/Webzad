/**
 * ZadaStateManager - Authoritative Single Source of Truth for Zada AI Companion.
 * Coordinates state transitions across 3D renderer, procedural kinematics,
 * aura, audio sync, holographic HUD, and action gate.
 */

/**
 * Authoritative Zada companion states.
 * @readonly
 * @enum {string}
 */
const ZadaStates = Object.freeze({
  WELCOME: 'WELCOME',
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  RESPONDING: 'RESPONDING',
  NAVIGATING: 'NAVIGATING',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  GOODBYE: 'GOODBYE'
});

/**
 * Valid directed state transitions enforcing deterministic conversational flow.
 * @readonly
 */
const VALID_TRANSITIONS = Object.freeze({
  WELCOME: Object.freeze(['IDLE', 'ERROR']),
  IDLE: Object.freeze(['LISTENING', 'THINKING', 'NAVIGATING', 'GOODBYE', 'WARNING', 'ERROR']),
  LISTENING: Object.freeze(['THINKING', 'IDLE', 'WARNING', 'ERROR']),
  THINKING: Object.freeze(['RESPONDING', 'IDLE', 'NAVIGATING', 'WARNING', 'ERROR']),
  RESPONDING: Object.freeze(['IDLE', 'LISTENING', 'WARNING', 'ERROR']),
  NAVIGATING: Object.freeze(['SUCCESS', 'IDLE', 'WARNING', 'ERROR']),
  SUCCESS: Object.freeze(['IDLE']),
  WARNING: Object.freeze(['IDLE']),
  ERROR: Object.freeze(['IDLE']),
  GOODBYE: Object.freeze(['IDLE', 'WELCOME'])
});

/**
 * Authoritative Central State Machine for Zada.
 */
class ZadaStateManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.initial='IDLE'] - Initial state.
   * @param {number} [options.debounceMs=50] - Debounce window in ms.
   */
  constructor(options = {}) {
    this.state = options.initial && ZadaStates[options.initial] ? options.initial : ZadaStates.IDLE;
    this.previousState = null;
    this.subscribers = new Set();
    this.payload = null;
    // Initialized to 0 so the first transition after creation is not blocked by debounce.
    this.lastTransitionTime = 0;
    this.debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 50;
  }

  /** @returns {string} Current authoritative state */
  getState() {
    return this.state;
  }

  /** @returns {string|null} Previous state before last transition */
  getPreviousState() {
    return this.previousState;
  }

  /** @returns {*} Payload of current transition */
  getPayload() {
    return this.payload;
  }

  /**
   * Transitions to a new state if valid and debounce duration has elapsed.
   * @param {string} newState - Target state.
   * @param {*} [payload=null] - Optional transition metadata.
   * @returns {boolean} True if transition succeeded.
   */
  setState(newState, payload = null) {
    if (newState === this.state) return true;
    const now = Date.now();
    if (now - this.lastTransitionTime < this.debounceMs) return false;
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(newState)) return false;

    this.previousState = this.state;
    this.state = newState;
    this.payload = payload;
    this.lastTransitionTime = now;
    this.notify();
    return true;
  }

  /**
   * Forcefully interrupts active state and resets cleanly to target state.
   * @param {string} [targetState='LISTENING'] - Target state after interrupt.
   * @returns {boolean} True if interruption succeeded.
   */
  interrupt(targetState = ZadaStates.LISTENING) {
    if (!targetState || !ZadaStates[targetState]) return false;
    this.previousState = this.state;
    this.state = targetState;
    this.payload = null;
    this.lastTransitionTime = Date.now();
    this.notify();
    return true;
  }

  /**
   * Subscribes a listener to state changes.
   * @param {Function} fn - Callback receiving (state, previousState, payload).
   * @returns {Function} Unsubscribe callback.
   */
  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /**
   * Event-style listener subscription for specific states or general changes.
   * @param {string} event - Target state name or 'change'.
   * @param {Function} fn - Callback receiving (state, previousState, payload).
   * @returns {Function} Unsubscribe callback.
   */
  on(event, fn) {
    if (typeof fn !== 'function') return () => {};
    return this.subscribe((state, prev, payload) => {
      if (!event || event === 'change' || event === state) {
        fn(state, prev, payload);
      }
    });
  }

  /** Dispatches state changes to subscribers, isolating individual callback errors. */
  notify() {
    for (const fn of this.subscribers) {
      try {
        fn(this.state, this.previousState, this.payload);
      } catch (err) {
        console.error('Subscriber error in ZadaStateManager:', err);
      }
    }
  }
}

// Universal module export for CommonJS, Browser Window, and global environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZadaStateManager, ZadaStates, VALID_TRANSITIONS };
}
if (typeof window !== 'undefined') {
  window.ZadaStateManager = ZadaStateManager;
  window.ZadaStates = ZadaStates;
  window.VALID_TRANSITIONS = VALID_TRANSITIONS;
} else if (typeof globalThis !== 'undefined') {
  globalThis.ZadaStateManager = ZadaStateManager;
  globalThis.ZadaStates = ZadaStates;
  globalThis.VALID_TRANSITIONS = VALID_TRANSITIONS;
}
