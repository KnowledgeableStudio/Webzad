const test = require('node:test');
const assert = require('node:assert/strict');
const { ZadaRenderer, ZadaRendererConfig } = require('../assets/js/zada-renderer.js');

/**
 * Creates a mock Three.js environment for headless Node testing.
 */
function createMockThree() {
  let disposedCount = 0;

  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    sub(v) {
      this.x -= v.x;
      this.y -= v.y;
      this.z -= v.z;
      return this;
    }
    clone() {
      return new MockVector3(this.x, this.y, this.z);
    }
    copy(v) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    }
    multiplyScalar(s) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    }
  }

  class MockBox3 {
    constructor() {
      this.min = new MockVector3(-2, -3, -1);
      this.max = new MockVector3(4, 5, 3);
    }
    setFromObject(obj) {
      return this;
    }
    getCenter(target) {
      target.set(
        (this.min.x + this.max.x) / 2,
        (this.min.y + this.max.y) / 2,
        (this.min.z + this.max.z) / 2
      );
      return target;
    }
    getBoundingSphere(target) {
      target.radius = 5.0;
      return target;
    }
  }

  class MockSphere {
    constructor(center = new MockVector3(), radius = 1) {
      this.center = center;
      this.radius = radius;
    }
  }

  class MockObject3D {
    constructor() {
      this.position = new MockVector3();
      this.rotation = {
        x: 0,
        y: 0,
        z: 0,
        set(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        }
      };
      this.scale = {
        x: 1,
        y: 1,
        z: 1,
        setScalar(s) {
          this.x = s;
          this.y = s;
          this.z = s;
        }
      };
      this.children = [];
      this.geometry = { dispose: () => disposedCount++ };
      this.material = { dispose: () => disposedCount++ };
    }
    add(child) {
      this.children.push(child);
    }
    remove(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
    }
    traverse(callback) {
      callback(this);
      for (const child of [...this.children]) {
        child.traverse(callback);
      }
    }
  }

  class MockCanvas {
    constructor() {
      this.style = {};
      this.listeners = {};
    }
    addEventListener(evt, fn) {
      (this.listeners[evt] = this.listeners[evt] || []).push(fn);
    }
    removeEventListener(evt, fn) {
      if (this.listeners[evt]) {
        this.listeners[evt] = this.listeners[evt].filter((f) => f !== fn);
      }
    }
    dispatchEvent(evt) {
      for (const fn of this.listeners[evt.type] || []) fn(evt);
    }
  }

  class MockWebGLRenderer {
    constructor(opts = {}) {
      this.opts = opts;
      this.clearColor = null;
      this.clearAlpha = null;
      this.pixelRatio = 1;
      this.width = 0;
      this.height = 0;
      this.domElement = new MockCanvas();
      this.disposed = false;
      this.renderCalls = 0;
    }
    setClearColor(c, a) {
      this.clearColor = c;
      this.clearAlpha = a;
    }
    setPixelRatio(r) {
      this.pixelRatio = r;
    }
    setSize(w, h) {
      this.width = w;
      this.height = h;
    }
    render(scene, camera) {
      this.renderCalls++;
    }
    dispose() {
      this.disposed = true;
      disposedCount++;
    }
  }

  return {
    Vector3: MockVector3,
    Box3: MockBox3,
    Sphere: MockSphere,
    Scene: MockObject3D,
    Group: MockObject3D,
    PerspectiveCamera: class extends MockObject3D {
      constructor(fov, aspect, near, far) {
        super();
        this.fov = fov;
        this.aspect = aspect;
        this.near = near;
        this.far = far;
        this.matrixUpdated = false;
      }
      updateProjectionMatrix() {
        this.matrixUpdated = true;
      }
    },
    WebGLRenderer: MockWebGLRenderer,
    AmbientLight: MockObject3D,
    DirectionalLight: MockObject3D,
    getDisposedCount: () => disposedCount
  };
}

