# Design Specification: Zada 3D AI Companion System

**Project:** Webzad (`webzad.dev`)  
**Feature:** Zada AI Companion — 3D Visual Identity, Procedural Kinematics, Restrained Aura, Audio-Reactive Synchronization, Gemini AI Backend, and Controlled Semantic Website Actions  
**Date:** 2026-09-28  
**Status:** Approved Specification  

---

## 1. Executive Summary & Vision

Webzad is upgrading its digital presence with **Zada**, an intelligent, floating, sci-fi 3D technological companion. Zada serves as the physical and conversational embodiment of Webzad, accompanying visitors throughout the site, explaining services, navigating approved sections, answering questions, and facilitating project briefs.

### Core Identity & Asset
* **Authoritative AI Identity:** Named **Zada** across all UI, voice, system prompts, and code.
* **3D Visual Identity:** The supplied 3D model file `E:\WEBZAD\Zada AI.glb` (~24.3 MB) is the authoritative, immutable physical appearance of Zada. It will be copied into the project at `assets/zada.glb`. The original asset is preserved without modification or replacement.
* **Personality:** Friendly, curious, intelligent, helpful, professional, energetic, respectful, and family-friendly. Zada never curses, insults, produces inappropriate content, pretends to be biological, or hallucinates capabilities.

### Core Architectural Invariant: Fault-Isolation & Graceful Degradation
> **Zada must degrade gracefully at every layer.** A failure in Gemini must not break audio; an audio failure must not break the 3D companion; a WebGL failure must not break the HUD; and a Zada failure must never break the underlying Webzad website.

---

## 2. High-Level System Architecture

```text
WEBZAD SYSTEM
│
├── Existing Website (Untouched & Fully Preserved)
│   ├── Navigation Bar (#nav)
│   ├── Hero Section (#hero + Background.mp4 parallax)
│   ├── Services Section (#services)
│   ├── Work Showcase (#work + Dynamic Lightbox)
│   ├── Process Section (#process)
│   └── Contact Brief Form (#contactForm)
│
└── Zada AI Companion Subsystem (Modular & Isolated)
    │
    ├── Gemini AI Backend Proxy
    │   └── open-site-server.cjs: POST /api/chat (process.env.GEMINI_API_KEY)
    │   └── Local Development Settings (Explicitly labeled NOT SECURE FOR PRODUCTION)
    │
    ├── Grounded Knowledge & Persona System
    │   └── Grounded system prompt (Known info vs. Website action vs. Unknown info)
    │
    ├── Semantic Action Validator & Security Gate
    │   └── Strict Whitelist & Permission Check (Zero arbitrary DOM/JS/URL execution)
    │
    ├── Centralized Authoritative State Machine (ZadaStateManager)
    │   └── Single source of truth for Zada's lifecycle states
    │
    ├── Layered Procedural Kinematics (ZadaMotionController)
    │   └── Delta-time driven, incommensurate frequencies, subtle cursor awareness
    │
    ├── Restrained Aura System (ZadaAura)
    │   └── Strict 1.4× maximum boundary, Webzad palette inheritance
    │
    ├── Audio Synchronization & Analysis Engine (ZadaAudioSync)
    │   └── Gemini Multimodal Audio (Web Audio AnalyserNode) + Web Speech fallback
    │   └── Unified AbortController cancellation for instant interruptions
    │
    ├── Holographic HUD Interface (ZadaHoloUI)
    │   └── Spatial HUD projecting around Zada without covering the 3D model
    │
    └── Adaptive WebGL 3D Renderer (ZadaRenderer)
        ├── Three.js WebGL canvas (transparent background, zero white flash)
        ├── Adaptive quality governor (DPR capping, dynamic particle tiering)
        ├── IntersectionObserver + document.hidden sleep
        ├── WebGL context loss & safe restoration
        └── Complete resource disposal (no memory leaks)
```

---

## 3. Section-by-Section Technical Specifications

