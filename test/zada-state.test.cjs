// test/zada-state.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');

// Import state machine module
const { ZadaStateManager, ZadaStates, VALID_TRANSITIONS } = require('../assets/js/zada-state.js');
test('ZadaStateManager deterministic transitions & debouncing', async (t) => {
  await t.test('initial state defaults to WELCOME or IDLE', () => {
    const smWelcome = new ZadaStateManager({ initial: ZadaStates.WELCOME });
    assert.equal(smWelcome.getState(), 'WELCOME');

    const smDefault = new ZadaStateManager();
    assert.equal(smDefault.getState(), 'IDLE');
  });

  await t.test('valid transition updates state and notifies subscribers', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.IDLE });
    let notified = null;
    sm.subscribe((state, prev, payload) => {
      notified = { state, prev, payload };
    });

    const transitioned = sm.setState(ZadaStates.LISTENING, { source: 'user-click' });
    assert.ok(transitioned);
    assert.equal(sm.getState(), 'LISTENING');
    assert.equal(sm.getPreviousState(), 'IDLE');
    assert.deepEqual(notified, {
      state: 'LISTENING',
      prev: 'IDLE',
      payload: { source: 'user-click' }
    });
  });

  await t.test('same-state transition returns true and avoids redundant notify', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.IDLE });
    let notifyCount = 0;
    sm.subscribe(() => { notifyCount++; });

    const result = sm.setState(ZadaStates.IDLE);
    assert.equal(result, true);
    assert.equal(notifyCount, 0);
    assert.equal(sm.getState(), 'IDLE');
   });

  await t.test('invalid transition is rejected safely', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.GOODBYE });
    const transitioned = sm.setState(ZadaStates.RESPONDING);
    assert.equal(transitioned, false);
    assert.equal(sm.getState(), 'GOODBYE');
  });

  await t.test('debouncing prevents rapid state transitions within debounceMs window', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.IDLE, debounceMs: 50 });
    const firstOk = sm.setState(ZadaStates.LISTENING);
    assert.equal(firstOk, true);

    // Immediate second transition must be rejected by debounce guard
    const rapidSecond = sm.setState(ZadaStates.THINKING);
    assert.equal(rapidSecond, false);
    assert.equal(sm.getState(), 'LISTENING');
  });

  await t.test('transition succeeds after debounceMs elapsed', async () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.IDLE, debounceMs: 20 });
    const firstOk = sm.setState(ZadaStates.LISTENING);
    assert.equal(firstOk, true);

    await new Promise((resolve) => setTimeout(resolve, 30));

    const delayedOk = sm.setState(ZadaStates.THINKING);
    assert.equal(delayedOk, true);
    assert.equal(sm.getState(), 'THINKING');
  });

  await t.test('interruption resets active state cleanly', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.RESPONDING });
    let interruptedWith = null;
    sm.subscribe((state, prev) => { interruptedWith = { state, prev }; });

    const result = sm.interrupt(ZadaStates.LISTENING);
    assert.equal(result, true);
    assert.equal(sm.getState(), 'LISTENING');
    assert.equal(sm.getPreviousState(), 'RESPONDING');
    assert.deepEqual(interruptedWith, { state: 'LISTENING', prev: 'RESPONDING' });
  });

  await t.test('subscribe returns an unsubscribe function', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.IDLE, debounceMs: 0 });
    let count = 0;
    const unsubscribe = sm.subscribe(() => { count++; });

    sm.setState(ZadaStates.LISTENING);
    assert.equal(count, 1);

    unsubscribe();
    sm.setState(ZadaStates.THINKING);
    assert.equal(count, 1);
  });

  await t.test('subscriber errors do not crash notify loop or state update', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.IDLE, debounceMs: 0 });
    let secondCalled = false;

    sm.subscribe(() => {
      throw new Error('Subscriber failure simulation');
    });
    sm.subscribe(() => {
      secondCalled = true;
    });

    const transitioned = sm.setState(ZadaStates.LISTENING);
    assert.equal(transitioned, true);
    assert.equal(sm.getState(), 'LISTENING');
    assert.equal(secondCalled, true);
  });

  await t.test('on(event, fn) listens for specific state change or general changes', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.IDLE, debounceMs: 0 });
    let listeningTriggered = false;

    sm.on('this.LISTENING', () => {});
    sm.on('this.change', () => {});
    sm.on('LISTENING', (state) => {
      if (state === 'LISTENING') listeningTriggered = true;
    });

    sm.setState(ZadaStates.LISTENING);
    assert.equal(listeningTriggered, true);
  });

  await t.test('exports valid states and transition map constants', () => {
    assert.ok(ZadaStates.WELCOME);
    assert.ok(ZadaStates.IDLE);
    assert.ok(ZadaStates.GOODBYE);
    assert.ok(VALID_TRANSITIONS.WELCOME.includes('IDLE'));
    assert.ok(VALID_TRANSITIONS.NAVIGATING.includes('SUCCESS'));
  });
});
