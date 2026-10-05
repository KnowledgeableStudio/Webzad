/**
 * ZadaMotionController - Delta-Time Procedural Kinematics Engine.
 * Drives floating levitation, audio-reactive micro-elevation, scale expansion,
 * and subtle cursor tracking with delta-time invariance across any refresh rate.
 */

/**
 * Procedural motion and kinematics constants.
 * @readonly
 */
const MotionKinematicsConfig = Object.freeze({
  DEADZONE: 0.08,
  MAX_ROTATION_RAD: 0.21, // ~12 degrees
  AUDIO_ATTACK_RATE: 60.0, // ~15ms fast attack
  AUDIO_RELEASE_RATE: 8.0, // ~120ms smooth release
  MAX_SCALE_PULSE: 0.04, // Strictly clamped < 4%
  AUDIO_POSITION_GAIN: 0.025,
  CURSOR_SLERP_SPEED: 4.0
});

/**
 * Kinematics controller for procedural motion.
 */
class ZadaMotionController {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.reducedMotion=false] - Whether reduced motion is enabled.
   */
  constructor(options = {}) {
    this.reducedMotion = Boolean(options.reducedMotion);
    this.elapsedTime = 0;
    this.targetRotation = { x: 0, y: 0, z: 0 };
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.currentPosition = { x: 0, y: 0, z: 0 };
    this.currentScale = 1.0;
    this.audioEnvelope = 0;
  }

  /**
   * Toggles reduced-motion preference dynamically at runtime.
   * @param {boolean} enabled - True to stabilize motion and disable harmonic oscillations.
   */
  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
    if (this.reducedMotion) {
      this._resetMotionToNeutral();
    }
  }

  /**
   * Resets positions and rotations to neutral zero state when reduced motion is active.
   * @private
   */
  _resetMotionToNeutral() {
    this.currentPosition.x = 0;
    this.currentPosition.y = 0;
    this.currentPosition.z = 0;
    this.targetRotation.x = 0;
    this.targetRotation.y = 0;
    this.targetRotation.z = 0;
    this.currentRotation.x = 0;
    this.currentRotation.y = 0;
    this.currentRotation.z = 0;
  }

  /**
   * Applies asymmetric exponential smoothing to audio envelope (fast attack, smooth release).
   * @private
   * @param {number} dt - Delta time in seconds.
   * @param {number} rawEnvelope - Unsmoothed audio amplitude envelope.
   */
  _smoothAudio(dt, rawEnvelope) {
    const sanitizedRaw = (typeof rawEnvelope === 'number' && Number.isFinite(rawEnvelope))
      ? Math.max(0, rawEnvelope)
      : 0;

    const attackCoeff = Math.min(1.0, dt * MotionKinematicsConfig.AUDIO_ATTACK_RATE);
    const releaseCoeff = Math.min(1.0, dt * MotionKinematicsConfig.AUDIO_RELEASE_RATE);
    const coeff = sanitizedRaw > this.audioEnvelope ? attackCoeff : releaseCoeff;

    this.audioEnvelope += (sanitizedRaw - this.audioEnvelope) * coeff;
  }

  /**
   * Computes levitation displacement using deterministic incommensurate frequencies.
   * @private
   * @param {number} t - Accumulated elapsed time in seconds.
   */
  _updatePosition(t) {
    if (this.reducedMotion) {
      this.currentPosition.x = 0;
      this.currentPosition.y = 0;
      this.currentPosition.z = 0;
      return;
    }

    // Incommensurate sinusoidal frequencies prevent repetitive looping
    const baseY = Math.sin(1.173 * t) * 0.08 + Math.cos(0.781 * t) * 0.04;
    const audioY = this.audioEnvelope * MotionKinematicsConfig.AUDIO_POSITION_GAIN;

    this.currentPosition.x = 0;
    this.currentPosition.y = baseY + audioY;
    this.currentPosition.z = 0;
  }

  /**
   * Clamps and applies audio scale reaction strictly under 4% pulse.
   * @private
   */
  _updateScale() {
    const rawPulse = this.audioEnvelope * MotionKinematicsConfig.MAX_SCALE_PULSE;
    const clampedPulse = Math.min(MotionKinematicsConfig.MAX_SCALE_PULSE, Math.max(0, rawPulse));
    this.currentScale = 1.0 + clampedPulse;
  }

  /**
   * Updates subtle cursor-directed look-at and idle precession wobble.
   * @private
   * @param {number} dt - Delta time in seconds.
   * @param {number} t - Accumulated elapsed time in seconds.
   * @param {Object} cursor - Normalized cursor coordinates {x, y}.
   */
  _updateRotation(dt, t, cursor) {
    if (this.reducedMotion) {
      this.targetRotation.x = 0;
      this.targetRotation.y = 0;
      this.currentRotation.x = 0;
      this.currentRotation.y = 0;
      this.currentRotation.z = 0;
      return;
    }

    const curX = (cursor && typeof cursor.x === 'number') ? cursor.x : 0;
    const curY = (cursor && typeof cursor.y === 'number') ? cursor.y : 0;
    const distance = Math.hypot(curX, curY);

    if (distance > MotionKinematicsConfig.DEADZONE) {
      const maxRad = MotionKinematicsConfig.MAX_ROTATION_RAD;
      this.targetRotation.y = Math.max(-maxRad, Math.min(maxRad, curX * maxRad));
      this.targetRotation.x = Math.max(-maxRad, Math.min(maxRad, -curY * maxRad));
    } else {
      this.targetRotation.x = 0;
      this.targetRotation.y = 0;
    }

    const slerpFactor = Math.min(1.0, dt * MotionKinematicsConfig.CURSOR_SLERP_SPEED);
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * slerpFactor;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * slerpFactor;

    // Idle precession wobble on Z-axis
    this.currentRotation.z = Math.sin(0.92 * t) * 0.025;
  }

  /**
   * Main per-frame update driving procedural kinematics via delta-time.
   * @param {number} dt - Elapsed seconds since previous frame.
   * @param {number} [rawAudioEnvelope=0] - Audio amplitude input [0, 1].
   * @param {Object} [cursor={x: 0, y: 0}] - Normalized cursor coordinates [-1, 1].
   * @param {string} [state='IDLE'] - Active companion state from ZadaStateManager.
   */
  update(dt, rawAudioEnvelope = 0, cursor = { x: 0, y: 0 }, state = 'IDLE') {
    const validDt = (typeof dt === 'number' && Number.isFinite(dt) && dt > 0) ? dt : 0;
    this.elapsedTime += validDt;
    const t = this.elapsedTime;

    this._smoothAudio(validDt, rawAudioEnvelope);
    this._updatePosition(t);
    this._updateScale();
    this._updateRotation(validDt, t, cursor);
  }

  /**
   * Returns a decoupled snapshot of the current procedural transforms.
   * @returns {{position: {x: number, y: number, z: number}, rotation: {x: number, y: number, z: number}, scale: number}}
   */
  getTransform() {
    return {
      position: { ...this.currentPosition },
      rotation: { ...this.currentRotation },
      scale: this.currentScale
    };
  }
}

// Universal module export for CommonJS, Browser Window, and global environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZadaMotionController, MotionKinematicsConfig };
}
if (typeof window !== 'undefined') {
  window.ZadaMotionController = ZadaMotionController;
  window.MotionKinematicsConfig = MotionKinematicsConfig;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ZadaMotionController = ZadaMotionController;
  globalThis.MotionKinematicsConfig = MotionKinematicsConfig;
}