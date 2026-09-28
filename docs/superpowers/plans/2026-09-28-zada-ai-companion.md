# Zada 3D AI Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Zada, an intelligent 3D sci-fi AI companion, into Webzad using Three.js, procedural kinematics, a restrained aura, audio synchronization, Gemini backend integration, and a secure semantic action whitelist.

**Architecture:** A modular engine architecture where `ZadaStateManager` serves as the authoritative single source of truth coordinating the 3D WebGL renderer, procedural kinematics, restrained aura, audio analysis, holographic conversation HUD, and a strictly validated website action whitelist. The backend exposes a secure `/api/chat` endpoint on `open-site-server.cjs` with rate-limiting and environment-variable key management, backed by a local developer fallback modal.

**Tech Stack:** Three.js (r160+), GLTFLoader, Web Audio API, Web Speech API, Vanilla ES Modules, Node.js HTTP server, Google Gemini REST API, native Node test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-09-28-zada-ai-companion-design.md`

## Global Constraints
- Identity: Named **Zada** across all UI, voice, system prompts, and code.
- 3D Model: Authoritative asset copied from `E:\WEBZAD\Zada AI.glb` to `assets/zada.glb`; never modified or substituted.
- Fault-Isolation: A failure in Gemini must not break audio; an audio failure must not break the 3D companion; a WebGL failure must not break the HUD; and a Zada failure must never break the underlying Webzad website.
- Existing Site: Zero modifications to existing navigation, lightbox, hero video, contact form, or styles except mounting Zada hooks.
- Aura Invariant: Clamped strictly to a maximum of 1.40× visual bounding scale under all states.
- Performance: Target smooth 60 FPS with adaptive DPR and dynamic particle tiering; suspend rendering on `document.hidden` or out-of-viewport.
- Security: Zero arbitrary DOM, script, or URL execution; semantic enum whitelist only. Form prefill never submits automatically.
- Secrets: Production Gemini key strictly server-side (`GEMINI_API_KEY`); browser local key clearly labeled `LOCAL DEVELOPMENT ONLY — NOT SECURE FOR PRODUCTION`.

---

### Task 1: Asset Pipeline & Vendor Dependencies

**Files:**
- Create: `assets/zada.glb` (copied from `E:\WEBZAD\Zada AI.glb`)
- Create: `assets/vendor/three.module.js`
- Create: `assets/vendor/GLTFLoader.js`
- Test: `test/assets-verify.test.cjs`

**Interfaces:**
- Produces: `assets/zada.glb`, `assets/vendor/three.module.js`, `assets/vendor/GLTFLoader.js` for downstream tasks.

- [ ] **Step 1: Write verification test for assets**

```javascript
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/assets-verify.test.cjs`  
Expected: FAIL (files missing)

- [ ] **Step 3: Copy model asset and stage vendor libraries**

1. Copy `E:\WEBZAD\Zada AI.glb` to `assets/zada.glb`.
2. Fetch or vendor standalone modern Three.js ES module and `GLTFLoader.js` into `assets/vendor/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/assets-verify.test.cjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/assets-verify.test.cjs assets/vendor/
git commit -m "chore: setup Zada 3D asset and vendor Three.js dependencies"
```

---

### Task 2: Authoritative State Machine (`ZadaStateManager`)

**Files:**
- Create: `test/zada-state.test.cjs`
- Create: `assets/js/zada-state.js`

**Interfaces:**
- Produces: `ZadaStateManager` class with `getState()`, `setState(newState, payload)`, `subscribe(fn)`, `on(event, fn)`, `interrupt(targetState)`.
- States: `'WELCOME'`, `'IDLE'`, `'LISTENING'`, `'THINKING'`, `'RESPONDING'`, `'NAVIGATING'`, `'SUCCESS'`, `'WARNING'`, `'ERROR'`, `'GOODBYE'`.

- [ ] **Step 1: Write the failing unit test for state transitions**

```javascript
// test/zada-state.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');

// Import state machine module
const { ZadaStateManager, ZadaStates } = require('../assets/js/zada-state.js');

