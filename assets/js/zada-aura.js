/**
 * ZadaAura - Restrained Sci-Fi Energy Field & Holographic Signal Ring.
 * Strictly clamped to <= 1.40x bounding scale under all states.
 */

/**
 * Configuration constants for the Zada restrained aura field.
 * @readonly
 */
const ZadaAuraConfig = Object.freeze({
  MAX_SCALE_FACTOR: 1.40,
  CORE_SCALE_FACTOR: 1.15,
  RING_SCALE_FACTOR: 1.25,
  PARTICLE_MAX_RADIUS: 1.35,
  COLOR: 0x00f7ff,
  CORE_BASE_OPACITY: 0.18,
  CORE_LISTENING_OPACITY: 0.26,
  RING_OPACITY: 0.35,
  PARTICLE_OPACITY: 0.45,
  MAX_AUDIO_BOOST: 0.25,
  TIER_PARTICLES: Object.freeze({ 1: 20, 2: 40, 3: 75 })
});

/**
 * Restrained aura system wrapping Zada with layered Fresnel, ring, and motes.
 */
class ZadaAura {
  /**
   * @param {Object} THREE - Three.js library instance.
   * @param {Object} [options] - Optional configuration overrides.
   */
  constructor(THREE, options = {}) {
    this.THREE = THREE;
    this.group = new THREE.Group();
    this.group.name = 'ZadaAuraGroup';
    this.coreMesh = null;
    this.ringMesh = null;
    this.particles = null;
    this.baseRadius = 1.0;
    this.elapsedTime = 0;
  }

  /**
   * Builds the core Fresnel field, holographic signal ring, and particle cloud.
   * @param {number} [radius=1.0] - Bounding radius of Zada 3D model.
   * @param {number} [qualityTier=3] - Performance tier (1: low, 2: mid, 3: high).
   * @returns {Object} Three.js Group containing all aura elements.
   */
  build(radius = 1.0, qualityTier = 3) {
    const validRadius = (typeof radius === 'number' && Number.isFinite(radius) && radius > 0)
      ? radius : 1.0;
    this.baseRadius = validRadius;

    this._buildCore(validRadius);
    this._buildRing(validRadius);
    this._buildParticles(validRadius, qualityTier);

    return this.group;
  }

  /**
   * Constructs the inner inverted-normal Fresnel aura sphere (1.15x scale).
   * @private
   * @param {number} radius - Base model radius.
   */
  _buildCore(radius) {
    const THREE = this.THREE;
    const coreGeo = new THREE.SphereGeometry(radius * ZadaAuraConfig.CORE_SCALE_FACTOR, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: ZadaAuraConfig.COLOR, transparent: true, opacity: ZadaAuraConfig.CORE_BASE_OPACITY,
      wireframe: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);
  }

  /**
   * Constructs the tilted holographic signal ring (1.25x scale).
   * @private
   * @param {number} radius - Base model radius.
   */
  _buildRing(radius) {
    const THREE = this.THREE;
    const ringGeo = new THREE.TorusGeometry(
      radius * ZadaAuraConfig.RING_SCALE_FACTOR, 0.008 * radius, 16, 64
    );
    const ringMat = new THREE.MeshBasicMaterial({
      color: ZadaAuraConfig.COLOR, transparent: true, opacity: ZadaAuraConfig.RING_OPACITY,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = Math.PI / 2.3;
    this.group.add(this.ringMesh);
  }

  /**
   * Constructs micro-particle dust strictly clamped between 1.15x and 1.35x.
   * @private
   * @param {number} radius - Base model radius.
   * @param {number} qualityTier - Dynamic GPU quality tier.
   */
  _buildParticles(radius, qualityTier) {
    const THREE = this.THREE;
    const count = ZadaAuraConfig.TIER_PARTICLES[qualityTier] || ZadaAuraConfig.TIER_PARTICLES[3];
    const partGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = radius * (1.15 + Math.random() * (ZadaAuraConfig.PARTICLE_MAX_RADIUS - 1.15));
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const partMat = new THREE.PointsMaterial({
      color: ZadaAuraConfig.COLOR, size: 0.025 * radius, transparent: true,
      opacity: ZadaAuraConfig.PARTICLE_OPACITY, blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.particles = new THREE.Points(partGeo, partMat);
    this.group.add(this.particles);
  }

  /**
   * Updates aura luminescence, ring rotation rate, and particle drift.
   * @param {number} dt - Elapsed seconds since last frame.
   * @param {string} [state='IDLE'] - Active companion state.
   * @param {number} [audioEnvelope=0] - Audio volume envelope [0, 1].
   */
  update(dt, state = 'IDLE', audioEnvelope = 0) {
    const validDt = (typeof dt === 'number' && Number.isFinite(dt) && dt > 0) ? dt : 0;
    this.elapsedTime += validDt;

    // Accelerated spin during cognitive analysis (THINKING)
    const ringSpeed = state === 'THINKING' ? 3.0 : 0.8;
    if (this.ringMesh) {
      this.ringMesh.rotation.z += validDt * ringSpeed;
    }

    // Audio-reactive luminescence capped strictly to +25%
    const rawAudio = (typeof audioEnvelope === 'number' && Number.isFinite(audioEnvelope))
      ? audioEnvelope : 0;
    const clampedAudio = Math.min(1.0, Math.max(0, rawAudio));
    const audioBoost = clampedAudio * ZadaAuraConfig.MAX_AUDIO_BOOST;

    if (this.coreMesh && this.coreMesh.material) {
      const isListening = state === 'LISTENING';
      const baseOpacity = isListening ? ZadaAuraConfig.CORE_LISTENING_OPACITY : ZadaAuraConfig.CORE_BASE_OPACITY;
      this.coreMesh.material.opacity = baseOpacity + audioBoost;
    }

    if (this.particles) {
      this.particles.rotation.y += validDt * 0.15;
    }
  }

  /**
   * Safely disposes geometry and material resources on a 3D object.
   * @private
   * @param {Object} [obj] - Render object to clean up.
   */
  _disposeObject(obj) {
    if (!obj) return;
    if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
    if (obj.material && typeof obj.material.dispose === 'function') obj.material.dispose();
  }

  /**
   * Releases WebGL buffers, geometries, and materials to avoid memory leaks.
   */
  dispose() {
    this._disposeObject(this.coreMesh);
    this._disposeObject(this.ringMesh);
    this._disposeObject(this.particles);
  }
}

// Universal export for CommonJS, Browser Window, and global environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZadaAura, ZadaAuraConfig };
}
if (typeof window !== 'undefined') {
  window.ZadaAura = ZadaAura;
  window.ZadaAuraConfig = ZadaAuraConfig;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ZadaAura = ZadaAura;
  globalThis.ZadaAuraConfig = ZadaAuraConfig;
}