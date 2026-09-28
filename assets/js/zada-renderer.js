/**
 * ZadaRenderer - Adaptive WebGL 3D Renderer and Viewport Docking.
 * Manages transparent Three.js canvas, DPR governor, background sleep, and context recovery.
 */

/** @readonly */
const ZadaRendererConfig = Object.freeze({
  MAX_DESKTOP_DPR: 1.75, MAX_MOBILE_DPR: 1.25, CLEAR_COLOR: 0x000000, CLEAR_ALPHA: 0,
  CAMERA_FOV: 45, CAMERA_NEAR: 0.1, CAMERA_FAR: 100, CAMERA_Z: 3.5,
  DOCK_MODES: Object.freeze({ HERO: 'hero', DOCK: 'dock' }),
  DOCK_TRANSFORMS: Object.freeze({
    hero: Object.freeze({ x: 0, y: 0, z: 0, scale: 1.0 }),
    dock: Object.freeze({ x: 0.8, y: -0.6, z: 0, scale: 0.55 })
  })
});
const _raf = (cb) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(cb, 16)), _caf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

/** Adaptive WebGL renderer managing scene lifecycle, quality governor, and docking. */
class ZadaRenderer {
  /** @param {Object} [options] */
  constructor(options = {}) {
    this.options = options;
    this.THREE = options.THREE || (typeof window !== 'undefined' ? window.THREE : null);
    this.aura = options.aura || null; this.motion = options.motion || null;
    this.stateManager = options.stateManager || null; this.audioSync = options.audioSync || null;
    this.container = this.canvas = this.renderer = this.scene = this.camera = this.modelGroup = this.model = null;
    this.isInitialized = this.isPlaying = this.isContextLost = this.isDocumentHidden = false;
    this.isIntersecting = true; this.dockMode = ZadaRendererConfig.DOCK_MODES.HERO;
    this.currentDockOffset = { x: 0, y: 0, z: 0, scale: 1.0 };
    this.animationFrameId = this.intersectionObserver = null;
    this.lastFrameTime = 0; this._boundLoop = (t) => this._renderLoop(t);
  }

  /** Initializes Three.js scene, transparent canvas, lighting, and event hooks. */
  init(containerEl, options = {}) {
    if (!containerEl) return false;
    this.options = { ...this.options, ...options };
    this.THREE = this.options.THREE || this.THREE || (typeof window !== 'undefined' ? window.THREE : null);
    if (!this.THREE) return false;
    this.container = containerEl;
    this.scene = new this.THREE.Scene();
    this.modelGroup = new this.THREE.Group(); this.modelGroup.name = 'ZadaModelGroup';
    this.scene.add(this.modelGroup);
    const w = containerEl.clientWidth || 300, h = containerEl.clientHeight || 300;
    this.camera = new this.THREE.PerspectiveCamera(ZadaRendererConfig.CAMERA_FOV, w / (h || 1), ZadaRendererConfig.CAMERA_NEAR, ZadaRendererConfig.CAMERA_FAR);
    this.camera.position.z = ZadaRendererConfig.CAMERA_Z;
    this.renderer = new this.THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    this.renderer.setClearColor(ZadaRendererConfig.CLEAR_COLOR, ZadaRendererConfig.CLEAR_ALPHA);
    this.renderer.setPixelRatio(this.calculateDPR(this.detectMobile())); this.renderer.setSize(w, h);
    this.canvas = this.renderer.domElement;
    if (this.canvas?.style) Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%', background: 'transparent' });
    if (typeof containerEl.appendChild === 'function') containerEl.appendChild(this.canvas);
    this._setupLights(); this._setupEvents();
    return (this.isInitialized = true);
  }

  /** @private */
  _setupLights() {
    const k = new this.THREE.DirectionalLight(0x00f7ff, 1.2), a = new this.THREE.DirectionalLight(0xff00f0, 0.8);
    k.position.set(2, 3, 4); a.position.set(-3, -1, -2);
    this.scene.add(new this.THREE.AmbientLight(0xffffff, 0.8), k, a);
  }