test('ZadaStateManager deterministic transitions & debouncing', async (t) => {
  await t.test('initial state defaults to WELCOME or IDLE', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.WELCOME });
    assert.equal(sm.getState(), 'WELCOME');
  });

  await t.test('valid transition updates state and notifies subscribers', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.IDLE });
    let notified = null;
    sm.subscribe((state, prev) => { notified = { state, prev }; });
    
    const transitioned = sm.setState(ZadaStates.LISTENING);
    assert.ok(transitioned);
    assert.equal(sm.getState(), 'LISTENING');
    assert.deepEqual(notified, { state: 'LISTENING', prev: 'IDLE' });
  });

  await t.test('invalid transition is rejected safely', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.GOODBYE });
    const transitioned = sm.setState(ZadaStates.RESPONDING);
    assert.equal(transitioned, false);
    assert.equal(sm.getState(), 'GOODBYE');
  });

  await t.test('interruption resets active state cleanly', () => {
    const sm = new ZadaStateManager({ initial: ZadaStates.RESPONDING });
    sm.interrupt(ZadaStates.LISTENING);
    assert.equal(sm.getState(), 'LISTENING');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/zada-state.test.cjs`  
Expected: FAIL with "Cannot find module ../assets/js/zada-state.js"

- [ ] **Step 3: Implement `ZadaStateManager`**

```javascript
// assets/js/zada-state.js
const ZadaStates = {
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
};

const VALID_TRANSITIONS = {
  WELCOME: ['IDLE', 'ERROR'],
  IDLE: ['LISTENING', 'THINKING', 'NAVIGATING', 'GOODBYE', 'WARNING', 'ERROR'],
  LISTENING: ['THINKING', 'IDLE', 'WARNING', 'ERROR'],
  THINKING: ['RESPONDING', 'IDLE', 'NAVIGATING', 'WARNING', 'ERROR'],
  RESPONDING: ['IDLE', 'LISTENING', 'WARNING', 'ERROR'],
  NAVIGATING: ['SUCCESS', 'IDLE', 'WARNING', 'ERROR'],
  SUCCESS: ['IDLE'],
  WARNING: ['IDLE'],
  ERROR: ['IDLE'],
  GOODBYE: ['IDLE', 'WELCOME']
};

class ZadaStateManager {
  constructor(options = {}) {
    this.state = options.initial || ZadaStates.IDLE;
    this.previousState = null;
    this.subscribers = new Set();
    this.payload = null;
    this.lastTransitionTime = Date.now();
    this.debounceMs = options.debounceMs || 50;
  }

  getState() {
    return this.state;
  }

  getPreviousState() {
    return this.previousState;
  }

  setState(newState, payload = null) {
    if (newState === this.state) return true;
    const now = Date.now();
    if (now - this.lastTransitionTime < this.debounceMs) {
      return false;
    }
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(newState)) {
      return false;
    }
    this.previousState = this.state;
    this.state = newState;
    this.payload = payload;
    this.lastTransitionTime = now;
    this.notify();
    return true;
  }

  interrupt(targetState = ZadaStates.LISTENING) {
    this.previousState = this.state;
    this.state = targetState;
    this.lastTransitionTime = Date.now();
    this.notify();
    return true;
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZadaStateManager, ZadaStates };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/zada-state.test.cjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/zada-state.test.cjs assets/js/zada-state.js
git commit -m "feat(zada): implement authoritative ZadaStateManager with transition validation"
```

---

### Task 3: Semantic Action Whitelist & Security Gate (`ZadaActionDispatcher`)

**Files:**
- Create: `test/zada-actions.test.cjs`
- Create: `assets/js/zada-actions.js`

**Interfaces:**
- Consumes: `ZadaStateManager`
- Produces: `ZadaActionDispatcher` with `validateAction(toolCall)`, `dispatch(actionName, params)`.
- Whitelisted Actions: `scrollToSection`, `openProjectPreview`, `prefillContactBrief`, `toggleAudioOutput`, `openDevSettings`.

- [ ] **Step 1: Write the failing unit tests for action whitelist**

```javascript
// test/zada-actions.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { ZadaActionDispatcher } = require('../assets/js/zada-actions.js');

test('ZadaActionDispatcher security whitelist & parameter checking', async (t) => {
  const dispatcher = new ZadaActionDispatcher();

  await t.test('whitelisted scrollToSection with valid section passes', () => {
    const res = dispatcher.validateAction({
      name: 'scrollToSection',
      params: { sectionId: 'services' }
    });
    assert.equal(res.valid, true);
    assert.equal(res.sanitized.sectionId, 'services');
  });

  await t.test('invalid sectionId in scrollToSection is rejected', () => {
    const res = dispatcher.validateAction({
      name: 'scrollToSection',
      params: { sectionId: 'invalid-section' }
    });
    assert.equal(res.valid, false);
  });

  await t.test('arbitrary script or eval injection is strictly rejected', () => {
    const res = dispatcher.validateAction({
      name: 'eval',
      params: { code: 'alert(1)' }
    });
    assert.equal(res.valid, false);
  });

  await t.test('prefillContactBrief validates serviceType enum and clamps length', () => {
    const longDetails = 'a'.repeat(600);
    const res = dispatcher.validateAction({
      name: 'prefillContactBrief',
      params: {
        serviceType: 'signature-website',
        details: longDetails
      }
    });
    assert.equal(res.valid, true);
    assert.equal(res.sanitized.serviceType, 'signature-website');
    assert.equal(res.sanitized.details.length, 500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/zada-actions.test.cjs`  
Expected: FAIL

- [ ] **Step 3: Implement `ZadaActionDispatcher`**

```javascript
// assets/js/zada-actions.js
const APPROVED_SECTIONS = ['hero', 'services', 'work', 'process', 'contact'];
const APPROVED_PROJECTS = ['growth', 'hospitality', 'services'];
const APPROVED_SERVICES = ['signature-website', 'landing-page', 'web-app', 'autonomous-business', 'custom-ai'];

class ZadaActionDispatcher {
  constructor(handlers = {}) {
    this.handlers = handlers;
  }

  validateAction(call) {
    if (!call || typeof call !== 'object' || typeof call.name !== 'string') {
      return { valid: false, reason: 'Malformed action object' };
    }
    const { name, params = {} } = call;

    switch (name) {
      case 'scrollToSection': {
        const id = String(params.sectionId || '').toLowerCase().trim();
        if (!APPROVED_SECTIONS.includes(id)) {
          return { valid: false, reason: `Unapproved section: ${id}` };
        }
        return { valid: true, name, sanitized: { sectionId: id } };
      }
      case 'openProjectPreview': {
        const pid = String(params.projectId || '').toLowerCase().trim();
        if (!APPROVED_PROJECTS.includes(pid)) {
          return { valid: false, reason: `Unapproved project preview: ${pid}` };
        }
        return { valid: true, name, sanitized: { projectId: pid } };
      }
      case 'prefillContactBrief': {
        const sType = String(params.serviceType || '').toLowerCase().trim();
        if (sType && !APPROVED_SERVICES.includes(sType)) {
          return { valid: false, reason: `Unapproved service type: ${sType}` };
        }
        const rawDetails = String(params.details || '');
        // Strip HTML tags and clamp length to 500 chars
        const sanitizedDetails = rawDetails.replace(/<[^>]*>?/gm, '').slice(0, 500);
        return {
          valid: true,
          name,
          sanitized: { serviceType: sType || 'signature-website', details: sanitizedDetails }
        };
      }
      case 'toggleAudioOutput': {
        return {
          valid: true,
          name,
          sanitized: { enabled: Boolean(params.enabled) }
        };
      }
      case 'openDevSettings': {
        return { valid: true, name, sanitized: {} };
      }
      default:
        return { valid: false, reason: `Forbidden or unknown action: ${name}` };
    }
  }

  async dispatch(actionCall) {
    const validated = this.validateAction(actionCall);
    if (!validated.valid) {
      throw new Error(`Action rejected by security gate: ${validated.reason}`);
    }
    const handler = this.handlers[validated.name];
    if (typeof handler === 'function') {
      return await handler(validated.sanitized);
    }
    return { status: 'acknowledged', action: validated.name, params: validated.sanitized };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ZadaActionDispatcher,
    APPROVED_SECTIONS,
    APPROVED_PROJECTS,
    APPROVED_SERVICES
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/zada-actions.test.cjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/zada-actions.test.cjs assets/js/zada-actions.js
git commit -m "feat(zada): implement secure ZadaActionDispatcher whitelist gate"
```

---

### Task 4: Delta-Time Procedural Kinematics (`ZadaMotionController`)

**Files:**
- Create: `test/zada-motion.test.cjs`
- Create: `assets/js/zada-motion.js`

**Interfaces:**
- Consumes: `ZadaStateManager`, elapsed delta time ($dt$).
- Produces: `ZadaMotionController` with `update(dt, audioEnvelope, cursorNormalized)`, `getTransform()`, `setReducedMotion(bool)`.

- [ ] **Step 1: Write unit test for delta-time invariance and bounds**

```javascript
// test/zada-motion.test.cjs
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
    // Simulate high audio envelope
    motion.update(0.016, 1.0, { x: 0, y: 0 });
    const t = motion.getTransform();
    assert.ok(t.scale <= 1.04, `Scale ${t.scale} must be <= 1.04`);
  });

  await t.test('reduced motion clamps oscillations', () => {
    const motion = new ZadaMotionController({ reducedMotion: true });
    motion.update(1.0, 0, { x: 1, y: 1 });
    const t = motion.getTransform();
    assert.equal(t.position.y, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/zada-motion.test.cjs`  
Expected: FAIL

- [ ] **Step 3: Implement `ZadaMotionController`**

```javascript
// assets/js/zada-motion.js
class ZadaMotionController {
  constructor(options = {}) {
    this.reducedMotion = Boolean(options.reducedMotion);
    this.elapsedTime = 0;
    this.targetRotation = { x: 0, y: 0, z: 0 };
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.currentPosition = { x: 0, y: 0, z: 0 };
    this.currentScale = 1.0;
    this.audioEnvelope = 0;
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
  }

  update(dt, rawAudioEnvelope = 0, cursor = { x: 0, y: 0 }, state = 'IDLE') {
    this.elapsedTime += dt;
    const t = this.elapsedTime;

    // 1. Audio smoothing: fast attack (~15ms), smooth release (~120ms)
    const attack = Math.min(1.0, dt * 60.0);
    const release = Math.min(1.0, dt * 8.0);
    const coeff = rawAudioEnvelope > this.audioEnvelope ? attack : release;
    this.audioEnvelope += (rawAudioEnvelope - this.audioEnvelope) * coeff;

    // 2. Base levitation (Incommensurate frequencies)
    if (this.reducedMotion) {
      this.currentPosition.y = 0;
    } else {
      const baseY = Math.sin(1.173 * t) * 0.08 + Math.cos(0.781 * t) * 0.04;
      const audioY = this.audioEnvelope * 0.025;
      this.currentPosition.y = baseY + audioY;
    }

    // 3. Audio scale reaction: strictly clamped to < 4%
    const scalePulse = Math.min(0.04, this.audioEnvelope * 0.04);
    this.currentScale = 1.0 + scalePulse;

    // 4. Subtle cursor look-at damping with deadzone
    const deadzone = 0.08;
    const dist = Math.hypot(cursor.x, cursor.y);
    if (dist > deadzone && !this.reducedMotion) {
      const maxAngle = 0.21; // ~12 degrees
      this.targetRotation.y = Math.max(-maxAngle, Math.min(maxAngle, cursor.x * maxAngle));
      this.targetRotation.x = Math.max(-maxAngle, Math.min(maxAngle, -cursor.y * maxAngle));
    } else {
      this.targetRotation.x = 0;
      this.targetRotation.y = 0;
    }

    // Slerp damping factor
    const slerpFactor = Math.min(1.0, dt * 4.0);
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * slerpFactor;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * slerpFactor;

    // Idle precession wobble
    if (!this.reducedMotion) {
      this.currentRotation.z = Math.sin(0.92 * t) * 0.025;
    } else {
      this.currentRotation.z = 0;
    }
  }

  getTransform() {
    return {
      position: { ...this.currentPosition },
      rotation: { ...this.currentRotation },
      scale: this.currentScale
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZadaMotionController };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/zada-motion.test.cjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/zada-motion.test.cjs assets/js/zada-motion.js
git commit -m "feat(zada): implement delta-time procedural kinematics with clamped audio response"
```

---

### Task 5: Restrained Aura System (`ZadaAura`)

**Files:**
- Create: `test/zada-aura.test.cjs`
- Create: `assets/js/zada-aura.js`

**Interfaces:**
- Consumes: Three.js `THREE.Group`, bounding radius, state, audio amplitude.
- Produces: `ZadaAura` with `createAura(scene, radius)`, `update(dt, state, audioEnvelope)`, `dispose()`.
- Strict Invariant: Overall aura radius $\le 1.40\times$ bounding radius.

- [ ] **Step 1: Write test verifying aura scale clamp invariant**

```javascript
// test/zada-aura.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { ZadaAuraConfig } = require('../assets/js/zada-aura.js');

test('ZadaAura configuration & bounds verification', async (t) => {
  await t.test('maximum aura scale boundary is strictly clamped to 1.40x', () => {
    assert.ok(ZadaAuraConfig.MAX_SCALE_FACTOR <= 1.40, 'Max scale factor must not exceed 1.40');
    assert.equal(ZadaAuraConfig.CORE_SCALE_FACTOR, 1.15);
    assert.equal(ZadaAuraConfig.RING_SCALE_FACTOR, 1.25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/zada-aura.test.cjs`  
Expected: FAIL

- [ ] **Step 3: Implement `ZadaAura`**

```javascript
// assets/js/zada-aura.js
const ZadaAuraConfig = {
  MAX_SCALE_FACTOR: 1.40,
  CORE_SCALE_FACTOR: 1.15,
  RING_SCALE_FACTOR: 1.25,
  PARTICLE_MAX_RADIUS: 1.35
};

class ZadaAura {
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

  build(radius = 1.0, qualityTier = 3) {
    this.baseRadius = radius;
    const THREE = this.THREE;

    // 1. Core Fresnel Field (1.15x)
    const coreGeo = new THREE.SphereGeometry(radius * ZadaAuraConfig.CORE_SCALE_FACTOR, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00f7ff,
      transparent: true,
      opacity: 0.18,
      wireframe: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);

    // 2. Holographic Signal Ring (1.25x)
    const ringGeo = new THREE.TorusGeometry(radius * ZadaAuraConfig.RING_SCALE_FACTOR, 0.008 * radius, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f7ff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = Math.PI / 2.3;
    this.group.add(this.ringMesh);

    // 3. Micro-Particle Cloud (Quality tiered: 20 - 75 particles)
    const count = qualityTier === 3 ? 75 : qualityTier === 2 ? 40 : 20;
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
      color: 0x00f7ff,
      size: 0.025 * radius,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.particles = new THREE.Points(partGeo, partMat);
    this.group.add(this.particles);

    return this.group;
  }

  update(dt, state, audioEnvelope = 0) {
    this.elapsedTime += dt;
    const t = this.elapsedTime;

    // Modulate ring rotation based on state
    const ringSpeed = state === 'THINKING' ? 3.0 : 0.8;
    if (this.ringMesh) {
      this.ringMesh.rotation.z += dt * ringSpeed;
    }

    // Audio-reactive luminescence (capped to +25%)
    const audioBoost = Math.min(0.25, audioEnvelope * 0.25);
    if (this.coreMesh) {
      const baseOpacity = state === 'LISTENING' ? 0.26 : 0.18;
      this.coreMesh.material.opacity = baseOpacity + audioBoost;
    }

    // Subtle particle drift
    if (this.particles) {
      this.particles.rotation.y += dt * 0.15;
    }
  }

  dispose() {
    if (this.coreMesh) {
      this.coreMesh.geometry.dispose();
      this.coreMesh.material.dispose();
    }
    if (this.ringMesh) {
      this.ringMesh.geometry.dispose();
      this.ringMesh.material.dispose();
    }
    if (this.particles) {
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZadaAura, ZadaAuraConfig };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/zada-aura.test.cjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/zada-aura.test.cjs assets/js/zada-aura.js
git commit -m "feat(zada): implement restrained ZadaAura with 1.40x boundary invariant"
```

---

### Task 6: Audio Synchronization & Cancellation (`ZadaAudioSync`)

**Files:**
- Create: `test/zada-audio.test.cjs`
- Create: `assets/js/zada-audio.js`

**Interfaces:**
- Produces: `ZadaAudioSync` with `playStream(audioBuffer)`, `speak(text, onEnd)`, `getAmplitude()`, `interrupt()`, `setMuted(bool)`.

- [ ] **Step 1: Write test for audio interruption and mute control**

```javascript
// test/zada-audio.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { ZadaAudioSync } = require('../assets/js/zada-audio.js');

test('ZadaAudioSync state and interruption management', async (t) => {
  await t.test('interrupt aborts playback and resets amplitude', () => {
    const audio = new ZadaAudioSync();
    audio.amplitude = 0.8;
    audio.interrupt();
    assert.equal(audio.getAmplitude(), 0);
    assert.equal(audio.isPlaying(), false);
  });

  await t.test('mute flag prevents audio output', () => {
    const audio = new ZadaAudioSync();
    audio.setMuted(true);
    assert.equal(audio.isMuted(), true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/zada-audio.test.cjs`  
Expected: FAIL

- [ ] **Step 3: Implement `ZadaAudioSync`**

```javascript
// assets/js/zada-audio.js
class ZadaAudioSync {
  constructor() {
    this.muted = false;
    this.amplitude = 0;
    this.playing = false;
    this.abortController = null;
    this.audioContext = null;
    this.analyser = null;
    this.speechUtterance = null;
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) {
      this.interrupt();
    }
  }

  isPlaying() {
    return this.playing;
  }

  getAmplitude() {
    return this.muted ? 0 : this.amplitude;
  }

  interrupt() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.playing = false;
    this.amplitude = 0;
  }

  speak(text, onEnd) {
    this.interrupt();
    if (this.muted || !text) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    this.abortController = new AbortController();
    this.playing = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Procedural envelope simulation tied to speech boundary events
    utterance.onboundary = () => {
      this.amplitude = 0.5 + Math.random() * 0.4;
    };
    utterance.onend = () => {
      this.playing = false;
      this.amplitude = 0;
      if (typeof onEnd === 'function') onEnd();
    };
    utterance.onerror = () => {
      this.playing = false;
      this.amplitude = 0;
      if (typeof onEnd === 'function') onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZadaAudioSync };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/zada-audio.test.cjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/zada-audio.test.cjs assets/js/zada-audio.js
git commit -m "feat(zada): implement ZadaAudioSync with unified AbortController and speech envelope"
```

---

### Task 7: Adaptive WebGL 3D Renderer & Viewport Docking (`ZadaRenderer`)

**Files:**
- Create: `assets/js/zada-renderer.js`

**Interfaces:**
- Consumes: Three.js, `assets/zada.glb`, `ZadaAura`, `ZadaMotionController`, `ZadaStateManager`.
- Produces: `ZadaRenderer` with `init(containerEl)`, `start()`, `pause()`, `resize()`, `dispose()`.

- [ ] **Step 1: Implement `ZadaRenderer`**

Create `assets/js/zada-renderer.js` implementing:
- Transparent WebGL canvas (`clearColor: 0x000000, 0`).
- Adaptive DPR capping (`Math.min(window.devicePixelRatio, 1.75)` on desktop, `1.25` on mobile).
- `IntersectionObserver` and `document.hidden` auto-pause.
- `webglcontextlost` and `webglcontextrestored` event handling.
- Smooth docking transition calculation between Hero anchor and bottom-right viewport pod.

- [ ] **Step 2: Verify in Node test environment that class can be required without crashing**

Create a sanity test `test/zada-renderer-sanity.test.cjs` asserting class exports.

- [ ] **Step 3: Run sanity test**

Run: `node --test test/zada-renderer-sanity.test.cjs`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add assets/js/zada-renderer.js test/zada-renderer-sanity.test.cjs
git commit -m "feat(zada): implement adaptive ZadaRenderer with context recovery and viewport docking"
```

---

### Task 8: Backend Gemini Proxy (`/api/chat`) & Rate Limiting

**Files:**
- Modify: `open-site-server.cjs`
- Create: `test/server-chat.test.cjs`

**Interfaces:**
- Produces: `POST /api/chat` accepting `{ messages: Array }`, validating length and rate limits, forwarding to Gemini API with strict system prompt and tool declarations.

- [ ] **Step 1: Write integration tests for `/api/chat` route**

```javascript
// test/server-chat.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('/api/chat endpoint validation', async (t) => {
  // Test rejecting payloads exceeding 64KB
  await t.test('rejects payload exceeding body size limit', (t, done) => {
    const postData = JSON.stringify({ message: 'x'.repeat(70000) });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4173,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      assert.equal(res.statusCode, 413);
      done();
    });
    req.on('error', done);
    req.write(postData);
    req.end();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server-chat.test.cjs`  
Expected: FAIL (404 or connection refused)

- [ ] **Step 3: Implement `/api/chat` in `open-site-server.cjs`**

Incorporate:
- Rate limiter: sliding window of max 15 requests/minute per IP.
- Max payload 64 KB.
- System prompt defining Zada persona, grounded Webzad capabilities, and tool declarations for whitelisted actions.
- Safe error mask (never expose `process.env.GEMINI_API_KEY`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server-chat.test.cjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add open-site-server.cjs test/server-chat.test.cjs
git commit -m "feat(api): implement secure /api/chat Gemini proxy with rate limiting and tool schemas"
```

---

### Task 9: Holographic HUD & Developer Settings UI

**Files:**
- Create: `assets/js/zada-holo-ui.js`
- Create: `assets/css/zada.css`

**Interfaces:**
- Consumes: `ZadaStateManager`, `ZadaActionDispatcher`, `ZadaAudioSync`.
- Produces: `ZadaHoloUI` with `mount(containerEl)`, `open()`, `close()`, `addMessage(sender, text)`.

- [ ] **Step 1: Create `assets/css/zada.css`**

Add CSS styles:
- Holographic glassmorphism overlay with cyan micro-borders (`#00f7ff`).
- Viewport collision bounds respecting `env(safe-area-inset-bottom)`.
- Radial projection positioning around Zada.
- Developer modal styles with prominent `⚠ LOCAL DEVELOPMENT ONLY — NOT SECURE FOR PRODUCTION` badge.

- [ ] **Step 2: Implement `assets/js/zada-holo-ui.js`**

Implement:
- Dialogue stream rendering with markdown support.
- Status telemetry indicator (`● READY`, `● LISTENING`, `● PROCESSING`, `● SPEAKING`).
- Contextual quick-action prompt chips based on active section.
- Speech-to-text mic button and text input form.
- Developer Settings Modal with `[ ENTER GEMINI API KEY HERE ]` and Clear Key controls.

- [ ] **Step 3: Commit**

```bash
git add assets/css/zada.css assets/js/zada-holo-ui.js
git commit -m "feat(zada): implement holographic HUD interface and developer configuration modal"
```

---

### Task 10: Unified Orchestration & HTML Integration

**Files:**
- Create: `assets/js/zada.js`
- Modify: `index.html`

**Interfaces:**
- Mounts Zada container, initializes `ZadaStateManager`, `ZadaRenderer`, `ZadaMotionController`, `ZadaAura`, `ZadaAudioSync`, `ZadaHoloUI`, and `ZadaActionDispatcher`.
- Preserves all existing HTML elements and event listeners intact.

- [ ] **Step 1: Implement `assets/js/zada.js`**

Create the coordinator initializing all modules, connecting the action dispatcher to existing page elements (`scrollToSection` triggering smooth scroll, `openProjectPreview` triggering existing lightbox, `prefillContactBrief` populating `#contactForm` without submitting).

- [ ] **Step 2: Non-destructively mount Zada into `index.html`**

Add `<link rel="stylesheet" href="assets/css/zada.css">` and `<script type="module" src="assets/js/zada.js"></script>` to `index.html`. Add developer modal trigger in footer.

- [ ] **Step 3: Run full test suite**

Run: `node --test test/*.test.cjs`  
Expected: ALL PASS

- [ ] **Step 4: Manual browser verification via local server**

1. Verify Zada floats beside hero on load.
2. Verify smooth transition to floating dock upon scroll.
3. Verify click expands holographic HUD without obscuring model.
4. Verify whitelisted actions (navigating to services, prefilling contact form).
5. Verify existing site features (video parallax, portfolio lightbox, mobile menu) operate identically.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/js/zada.js
git commit -m "feat(zada): integrate complete Zada 3D AI companion system into Webzad"
```