### Section 1: Codebase Audit, Asset Pipeline & Dependencies

1. **Existing Site Preservation:**
   * All existing styles, fonts, markup, lightbox dialogs, scroll-reveal observers, and contact form handling in [index.html](file:///c:/Users/izadc/Desktop/Large-files/Webzad/index.html) remain fully intact.
   * Zada connects via non-intrusive container mounting and event listening.
2. **Asset Pipeline:**
   * Source model `E:\WEBZAD\Zada AI.glb` copied to `assets/zada.glb`.
   * Standard production-ready relative paths (`assets/zada.glb`) used everywhere.
   * Source file remains unmodified.
3. **Vendor Strategy:**
   * Self-contained vendor libraries placed in `assets/vendor/` (`three.min.js`, `GLTFLoader.js`) to guarantee offline reliability and eliminate external CDN latency or downtime risks.
   * Single Three.js instance check before initialization to prevent duplicate libraries.

---

### Section 2: 3D Scene, Restrained Aura & Adaptive Quality

1. **WebGL Canvas Initialization:**
   * `alpha: true`, `antialias: true`, `premultipliedAlpha: false`, `powerPreference: "default"`.
   * Clear color initialized to `0x000000, 0`.
   * Container styled with matching background to prevent any white rectangle or color flash during load.
   * Progressive, asynchronous shader compilation (`compileAsync` or non-blocking off-screen compile) ensuring zero main-thread hitching.
2. **Restrained Sci-Fi Aura System:**
   * **Boundary Invariant:** Under peak state, audio volume, and thinking activity, the aura is **strictly clamped to a maximum of 1.40× Zada's visual bounding scale**.
   * **Color Palette:** Inherits CSS custom properties from the Webzad visual identity (`var(--cyan, #00f7ff)`, `var(--magenta, #ff007a)`, `var(--bg, #050710)`).
   * **Layer 1 (Core Field):** Inverted-normal Fresnel shell with soft falloff and restrained opacity (0.15–0.30 baseline).
   * **Layer 2 (Micro-Particle Dust):** 30–90 tiny orbital motes drifting in subtle procedural paths.
   * **Layer 3 (Resonance Ring):** Thin, high-tech signal ring rotating at 1.25× scale, responding subtly to thinking and speech states.
3. **Adaptive GPU Performance Governor:**
   * Target: Smooth 60 FPS on capable devices; dynamically degrades gracefully on constrained hardware.
   * Device Pixel Ratio (DPR) clamped to:
     * Desktop: `Math.min(window.devicePixelRatio, 1.75)`
     * Mobile: `Math.min(window.devicePixelRatio, 1.25)`
   * Dynamic quality tiers based on rolling frame-time performance:
     * *Tier 3 (High):* Full particle density (90), full aura shaders, target 60 FPS.
     * *Tier 2 (Mid):* Reduced particles (45), simplified aura shell, DPR capped at 1.25.
     * *Tier 1 (Low / Battery Saver):* Minimal particles (20), lightweight fallback aura, DPR 1.0.
   * `IntersectionObserver` and `document.hidden` completely suspend the `requestAnimationFrame` loop when Zada is outside the viewport or the browser tab is inactive, resuming instantly on focus.
4. **WebGL Stability & Fallback:**
   * Listens for `webglcontextlost` and `webglcontextrestored`. Context restoration rebuilds geometries, materials, and textures cleanly without spawning duplicate animation loops.
   * If WebGL is completely unavailable or crashes, the system gracefully falls back to an ambient holographic SVG/CSS avatar. The AI conversation, voice synthesis, and semantic actions continue with zero interruption or layout jumping.

---

### Section 3: Procedural Kinematics & Authoritative State Machine

1. **Authoritative Central State Machine (`ZadaStateManager`):**
   * Single source of truth. All visual, kinematic, aura, and audio systems subscribe to state changes. No subsystem changes states independently.
   * Debouncing and transition guards prevent state flickering.
   * **State Flow Diagram:**
     ```text
     WELCOME
        ↓
      IDLE
      ↙ ↓ ↘
     LISTENING  THINKING  NAVIGATING
         ↓         ↓           ↓
       THINKING  RESPONDING  SUCCESS
           ↘        ↓          ↙
                  IDLE

     Any active state ──► INTERRUPTED ──► appropriate new state
     Any state ─────────► ERROR / WARNING ──► previous / IDLE
     IDLE ──────────────► GOODBYE ──► dormant
     ```
2. **Delta-Time Driven Procedural Motion (`ZadaMotionController`):**
   * Driven strictly by elapsed delta time ($dt$), ensuring identical motion speeds across 30, 60, 120, and 240 Hz displays.
   * Incommensurate, deterministic frequencies avoid repetitive looping:
     $$y(t) = A_1 \sin(1.173 \cdot t) + A_2 \cos(0.781 \cdot t)$$
   * **Subtle Cursor Awareness:** Slerp-damped rotation with a dead zone, maximum angle clamp ($\le 12^\circ$), and automatic return-to-neutral when cursor is idle.
   * **Audio Amplitude Motion:** Smoothed RMS envelope with attack/release filters. Vertical micro-elevation $< 0.03$ units, scale expansion strictly capped at $< 4\%$.
   * **Accessibility:** Full respect for `prefers-reduced-motion: reduce`. Harmonic levitation is locked to a calm, stabilized hovering posture.
3. **Viewport Continuity (Hero Anchor to Floating Dock):**
   * A single persistent 3D instance is maintained throughout the browsing experience.
   * Smoothly interpolates transform, scale, and screen coordinates between Hero Anchor Mode and Fixed Viewport Dock Mode upon scrolling.
   * Mobile and foldable layouts dynamically account for `env(safe-area-inset-bottom)` and ensure interactive elements remain unobstructed.

---

### Section 4: Gemini AI Integration, Action Whitelist & Security

1. **Backend Integration (`open-site-server.cjs`):**
   * Secure `POST /api/chat` endpoint.
   * Production credentials loaded exclusively from `process.env.GEMINI_API_KEY`.
   * Security & Abuse Controls:
     * Request body size limit (max 64 KB).
     * Conversation history length limit (max 20 turns per session).
     * In-memory token bucket rate limiting (max 15 requests/minute per client IP).
     * Abort / timeout controller (15s timeout).
     * Stripped error responses (no internal stack traces or API keys exposed).
     * Zero logging of sensitive user prompts or credentials.
2. **Local Developer Settings (Explicit Warning):**
   * Developer configuration modal clearly labeled:
     > `⚠ LOCAL DEVELOPMENT ONLY — NOT SECURE FOR PRODUCTION.`  
     > `Production credentials must remain server-side.`
   * Key stored in `localStorage` under `webzad_dev_gemini_key` solely for local/offline testing, with a prominent **Clear Key** control.
   * Excluded from Git, frontend bundles, and telemetry.
3. **Semantic Action Whitelist & Permission Gate:**
   * Gemini has **zero access to arbitrary JavaScript, DOM selectors, HTML, CSS, or URLs**.
   * Only strictly typed semantic action enums can be executed:
     ```text
     AI Structured Tool Output
                ↓
     Schema Validation Guard
                ↓
     Action Allowlist Verification
                ↓
     Parameter Type & Length Check
                ↓
     Permission & Confirmation Gate
                ↓
     ZadaActionDispatcher Execution
                ↓
     ZadaStateManager (NAVIGATING / SUCCESS)
     ```
   * **Whitelisted Actions:**
     * `scrollToSection({ sectionId: "hero" | "services" | "work" | "process" | "contact" })`
     * `openProjectPreview({ projectId: "growth" | "hospitality" | "services" })` (activates existing lightbox)
     * `prefillContactBrief({ serviceType, details })`:
       * Service types restricted to: `"signature-website" | "landing-page" | "web-app" | "autonomous-business" | "custom-ai"`.
       * Details sanitized and clamped to 500 characters max.
       * **Safety Invariant:** `prefillContactBrief` **never submits automatically**. It populates fields, scrolls into view, and awaits explicit user review and submission.
     * `toggleAudioOutput({ enabled: boolean })`
4. **Grounded Knowledge Base:**
   * **Known Webzad Info:** Answers directly with accurate service capabilities.
   * **Approved Site Actions:** Triggers whitelisted semantic actions.
   * **Unknown Info:** Explicitly clarifies that the information is unavailable; never hallucinates features.
   * **External Questions:** Gracefully refocuses on Webzad's services.

---

### Section 5: Holographic HUD, Audio Synchronization & Performance Testing

1. **Holographic HUD Interface (`ZadaHoloUI`):**
   * Projects radially around Zada's physical coordinates without obscuring the 3D model.
   * Dynamically clamps within viewport safe areas, preventing clipping on mobile, tablet, and ultrawide displays.
   * Controls include: live status pill, voice mute/unmute toggle, message dialogue stream, quick contextual prompt pills, text input, speech-to-text microphone button, and keyboard/focus management (`Esc` to dismiss).
2. **Audio Synchronization & Analysis Engine (`ZadaAudioSync`):**
   * **Gemini Multimodal Audio:** Decoded via Web Audio API; real-time `AnalyserNode` (`fftSize: 64`) measures vocal amplitude.
   * **Web Speech Synthesis Fallback:** Uses synthetic smoothed envelope based on speech event boundaries (`start`, `boundary`, `end`) without making unverified claims about phoneme timing.
   * **Attack/Release Smoothing:** Fast attack ($\sim 15\text{ ms}$) and smooth release ($\sim 120\text{ ms}$) prevent jerky model vibrations.
   * **Unified Cancellation Controller:** A single `AbortController` handles interruption from user speech, clicks, or esc, instantly aborting audio playback and switching Zada to `LISTENING`.
3. **Comprehensive Quality, Stress & Performance Testing Strategy:**
   * **Unit Tests:** State transitions, invalid transition rejections, schema validation, action parameter sanitization, and delta-time invariance across 16.6ms, 33.3ms, and 8.3ms intervals.
   * **Responsive & Form Factor Stress Tests:** Narrow phones (320px–375px), tablets, desktop, ultrawide (21:9 / 32:9), foldables, large displays, browser zoom (150%–200%), and small viewport heights.
   * **Performance Budgets:**
     * Frame-time stability: $\ge 95\%$ of frames within target budget under normal operation.
     * WebGL resource tracking: Zero progressive texture/geometry accumulation.
     * Time-to-first-response: $< 1.2\text{s}$ under typical network conditions.
     * HUD input latency: $< 50\text{ ms}$.
   * **Visual Regression Guard:** Verify zero white WebGL rectangles, no flashing canvases, no duplicate models, no disappearing aura, no text clipping, and no extraneous scrollbars created by Zada.
   * **Long-Session Soak Test:** Continuous multi-hour runtime verification ensuring zero GPU memory leaks, listener accumulation, or animation drift.

---

## 4. Implementation Readiness & Path Forward

Upon final user approval of this specification, implementation will proceed through the `writing-plans` workflow, decomposing work into test-driven phases:
1. Vendor & model asset staging (`assets/zada.glb`, `assets/vendor/`).
2. WebGL scene, lighting, transparent renderer, and adaptive quality governor.
3. Restrained aura system with strict $1.4\times$ boundary clamping.
4. Central state machine (`ZadaStateManager`) & delta-time kinematic controller.
5. Audio sync engine with unified `AbortController` cancellation.
6. Semantic action whitelist & permission dispatcher.
7. Backend `/api/chat` proxy with rate limiting & sanitization.
8. Holographic HUD overlay & developer settings modal.
9. End-to-end integration, performance profiling, and cross-device validation.