  /** @private */
  _setupEvents() {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.handleVisibilityChange(document.hidden));
    this.canvas?.addEventListener?.('webglcontextlost', (e) => this.handleContextLost(e));
    this.canvas?.addEventListener?.('webglcontextrestored', () => this.handleContextRestored());
    if (typeof IntersectionObserver !== 'undefined' && this.container) {
      this.intersectionObserver = new IntersectionObserver((e) => { if (e?.[0]) this.handleIntersectionChange(e[0].isIntersecting); });
      this.intersectionObserver.observe(this.container);
    }
  }

  /** Calculates DPR capped at 1.75 on desktop and 1.25 on mobile. */
  calculateDPR(isMobile = false, customDPR = null) {
    const raw = typeof customDPR === 'number' ? customDPR : (typeof window !== 'undefined' && window.devicePixelRatio) || 1.0;
    return Math.min(Math.max(1.0, raw), isMobile ? ZadaRendererConfig.MAX_MOBILE_DPR : ZadaRendererConfig.MAX_DESKTOP_DPR);
  }
  /** @returns {boolean} */
  detectMobile() {
    return (typeof window !== 'undefined' && window.navigator) ? /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent) : false;
  }

  /** Centers model to origin and scales to unit bounding radius. */
  normalizeModel(object) {
    if (!object || !this.THREE) return 1.0;
    const box = new this.THREE.Box3().setFromObject(object);
    object.position.sub(box.getCenter(new this.THREE.Vector3()));
    const radius = Math.max(1e-4, box.getBoundingSphere(new this.THREE.Sphere())?.radius || 1.0);
    object.scale.setScalar(1.0 / radius);
    return radius;
  }

  /** Loads and normalizes 3D GLTF asset. */
  loadModel(url, onProgress) {
    return new Promise((resolve, reject) => {
      const Loader = this.options.GLTFLoader || (typeof window !== 'undefined' ? window.GLTFLoader : null);
      if (!Loader) return reject(new Error('GLTFLoader not available'));
      new Loader().load(url, (gltf) => {
        this.model = gltf.scene || gltf; this.normalizeModel(this.model);
        if (this.modelGroup) this.modelGroup.add(this.model);
        this._rebuildAura(); resolve({ model: this.model, gltf });
      }, onProgress, reject);
    });
  }

  /** @private */
  _rebuildAura() {
    this._clearAuraChildren();
    if (this.aura && this.modelGroup && typeof this.aura.build === 'function') {
      const g = this.aura.build(1.0);
      if (g && !this.modelGroup.children.includes(g)) this.modelGroup.add(g);
    }
  }
  /** @private */
  _clearAuraChildren() {
    while (this.aura?.group?.children?.length > 0) {
      const c = this.aura.group.children.pop();
      c?.geometry?.dispose?.(); c?.material?.dispose?.();
    }
  }
  setDockMode(mode) { this.dockMode = (mode === 'dock') ? 'dock' : 'hero'; }
  canRender() { return this.isInitialized && !this.isContextLost && !this.isDocumentHidden && this.isIntersecting; }
  start() { this.isPlaying = true; this._syncLoop(); }
  pause() { this.isPlaying = false; this._syncLoop(); }
  handleVisibilityChange(hidden) { this.isDocumentHidden = Boolean(hidden); this._syncLoop(); }
  handleIntersectionChange(isIntersecting) { this.isIntersecting = Boolean(isIntersecting); this._syncLoop(); }
  handleContextLost(e) { if (e?.preventDefault) e.preventDefault(); this.isContextLost = true; this._syncLoop(); }
  handleContextRestored() { this.isContextLost = false; this._rebuildAura(); this._syncLoop(); }

  /** @private */
  _syncLoop() {
    if (this.isPlaying && this.canRender()) {
      if (this.animationFrameId === null) {
        this.lastFrameTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
        this.animationFrameId = _raf(this._boundLoop);
      }
    } else if (this.animationFrameId !== null) {
      _caf(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** @private */
  _renderLoop(timestamp) {
    this.animationFrameId = null;
    if (!this.isPlaying || !this.canRender()) return;
    const now = (typeof timestamp === 'number' ? timestamp : Date.now()) / 1000;
    const dt = this.lastFrameTime > 0 ? Math.min(0.1, Math.max(0, now - this.lastFrameTime)) : 0.016;
    this.lastFrameTime = now;
    this._updateKinematics(dt);
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    if (this.isPlaying && this.canRender()) this.animationFrameId = _raf(this._boundLoop);
  }

  /** @private */
  _updateKinematics(dt) {
    const target = ZadaRendererConfig.DOCK_TRANSFORMS[this.dockMode] || ZadaRendererConfig.DOCK_TRANSFORMS.hero;
    const lerp = Math.min(1.0, dt * 5.0);
    for (const k of ['x', 'y', 'z', 'scale']) this.currentDockOffset[k] += (target[k] - this.currentDockOffset[k]) * lerp;
    const audio = this.audioSync ? this.audioSync.getAmplitude() : 0, state = this.stateManager ? this.stateManager.getState() : 'IDLE';
    if (this.motion) {
      this.motion.update(dt, audio, this.options.cursor || { x: 0, y: 0 }, state);
      const t = this.motion.getTransform();
      if (this.modelGroup) {
        this.modelGroup.position.set(t.position.x + this.currentDockOffset.x, t.position.y + this.currentDockOffset.y, t.position.z + this.currentDockOffset.z);
        this.modelGroup.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z); this.modelGroup.scale.setScalar(t.scale * this.currentDockOffset.scale);
      }
    }
    if (this.aura) this.aura.update(dt, state, audio);
  }

  /** Resizes camera projection and renderer viewport. */
  resize(w, h) {
    if (!this.isInitialized || !this.renderer || !this.camera) return;
    const width = w || (this.container ? this.container.clientWidth : 300), height = h || (this.container ? this.container.clientHeight : 300);
    this.camera.aspect = width / (height || 1);
    this.camera.updateProjectionMatrix?.();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.calculateDPR(this.detectMobile()));
  }

  /** Cleans up geometries, materials, listeners, and DOM bindings. */
  dispose() {
    this.pause(); this._clearAuraChildren(); this.aura?.dispose?.();
    this.scene?.traverse((o) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.()); });
    this.renderer?.dispose?.();
    try { if (this.canvas && this.container?.removeChild) this.container.removeChild(this.canvas); } catch {}
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null; this.isInitialized = false;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { ZadaRenderer, ZadaRendererConfig };
if (typeof window !== 'undefined') Object.assign(window, { ZadaRenderer, ZadaRendererConfig });
if (typeof globalThis !== 'undefined') Object.assign(globalThis, { ZadaRenderer, ZadaRendererConfig });
