const test = require('node:test');
const assert = require('node:assert/strict');
const { ZadaAura, ZadaAuraConfig } = require('../assets/js/zada-aura.js');

/**
 * Creates a mock Three.js factory for headless testing.
 */
function createMockThree() {
  let disposedCount = 0;

  class MockGeometry {
    constructor() {
      this.disposed = false;
      this.attributes = {};
    }
    setAttribute(name, attr) {
      this.attributes[name] = attr;
      this[name] = attr;
    }
    dispose() {
      this.disposed = true;
      disposedCount++;
    }
  }

  class MockMaterial {
    constructor(opts = {}) {
      Object.assign(this, opts);
      this.disposed = false;
    }
    dispose() {
      this.disposed = true;
      disposedCount++;
    }
  }

  class MockObject3D {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.rotation = { x: 0, y: 0, z: 0 };
    }
  }

  class MockGroup {
    constructor() {
      this.children = [];
      this.name = '';
    }
    add(child) {
      this.children.push(child);
    }
  }

  class MockBufferAttribute {
    constructor(array, itemSize) {
      this.array = array;
      this.itemSize = itemSize;
      this.count = array.length / itemSize;
    }
  }

  return {
    Group: MockGroup,
    SphereGeometry: class extends MockGeometry {
      constructor(radius, widthSegments, heightSegments) {
        super();
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;
      }
    },
    TorusGeometry: class extends MockGeometry {
      constructor(radius, tube, radialSegments, tubularSegments) {
        super();
        this.radius = radius;
        this.tube = tube;
        this.radialSegments = radialSegments;
        this.tubularSegments = tubularSegments;
      }
    },
    BufferGeometry: MockGeometry,
    BufferAttribute: MockBufferAttribute,
    MeshBasicMaterial: MockMaterial,
    PointsMaterial: MockMaterial,
    Mesh: MockObject3D,
    Points: MockObject3D,
    AdditiveBlending: 2,
    BackSide: 1,
    getDisposedCount: () => disposedCount
  };
}