/**
 * Creates a mock DOM container element.
 */
function createMockContainer() {
  const children = [];
  const container = {
    clientWidth: 800,
    clientHeight: 600,
    children,
    appendChild: (child) => {
      if (child) child.parentNode = container;
      children.push(child);
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        if (child) child.parentNode = null;
      }
    }
  };
  return container;
}

test('ZadaRenderer exports and configuration', async (t) => {
  await t.test('ZadaRenderer class is exported and configurable', () => {
    assert.equal(typeof ZadaRenderer, 'function');
    assert.ok(ZadaRendererConfig);
    assert.ok(ZadaRendererConfig.MAX_DESKTOP_DPR <= 1.75);
    assert.ok(ZadaRendererConfig.MAX_MOBILE_DPR <= 1.25);
    assert.equal(ZadaRendererConfig.CLEAR_COLOR, 0x000000);
    assert.equal(ZadaRendererConfig.CLEAR_ALPHA, 0);
    assert.ok(Object.isFrozen(ZadaRendererConfig));
  });

  await t.test('instantiation without container handles safely', () => {
    const renderer = new ZadaRenderer();
    assert.equal(renderer.isInitialized, false);
    assert.equal(renderer.isPlaying, false);
    assert.doesNotThrow(() => renderer.pause());
    assert.doesNotThrow(() => renderer.dispose());
  });
});

test('ZadaRenderer adaptive DPR capping', async (t) => {
  await t.test('clamps desktop DPR strictly to <= 1.75', () => {
    const renderer = new ZadaRenderer();
    assert.equal(renderer.calculateDPR(false, 3.0), 1.75);
    assert.equal(renderer.calculateDPR(false, 2.0), 1.75);
    assert.equal(renderer.calculateDPR(false, 1.5), 1.5);
    assert.equal(renderer.calculateDPR(false, 1.0), 1.0);
  });

  await t.test('clamps mobile DPR strictly to <= 1.25', () => {
    const renderer = new ZadaRenderer();
    assert.equal(renderer.calculateDPR(true, 3.0), 1.25);
    assert.equal(renderer.calculateDPR(true, 2.0), 1.25);
    assert.equal(renderer.calculateDPR(true, 1.0), 1.0);
  });
});

test('ZadaRenderer WebGL initialization and transparent canvas', async (t) => {
  await t.test('initializes transparent canvas with zero white flash settings', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    const renderer = new ZadaRenderer({ THREE: mockThree });

    const ok = renderer.init(container);
    assert.ok(ok);
    assert.equal(renderer.isInitialized, true);
    assert.equal(renderer.renderer.opts.alpha, true);
    assert.equal(renderer.renderer.clearColor, 0x000000);
    assert.equal(renderer.renderer.clearAlpha, 0);
    assert.equal(renderer.canvas.style.background, 'transparent');
    assert.equal(container.children.length, 1);
  });

  await t.test('resize updates camera projection and renderer viewport', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    const renderer = new ZadaRenderer({ THREE: mockThree });
    renderer.init(container);

    renderer.resize(1024, 768);
    assert.equal(renderer.camera.aspect, 1024 / 768);
    assert.equal(renderer.camera.matrixUpdated, true);
    assert.equal(renderer.renderer.width, 1024);
    assert.equal(renderer.renderer.height, 768);
  });

  await t.test('init accepts subsystem options and assigns them to instance', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    const mockAura = { id: 'aura' };
    const mockMotion = { id: 'motion' };
    const mockState = { id: 'state' };
    const mockAudio = { id: 'audio' };

    const renderer = new ZadaRenderer({ THREE: mockThree });
    renderer.init(container, {
      aura: mockAura,
      motion: mockMotion,
      stateManager: mockState,
      audioSync: mockAudio
    });

    assert.equal(renderer.aura, mockAura);
    assert.equal(renderer.motion, mockMotion);
    assert.equal(renderer.stateManager, mockState);
    assert.equal(renderer.audioSync, mockAudio);
    renderer.dispose();
  });
});

