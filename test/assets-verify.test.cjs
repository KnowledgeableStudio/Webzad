// test/assets-verify.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('assets pipeline verification', async (t) => {
  await t.test('zada.glb exists and is non-empty', () => {
    const glbPath = path.join(__dirname, '..', 'assets', 'zada.glb');
    assert.ok(fs.existsSync(glbPath), 'assets/zada.glb must exist');
    const stats = fs.statSync(glbPath);
    assert.ok(stats.size > 10000000, 'assets/zada.glb should be ~24MB');
  });

  await t.test('vendor libraries exist', () => {
    const threePath = path.join(__dirname, '..', 'assets', 'vendor', 'three.module.js');
    const loaderPath = path.join(__dirname, '..', 'assets', 'vendor', 'GLTFLoader.js');
    assert.ok(fs.existsSync(threePath), 'three.module.js must exist');
    assert.ok(fs.existsSync(loaderPath), 'GLTFLoader.js must exist');
    assert.ok(fs.statSync(threePath).size > 100000, 'three.module.js should be substantial');
    assert.ok(fs.statSync(loaderPath).size > 10000, 'GLTFLoader.js should be substantial');
  });

  await t.test('vendor libraries are valid ES modules', async () => {
    const THREE = await import('../assets/vendor/three.module.js');
    assert.ok(THREE.Scene, 'THREE.Scene must be exported');
    const { GLTFLoader } = await import('../assets/vendor/GLTFLoader.js');
    assert.equal(typeof GLTFLoader, 'function', 'GLTFLoader must be a class/function');
  });
});