test('ZadaAura configuration & bounds verification', async (t) => {
  await t.test('maximum aura scale boundary is strictly clamped to 1.40x', () => {
    assert.ok(ZadaAuraConfig.MAX_SCALE_FACTOR <= 1.40, 'Max scale factor must not exceed 1.40');
    assert.equal(ZadaAuraConfig.CORE_SCALE_FACTOR, 1.15);
    assert.equal(ZadaAuraConfig.RING_SCALE_FACTOR, 1.25);
    assert.ok(ZadaAuraConfig.PARTICLE_MAX_RADIUS <= 1.40);
    assert.equal(ZadaAuraConfig.PARTICLE_MAX_RADIUS, 1.35);
  });

  await t.test('ZadaAuraConfig is an immutable frozen object', () => {
    assert.ok(Object.isFrozen(ZadaAuraConfig));
  });

  await t.test('build creates a group with core, ring, and particle objects', () => {
    const mockThree = createMockThree();
    const aura = new ZadaAura(mockThree);
    const group = aura.build(1.0, 3);

    assert.ok(group);
    assert.equal(group.name, 'ZadaAuraGroup');
    assert.equal(group.children.length, 3);
    assert.ok(aura.coreMesh);
    assert.ok(aura.ringMesh);
    assert.ok(aura.particles);
  });

  await t.test('build configures core and ring geometry scales accurately', () => {
    const mockThree = createMockThree();
    const aura = new ZadaAura(mockThree);
    aura.build(2.0, 3);

    assert.equal(aura.coreMesh.geometry.radius, 2.0 * ZadaAuraConfig.CORE_SCALE_FACTOR);
    assert.equal(aura.ringMesh.geometry.radius, 2.0 * ZadaAuraConfig.RING_SCALE_FACTOR);
    assert.ok(Math.abs(aura.ringMesh.rotation.x - Math.PI / 2.3) < 1e-4);
  });

  await t.test('tiered particle counts generate correct buffer sizes', () => {
    const mockThree = createMockThree();

    // Tier 3: 75 particles (75 * 3 = 225 coordinates)
    const aura3 = new ZadaAura(mockThree);
    aura3.build(1.0, 3);
    const pos3 = aura3.particles.geometry.position.array;
    assert.equal(pos3.length, 75 * 3);

    // Tier 2: 40 particles (40 * 3 = 120 coordinates)
    const aura2 = new ZadaAura(mockThree);
    aura2.build(1.0, 2);
    const pos2 = aura2.particles.geometry.position.array;
    assert.equal(pos2.length, 40 * 3);

    // Tier 1: 20 particles (20 * 3 = 60 coordinates)
    const aura1 = new ZadaAura(mockThree);
    aura1.build(1.0, 1);
    const pos1 = aura1.particles.geometry.position.array;
    assert.equal(pos1.length, 20 * 3);

    // Default fallback tier is Tier 3
    const auraDef = new ZadaAura(mockThree);
    auraDef.build(1.0);
    const posDef = auraDef.particles.geometry.position.array;
    assert.equal(posDef.length, 75 * 3);
  });

  await t.test('all particles strictly conform to [1.15, 1.35] radius invariant', () => {
    const mockThree = createMockThree();
    const aura = new ZadaAura(mockThree);
    const baseRadius = 2.5;
    aura.build(baseRadius, 3);

    const positions = aura.particles.geometry.position.array;
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const r = Math.hypot(x, y, z);

      assert.ok(r >= baseRadius * 1.149, `Particle radius ${r} must be >= 1.15x`);
      assert.ok(r <= baseRadius * 1.3501, `Particle radius ${r} must be <= 1.35x`);
      assert.ok(r <= baseRadius * ZadaAuraConfig.MAX_SCALE_FACTOR, `Particle radius ${r} must not exceed 1.40x`);
    }
  });

  await t.test('update modulates ring and core opacity without errors', () => {
    const mockThree = createMockThree();
    const aura = new ZadaAura(mockThree);
    aura.build(1.0, 2);

    aura.update(0.016, 'THINKING', 0.5);
    assert.ok(aura.coreMesh.material.opacity <= 0.55);
  });

  await t.test('update drives faster ring speed in THINKING state', () => {
    const mockThree = createMockThree();

    const auraThinking = new ZadaAura(mockThree);
    auraThinking.build(1.0, 3);
    auraThinking.update(0.1, 'THINKING', 0);

    const auraIdle = new ZadaAura(mockThree);
    auraIdle.build(1.0, 3);
    auraIdle.update(0.1, 'IDLE', 0);

    assert.ok(auraThinking.ringMesh.rotation.z > auraIdle.ringMesh.rotation.z, 'Ring should spin faster during THINKING');
    assert.ok(Math.abs(auraThinking.ringMesh.rotation.z - 0.3) < 1e-4);
    assert.ok(Math.abs(auraIdle.ringMesh.rotation.z - 0.08) < 1e-4);
  });

  await t.test('audio reactivity clamps boost strictly to +25%', () => {
    const mockThree = createMockThree();
    const aura = new ZadaAura(mockThree);
    aura.build(1.0, 3);

    // IDLE baseline: 0.18
    aura.update(0.016, 'IDLE', 0.0);
    assert.ok(Math.abs(aura.coreMesh.material.opacity - 0.18) < 1e-4);

    // IDLE with max audio (1.0): 0.18 + 0.25 = 0.43
    aura.update(0.016, 'IDLE', 1.0);
    assert.ok(Math.abs(aura.coreMesh.material.opacity - 0.43) < 1e-4);

    // IDLE with extreme audio (10.0): should clamp to 0.43
    aura.update(0.016, 'IDLE', 10.0);
    assert.ok(Math.abs(aura.coreMesh.material.opacity - 0.43) < 1e-4);

    // LISTENING baseline: 0.26
    aura.update(0.016, 'LISTENING', 0.0);
    assert.ok(Math.abs(aura.coreMesh.material.opacity - 0.26) < 1e-4);

    // LISTENING with max audio (1.0): 0.26 + 0.25 = 0.51
    aura.update(0.016, 'LISTENING', 1.0);
    assert.ok(Math.abs(aura.coreMesh.material.opacity - 0.51) < 1e-4);
  });

  await t.test('particle cloud drifts subtly on Y-axis during update', () => {
    const mockThree = createMockThree();
    const aura = new ZadaAura(mockThree);
    aura.build(1.0, 3);

    aura.update(0.1, 'IDLE', 0);
    assert.ok(Math.abs(aura.particles.rotation.y - 0.015) < 1e-4);
  });

  await t.test('dispose cleans up all geometries and materials cleanly', () => {
    const mockThree = createMockThree();
    const aura = new ZadaAura(mockThree);
    aura.build(1.0, 3);

    aura.dispose();

    assert.equal(aura.coreMesh.geometry.disposed, true);
    assert.equal(aura.coreMesh.material.disposed, true);
    assert.equal(aura.ringMesh.geometry.disposed, true);
    assert.equal(aura.ringMesh.material.disposed, true);
    assert.equal(aura.particles.geometry.disposed, true);
    assert.equal(aura.particles.material.disposed, true);
    assert.equal(mockThree.getDisposedCount(), 6);
  });

  await t.test('handles edge case inputs safely without throwing', () => {
    const mockThree = createMockThree();
    const aura = new ZadaAura(mockThree);

    // Dispose before build
    assert.doesNotThrow(() => aura.dispose());

    aura.build(0, -1);
    assert.doesNotThrow(() => {
      aura.update(0, null, undefined);
      aura.update(-0.016, undefined, NaN);
      aura.update(NaN, 'UNKNOWN_STATE', -5);
    });
  });
});