test('ZadaRenderer viewport docking transitions', async (t) => {
  await t.test('setDockMode switches between hero and dock modes safely', () => {
    const renderer = new ZadaRenderer();
    assert.equal(renderer.dockMode, 'hero');

    renderer.setDockMode('dock');
    assert.equal(renderer.dockMode, 'dock');

    renderer.setDockMode('hero');
    assert.equal(renderer.dockMode, 'hero');

    renderer.setDockMode('unknown_mode');
    assert.equal(renderer.dockMode, 'hero');
  });
});

test('ZadaRenderer render loop, sleep, and context recovery', async (t) => {
  await t.test('start and pause control animation state without duplicate loops', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    let frameId = 100;
    const originalRAF = globalThis.requestAnimationFrame;
    const originalCAF = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = () => ++frameId;
    globalThis.cancelAnimationFrame = () => {};

    try {
      const renderer = new ZadaRenderer({ THREE: mockThree });
      renderer.init(container);

      renderer.start();
      assert.equal(renderer.isPlaying, true);
      assert.ok(renderer.animationFrameId > 0);

      const firstLoopId = renderer.animationFrameId;
      renderer.start();
      assert.equal(renderer.animationFrameId, firstLoopId);

      renderer.pause();
      assert.equal(renderer.isPlaying, false);
      assert.equal(renderer.animationFrameId, null);
    } finally {
      globalThis.requestAnimationFrame = originalRAF;
      globalThis.cancelAnimationFrame = originalCAF;
    }
  });

  await t.test('document.hidden and out-of-viewport sleep automatically suspends loop', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    const renderer = new ZadaRenderer({ THREE: mockThree });
    renderer.init(container);
    renderer.start();

    renderer.handleVisibilityChange(true);
    assert.equal(renderer.isDocumentHidden, true);
    assert.equal(renderer.canRender(), false);

    renderer.handleVisibilityChange(false);
    assert.equal(renderer.isDocumentHidden, false);
    assert.equal(renderer.canRender(), true);

    renderer.handleIntersectionChange(false);
    assert.equal(renderer.isIntersecting, false);
    assert.equal(renderer.canRender(), false);

    renderer.handleIntersectionChange(true);
    assert.equal(renderer.isIntersecting, true);
    assert.equal(renderer.canRender(), true);
    renderer.dispose();
  });

  await t.test('webglcontextlost and webglcontextrestored handle safely', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    let auraCleaned = false;
    const mockAura = {
      group: { children: [{ id: 1 }, { id: 2 }] },
      build: () => {
        auraCleaned = true;
        return new mockThree.Group();
      },
      dispose: () => {}
    };

    const renderer = new ZadaRenderer({ THREE: mockThree, aura: mockAura });
    renderer.init(container);
    renderer.start();

    renderer.handleContextLost({ preventDefault: () => {} });
    assert.equal(renderer.isContextLost, true);
    assert.equal(renderer.canRender(), false);

    renderer.handleContextRestored();
    assert.equal(renderer.isContextLost, false);
    assert.equal(mockAura.group.children.length, 0);
    assert.equal(auraCleaned, true);
    renderer.dispose();
  });

  await t.test('model normalization centers and scales to unit radius', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    const renderer = new ZadaRenderer({ THREE: mockThree });
    renderer.init(container);

    const mockModel = new mockThree.Group();
    const radius = renderer.normalizeModel(mockModel);
    assert.equal(radius, 5.0);
    assert.equal(mockModel.scale.x, 1.0 / 5.0);
    assert.equal(mockModel.position.x, -0.2);
    assert.equal(mockModel.position.y, -0.2);
    assert.equal(mockModel.position.z, -0.2);
    renderer.dispose();
  });

  await t.test('loadModel resolves model, normalizes it, adds to group, and disposes old model', async () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    let oldDisposed = false;
    class MockGLTFLoader {
      load(url, onLoad) {
        const scene = new mockThree.Group();
        scene.name = 'GLTFScene_' + url;
        onLoad({ scene });
      }
    }

    const renderer = new ZadaRenderer({ THREE: mockThree, GLTFLoader: MockGLTFLoader });
    renderer.init(container);

    const res1 = await renderer.loadModel('model1.glb');
    assert.ok(res1.model);
    assert.equal(renderer.modelGroup.children.length, 1);
    assert.equal(renderer.model, res1.model);

    res1.model.traverse = (cb) => {
      oldDisposed = true;
      cb(res1.model);
    };

    const res2 = await renderer.loadModel('model2.glb');
    assert.ok(oldDisposed);
    assert.equal(renderer.model, res2.model);
    assert.equal(renderer.modelGroup.children.length, 1);
    renderer.dispose();
  });

  await t.test('loadModel rejects when GLTFLoader is missing or loader fails', async () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    const renderer = new ZadaRenderer({ THREE: mockThree });
    renderer.init(container);

    await assert.rejects(async () => {
      await renderer.loadModel('fail.glb');
    }, /GLTFLoader not available/);

    class FailingLoader {
      load(url, onLoad, onProgress, onError) {
        onError(new Error('Network error'));
      }
    }
    const renderer2 = new ZadaRenderer({ THREE: mockThree, GLTFLoader: FailingLoader });
    renderer2.init(container);
    await assert.rejects(async () => {
      await renderer2.loadModel('fail2.glb');
    }, /Network error/);
    renderer.dispose();
    renderer2.dispose();
  });

  await t.test('render loop executes render step and interpolates kinematics', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    let motionUpdated = false;
    const mockMotion = {
      update: () => { motionUpdated = true; },
      getTransform: () => ({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1.0 })
    };

    const renderer = new ZadaRenderer({ THREE: mockThree, motion: mockMotion });
    renderer.init(container);
    renderer.setDockMode('dock');
    renderer.start();

    assert.equal(renderer.currentDockOffset.x, 0);

    renderer._renderLoop(100);

    assert.equal(motionUpdated, true);
    assert.equal(renderer.renderer.renderCalls, 1);
    assert.ok(renderer.currentDockOffset.x > 0);
    assert.ok(renderer.currentDockOffset.scale < 1.0);
    renderer.dispose();
  });

  await t.test('clean disposal tears down all resources, document listeners, and DOM bindings', () => {
    const mockThree = createMockThree();
    const container = createMockContainer();
    let auraDisposed = false;
    let removedEvent = null;
    let removedListener = null;
    const mockAura = {
      group: { children: [{ id: 1 }] },
      build: () => new mockThree.Group(),
      dispose: () => {
        auraDisposed = true;
      }
    };

    const originalRemove = globalThis.document ? globalThis.document.removeEventListener : null;
    globalThis.document = {
      addEventListener: () => {},
      removeEventListener: (evt, fn) => {
        removedEvent = evt;
        removedListener = fn;
      },
      hidden: false
    };

    try {
      const renderer = new ZadaRenderer({ THREE: mockThree, aura: mockAura });
      renderer.init(container);
      renderer.start();

      renderer.dispose();
      assert.equal(renderer.isInitialized, false);
      assert.equal(renderer.isPlaying, false);
      assert.equal(renderer.renderer, null);
      assert.equal(renderer.scene, null);
      assert.equal(renderer.model, null);
      assert.equal(auraDisposed, true);
      assert.equal(container.children.length, 0);
      assert.equal(removedEvent, 'visibilitychange');
      assert.equal(removedListener, renderer._boundVisibility);
    } finally {
      if (originalRemove) globalThis.document.removeEventListener = originalRemove;
      else delete globalThis.document;
    }
  });
});
