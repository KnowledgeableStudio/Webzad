const test = require('node:test');
const assert = require('node:assert/strict');
const { ZadaMotionController } = require('../assets/js/zada-motion.js');

test('ZadaMotionController kinematics and delta-time invariance', async (t) => {
  await t.test('delta time updates position smoothly', () => {
    const motion = new ZadaMotionController();
    motion.update(0.016, 0, { x: 0, y: 0 });
    const t1 = motion.getTransform();
    assert.ok(typeof t1.position.y === 'number');
    assert.ok(Math.abs(t1.position.y) < 1.0);
  });

  await t.test('audio scale pulse never exceeds 4%', () => {
    const motion = new ZadaMotionController();
    motion.update(0.016, 1.0, { x: 0, y: 0 });
    const t = motion.getTransform();
    assert.ok(t.scale <= 1.04, `Scale ${t.scale} must be <= 1.04`);
    assert.ok(t.scale >= 1.0, `Scale ${t.scale} must be >= 1.0`);

    // Extreme audio level test
    motion.update(0.016, 10.0, { x: 0, y: 0 });
    const tExtreme = motion.getTransform();
    assert.ok(tExtreme.scale <= 1.04, `Extreme scale ${tExtreme.scale} must be <= 1.04`);
  });

  await t.test('reduced motion clamps oscillations and rotation', () => {
    const motion = new ZadaMotionController({ reducedMotion: true });
    motion.update(1.0, 0, { x: 1, y: 1 });
    const t = motion.getTransform();
    assert.equal(t.position.x, 0);
    assert.equal(t.position.y, 0);
    assert.equal(t.position.z, 0);
    assert.equal(t.rotation.x, 0);
    assert.equal(t.rotation.y, 0);
    assert.equal(t.rotation.z, 0);
  });

  await t.test('cursor tracking limits rotation angle to max 12 degrees (~0.21 rad)', () => {
    const motion = new ZadaMotionController();
    // Pass large cursor coordinates
    for (let i = 0; i < 60; i++) {
      motion.update(0.016, 0, { x: 10.0, y: 10.0 });
    }
    const t = motion.getTransform();
    assert.ok(Math.abs(t.rotation.x) <= 0.22, `Rotation X ${t.rotation.x} must be <= 0.22`);
    assert.ok(Math.abs(t.rotation.y) <= 0.22, `Rotation Y ${t.rotation.y} must be <= 0.22`);
  });

  await t.test('cursor deadzone ignores micro-movements near origin', () => {
    const motion = new ZadaMotionController();
    // Cursor within deadzone (hypot(0.04, 0.04) ~= 0.0566 < 0.08)
    motion.update(0.016, 0, { x: 0.04, y: 0.04 });
    const t = motion.getTransform();
    assert.equal(t.rotation.x, 0);
    assert.equal(t.rotation.y, 0);
  });

  await t.test('delta-time invariance across 30Hz, 60Hz, and 120Hz simulations', () => {
    const m30 = new ZadaMotionController();
    for (let i = 0; i < 30; i++) {
      m30.update(1 / 30, 0, { x: 0, y: 0 });
    }

    const m60 = new ZadaMotionController();
    for (let i = 0; i < 60; i++) {
      m60.update(1 / 60, 0, { x: 0, y: 0 });
    }

    const m120 = new ZadaMotionController();
    for (let i = 0; i < 120; i++) {
      m120.update(1 / 120, 0, { x: 0, y: 0 });
    }

    const t30 = m30.getTransform();
    const t60 = m60.getTransform();
    const t120 = m120.getTransform();

    assert.ok(Math.abs(t30.position.y - t60.position.y) < 1e-4);
    assert.ok(Math.abs(t60.position.y - t120.position.y) < 1e-4);
  });

  await t.test('audio envelope applies attack and release smoothing', () => {
    const motion = new ZadaMotionController();
    // Single 16ms step of max raw volume: attack rate (~60*dt = 0.96)
    motion.update(0.016, 1.0, { x: 0, y: 0 });
    const env1 = motion.audioEnvelope;
    assert.ok(env1 > 0 && env1 <= 1.0);

    // Audio drops to 0: release rate (~8*dt = 0.128) smooths decay
    motion.update(0.016, 0.0, { x: 0, y: 0 });
    const env2 = motion.audioEnvelope;
    assert.ok(env2 < env1, 'Audio envelope should decay on release');
    assert.ok(env2 > 0, 'Audio envelope should not drop to 0 instantly');
  });

  await t.test('setReducedMotion dynamically updates behavior at runtime', () => {
    const motion = new ZadaMotionController();
    motion.update(1.0, 0, { x: 1.0, y: 1.0 });
    assert.notEqual(motion.getTransform().position.y, 0);

    motion.setReducedMotion(true);
    motion.update(0.016, 0, { x: 1.0, y: 1.0 });
    const t = motion.getTransform();
    assert.equal(t.position.y, 0);
    assert.equal(t.rotation.x, 0);
    assert.equal(t.rotation.y, 0);
    assert.equal(t.rotation.z, 0);

    motion.setReducedMotion(false);
    motion.update(0.016, 0, { x: 1.0, y: 1.0 });
    assert.notEqual(motion.getTransform().position.y, 0);
  });

  await t.test('getTransform returns decoupled clone preventing state mutation', () => {
    const motion = new ZadaMotionController();
    motion.update(0.016, 0, { x: 0, y: 0 });
    const t = motion.getTransform();
    t.position.y = 999;
    t.rotation.x = 999;

    const t2 = motion.getTransform();
    assert.notEqual(t2.position.y, 999);
    assert.notEqual(t2.rotation.x, 999);
  });

  await t.test('handles edge case inputs safely (null cursor, negative/zero dt)', () => {
    const motion = new ZadaMotionController();
    assert.doesNotThrow(() => {
      motion.update(0, 0, null);
      motion.update(-0.016, -1.0, undefined);
      motion.update(NaN, NaN, {});
    });
  });
});