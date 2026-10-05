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
   * Constructs the inner inverted-normal Fresnel aura shell (1.15x scale).
   * Generates undulating fluid ribbon waves with neon green/cyan/blue gradient.
   * Proportioned to match the 3D object height (0.58) and width (0.52).
   * @private
   * @param {number} radius - Base model radius.
   */
  _buildCore(radius) {
    const THREE = this.THREE;
    const coreGeo = new THREE.SphereGeometry(radius * ZadaAuraConfig.CORE_SCALE_FACTOR, 96, 48);

    // Compute neon gradient vertex colors: Electric Lime-Green (bottom) -> Cyan (mid) -> Royal Blue (top)
    if (coreGeo.attributes?.position && THREE.BufferAttribute) {
      const pos = coreGeo.attributes.position;
      const count = pos.count || (pos.array ? pos.array.length / 3 : 0);
      this.coreBasePositions = new Float32Array(pos.array);
      const colors = new Float32Array(count * 3);
      const rCore = radius * ZadaAuraConfig.CORE_SCALE_FACTOR;

      for (let i = 0; i < count; i++) {
        const y = pos.array[i * 3 + 1];
        const t = Math.max(0, Math.min(1, (y / rCore + 1) * 0.5));
        let r = 0, g = 0, b = 0;
        if (t < 0.40) {
          // Bottom: Electric Lime Green (#14ff45: 0.05, 1.0, 0.25) to Radiant Cyan (#00f7ff: 0.0, 0.97, 1.0)
          const k = t / 0.40;
          r = 0.05 * (1 - k);
          g = 1.0 * (1 - k) + 0.97 * k;
          b = 0.25 * (1 - k) + 1.0 * k;
        } else {
          // Top: Radiant Cyan (#00f7ff: 0.0, 0.97, 1.0) to Deep Electric Blue (#0048ff: 0.04, 0.25, 1.0)
          const k = (t - 0.40) / 0.60;
          r = 0.0 * (1 - k) + 0.04 * k;
          g = 0.97 * (1 - k) + 0.25 * k;
          b = 1.0 * (1 - k) + 1.0 * k;
        }
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
      coreGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    this.ribbonTexture = this._createRibbonTexture();
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: ZadaAuraConfig.CORE_BASE_OPACITY,
      alphaMap: this.ribbonTexture || undefined,
      map: this.ribbonTexture || undefined,
      vertexColors: true,
      side: THREE.DoubleSide || 2,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    // Conform aura strictly to 3D object body: width 0.52, height 0.58, depth 0.54
    if (this.coreMesh.scale?.set) this.coreMesh.scale.set(0.52, 0.58, 0.54);
    this.group.add(this.coreMesh);
  }

  /**
   * Constructs the tilted holographic signal ring (1.25x scale).
   * Scaled to orbit tightly around the character's mid-body.
   * @private
   * @param {number} radius - Base model radius.
   */
  _buildRing(radius) {
    const THREE = this.THREE;
    const ringGeo = new THREE.TorusGeometry(
      radius * ZadaAuraConfig.RING_SCALE_FACTOR, 0.0016 * radius, 16, 64
    );
    const ringMat = new THREE.MeshBasicMaterial({
      color: ZadaAuraConfig.COLOR, transparent: true, opacity: ZadaAuraConfig.RING_OPACITY,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = Math.PI / 2.3;
    // Scale ring to encircle the torso/waist gracefully matching model dimensions
    if (this.ringMesh.scale?.set) this.ringMesh.scale.set(0.52, 0.52, 0.52);
    this.group.add(this.ringMesh);
  }

  /**
   * Creates a high-end cinematic sci-fi radial glow texture for particles.
   * @private
   * @returns {Object|null} Three.js CanvasTexture or null.
   */
  _createGlowTexture() {
    const THREE = this.THREE;
    if (typeof document === 'undefined' || !THREE?.CanvasTexture) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.18, 'rgba(180, 255, 255, 0.95)');
      grad.addColorStop(0.38, 'rgba(0, 247, 255, 0.65)');
      grad.addColorStop(0.65, 'rgba(0, 160, 255, 0.22)');
      grad.addColorStop(1, 'rgba(0, 72, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    } catch {
      return null;
    }
  }

  /**
   * Creates horizontal flowing ribbon strands alpha texture matching the reference video.
   * High-resolution 128x512 canvas with 28 anti-aliased glowing ribbons.
   * @private
   * @returns {Object|null} Three.js CanvasTexture or null.
   */
  _createRibbonTexture() {
    const THREE = this.THREE;
    if (typeof document === 'undefined' || !THREE?.CanvasTexture) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.clearRect(0, 0, 128, 512);

      // Draw 28 horizontal glowing ribbons with smooth dark gaps and silky bloom
      const numRibbons = 28;
      const ribbonSpacing = 512 / numRibbons;
      for (let i = 0; i < numRibbons; i++) {
        const cy = (i + 0.5) * ribbonSpacing;
        const h = ribbonSpacing * 0.44;
        const grad = ctx.createLinearGradient(0, cy - h, 0, cy + h);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.35)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.35)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, cy - h, 128, h * 2);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping || 1000;
      tex.wrapT = THREE.ClampToEdgeWrapping || 1001;
      tex.needsUpdate = true;
      return tex;
    } catch {
      return null;
    }
  }

  /**
   * Constructs micro-particle dust strictly clamped between 1.15x and 1.35x.
   * Features neon green/cyan/blue gradient and soft radial glow.
   * @private
   * @param {number} radius - Base model radius.
   * @param {number} qualityTier - Dynamic GPU quality tier.
   */
  _buildParticles(radius, qualityTier) {
    const THREE = this.THREE;
    const count = ZadaAuraConfig.TIER_PARTICLES[qualityTier] || ZadaAuraConfig.TIER_PARTICLES[3];
    const partGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = radius * (1.15 + Math.random() * (ZadaAuraConfig.PARTICLE_MAX_RADIUS - 1.15));
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color gradient matching video: Green (bottom) -> Cyan (mid) -> Blue (top)
      const t = Math.max(0, Math.min(1, (y / (radius * 1.35) + 1) * 0.5));
      if (t < 0.42) {
        colors[i * 3] = 0.08; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 0.27;
      } else if (t < 0.65) {
        colors[i * 3] = 0.0; colors[i * 3 + 1] = 0.97; colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 0.0; colors[i * 3 + 1] = 0.35; colors[i * 3 + 2] = 1.0;
      }
    }

    partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (THREE.BufferAttribute) partGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.glowTexture = this._createGlowTexture();
    const partMat = new THREE.PointsMaterial({
      color: ZadaAuraConfig.COLOR,
      size: this.glowTexture ? (0.015 * radius) : (0.005 * radius),
      map: this.glowTexture || undefined,
      vertexColors: true,
      transparent: true,
      opacity: ZadaAuraConfig.PARTICLE_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.particles = new THREE.Points(partGeo, partMat);
    // Hug the humanoid silhouette matching model dimensions (width 0.52, height 0.58, depth 0.54)
    if (this.particles.scale?.set) this.particles.scale.set(0.52, 0.58, 0.54);
    this.group.add(this.particles);
  }

  /**
   * Updates aura luminescence, ring rotation rate, particle drift, and fluid wave harmonics.
   * @param {number} dt - Elapsed seconds since last frame.
   * @param {string} [state='IDLE'] - Active companion state.
   * @param {number} [audioEnvelope=0] - Audio volume envelope [0, 1].
   */
  update(dt, state = 'IDLE', audioEnvelope = 0) {
    const validDt = (typeof dt === 'number' && Number.isFinite(dt) && dt > 0) ? dt : 0;
    this.elapsedTime += validDt;

    // Counter-rotation on core mesh for subtle liveliness
    if (this.coreMesh) {
      this.coreMesh.rotation.y += validDt * 0.10;
    }

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

    // Fluid 3D wave harmonic displacement on ribbon surface matching video
    if (this.coreBasePositions && this.coreMesh?.geometry?.attributes?.position) {
      const posAttr = this.coreMesh.geometry.attributes.position;
      const posArr = posAttr.array;
      const baseArr = this.coreBasePositions;
      const time = this.elapsedTime;
      const waveAudio = clampedAudio * 0.16;
      const count = baseArr.length / 3;

      for (let i = 0; i < count; i++) {
        const bx = baseArr[i * 3];
        const by = baseArr[i * 3 + 1];
        const bz = baseArr[i * 3 + 2];

        const theta = Math.atan2(bz, bx);
        const phi = by / (this.baseRadius * ZadaAuraConfig.CORE_SCALE_FACTOR);

        const w1 = Math.sin(2.4 * theta + time * 2.2) * Math.cos(2.8 * phi - time * 1.5);
        const w2 = Math.sin(4.2 * theta - time * 3.2) * 0.28;
        const w3 = Math.cos(3.2 * phi + time * 1.8 + theta) * 0.20;
        const w4 = Math.sin(1.8 * theta - 2.2 * phi + time * 2.6) * 0.14;

        const waveFactor = 1.0 + (w1 + w2 + w3 + w4) * (0.05 + waveAudio);

        posArr[i * 3] = bx * waveFactor;
        posArr[i * 3 + 1] = by * waveFactor + w1 * 0.04 * this.baseRadius;
        posArr[i * 3 + 2] = bz * waveFactor;
      }
      posAttr.needsUpdate = true;
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
    if (this.glowTexture?.dispose) this.glowTexture.dispose();
    if (this.ribbonTexture?.dispose) this.ribbonTexture.dispose();
    this.glowTexture = this.ribbonTexture = this.coreBasePositions = null;
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