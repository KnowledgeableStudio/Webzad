/**
 * ZadaCompanion - Master Orchestrator for Zada 3D AI Companion.
 * Coordinates WebGL rendering, authoritative state machine, audio sync, holographic HUD, and action whitelist.
 */

const _StateMod = (typeof require !== 'undefined') ? require('./zada-state.js') : (typeof window !== 'undefined' ? window : {});
const _ActionMod = (typeof require !== 'undefined') ? require('./zada-actions.js') : (typeof window !== 'undefined' ? window : {});
const _MotionMod = (typeof require !== 'undefined') ? require('./zada-motion.js') : (typeof window !== 'undefined' ? window : {});
const _AuraMod = (typeof require !== 'undefined') ? require('./zada-aura.js') : (typeof window !== 'undefined' ? window : {});
const _AudioMod = (typeof require !== 'undefined') ? require('./zada-audio.js') : (typeof window !== 'undefined' ? window : {});
const _RendererMod = (typeof require !== 'undefined') ? require('./zada-renderer.js') : (typeof window !== 'undefined' ? window : {});
const _HoloMod = (typeof require !== 'undefined') ? require('./zada-holo-ui.js') : (typeof window !== 'undefined' ? window : {});

const ZadaStateManager = _StateMod.ZadaStateManager || globalThis.ZadaStateManager;
const ZadaActionDispatcher = _ActionMod.ZadaActionDispatcher || globalThis.ZadaActionDispatcher;
const ZadaMotionController = _MotionMod.ZadaMotionController || globalThis.ZadaMotionController;
const ZadaAura = _AuraMod.ZadaAura || globalThis.ZadaAura;
const ZadaAudioSync = _AudioMod.ZadaAudioSync || globalThis.ZadaAudioSync;
const ZadaRenderer = _RendererMod.ZadaRenderer || globalThis.ZadaRenderer;
const ZadaHoloUI = _HoloMod.ZadaHoloUI || globalThis.ZadaHoloUI;

/** Contextual quick-action prompt chips per website section */
const SECTION_PROMPTS = Object.freeze({
  hero: Object.freeze(['What is Webzad?', 'Show Selected Work', 'Start Project Brief']),
  services: Object.freeze(['Explain Signature Websites', 'Custom Web Apps', 'Get Tailored Scope']),
  work: Object.freeze(['Authority Websites', 'Hospitality Experience', 'Growth Campaigns']),
  process: Object.freeze(['How do we start?', 'Design & Build Phase', 'Turnaround Times']),
  contact: Object.freeze(['Prefill Signature Website', 'Direct Email', 'Schedule Discovery'])
});

/** Master coordinator connecting 3D WebGL companion, audio sync, state machine, and HUD. */
class ZadaCompanion {
  constructor(options = {}) {
    this.options = options;
    this.cursor = { x: 0, y: 0 };
    this.dockMode = 'hero';
    this.activeSection = 'hero';
    this.isInitialized = false;
    this.stateManager = options.stateManager || (ZadaStateManager ? new ZadaStateManager() : null);
    this.audioSync = options.audioSync || (ZadaAudioSync ? new ZadaAudioSync() : null);
    this.motion = options.motion || (ZadaMotionController ? new ZadaMotionController() : null);
    this.aura = options.aura || (options.THREE && ZadaAura ? new ZadaAura(options.THREE) : null);
    this.actionDispatcher = options.actionDispatcher || (ZadaActionDispatcher ? new ZadaActionDispatcher(this._createActionHandlers()) : null);
    this.holoUI = options.holoUI || (ZadaHoloUI ? new ZadaHoloUI({
      stateManager: this.stateManager, audioSync: this.audioSync, actionDispatcher: this.actionDispatcher,
      promptChips: SECTION_PROMPTS.hero, onSendMessage: (msg) => this.handleUserMessage(msg), onPromptSelect: (p) => this.handleUserMessage(p)
    }) : null);
    this.renderer = options.renderer || (ZadaRenderer ? new ZadaRenderer({
      THREE: options.THREE, aura: this.aura, motion: this.motion, stateManager: this.stateManager, audioSync: this.audioSync, cursor: this.cursor
    }) : null);
    this.container = this.podTrigger = this.canvasWrapper = this._boundScroll = this._boundMouse = this._boundResize = null;
  }

  async init(containerEl, config = {}) {
    if (!containerEl) return false;
    this.container = containerEl;
    const create = config.createElement || ((t) => (typeof document !== 'undefined' ? document.createElement(t) : null));
    this.canvasWrapper = create('div');
    if (this.canvasWrapper) {
      this.canvasWrapper.className = 'zada-canvas-wrapper';
      if (containerEl.appendChild) containerEl.appendChild(this.canvasWrapper);
    }
    if (!config.skipModelLoad && typeof window !== 'undefined') {
      try {
        const threeMod = await import('../vendor/three.module.js');
        const gltfMod = await import('../vendor/GLTFLoader.js');
        if (this.renderer) {
          this.renderer.THREE = threeMod;
          this.renderer.options.THREE = threeMod;
          this.renderer.options.GLTFLoader = gltfMod.GLTFLoader;
        }
        if (!this.aura && ZadaAura) {
          this.aura = new ZadaAura(threeMod);
          if (this.renderer) this.renderer.aura = this.aura;
        }
      } catch (e) {
        console.warn('[Zada] 3D vendor dependencies failed to load:', e.message);
      }
    }
    if (this.renderer?.init) this.renderer.init(this.canvasWrapper || containerEl);
    if (this.holoUI?.mount) this.holoUI.mount(containerEl, config);
    this._mountPodTrigger(containerEl, create);
    this._bindEvents();
    if (!config.skipModelLoad && typeof window !== 'undefined') await this._loadCompanionModel();
    this.renderer?.start?.();
    if (this.holoUI?.messages?.length === 0) {
      this.holoUI.addMessage('zada', "Greetings! I'm Zada, your intelligent 3D companion. How can I assist your project today?");
    }
    return (this.isInitialized = true);
  }

  _mountPodTrigger(containerEl, create) {
    this.podTrigger = create('button');
    if (!this.podTrigger) return;
    this.podTrigger.className = 'zada-pod-trigger';
    this.podTrigger.setAttribute('type', 'button');
    this.podTrigger.setAttribute('aria-label', 'Open Zada AI Companion');
    this.podTrigger.innerHTML = '<svg class="zada-pod-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
    this.podTrigger.addEventListener('click', () => this.holoUI?.toggle?.());
    if (containerEl.appendChild) containerEl.appendChild(this.podTrigger);
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;
    this._boundScroll = () => this.handleScroll();
    this._boundMouse = (e) => this.handleMouseMove(e.clientX, e.clientY);
    this._boundResize = () => this.renderer?.resize?.();
    window.addEventListener('scroll', this._boundScroll, { passive: true });
    window.addEventListener('mousemove', this._boundMouse, { passive: true });
    window.addEventListener('resize', this._boundResize, { passive: true });
  }

  async _loadCompanionModel() {
    try {
      if (!this.renderer?.loadModel) return;
      if (!this.renderer.options.GLTFLoader && typeof window !== 'undefined') {
        const gltfMod = await import('../vendor/GLTFLoader.js');
        this.renderer.options.GLTFLoader = gltfMod.GLTFLoader;
      }
      await this.renderer.loadModel('assets/zada.glb');
    } catch (e) {
      console.warn('[Zada] 3D model failed to load, falling back to HUD mode:', e.message);
    }
  }

  handleScroll(scrollY) {
    const y = typeof scrollY === 'number' ? scrollY : (typeof window !== 'undefined' ? window.pageYOffset : 0);
    const nextMode = (y >= 200) ? 'dock' : 'hero';
    if (this.dockMode !== nextMode) {
      this.dockMode = nextMode;
      this.renderer?.setDockMode?.(nextMode);
    }
  }

  handleMouseMove(cx, cy, iw, ih) {
    const w = iw || (typeof window !== 'undefined' ? window.innerWidth : 1000);
    const h = ih || (typeof window !== 'undefined' ? window.innerHeight : 800);
    this.cursor.x = Math.max(-1, Math.min(1, (cx / w) * 2 - 1));
    this.cursor.y = Math.max(-1, Math.min(1, (cy / h) * 2 - 1));
  }

  async handleUserMessage(text) {
    if (!text) return;
    this.audioSync?.interrupt?.();
    this.stateManager?.setState?.('THINKING');
    try {
      const devKey = this.holoUI?.getDevKey?.() || '';
      const headers = { 'Content-Type': 'application/json' };
      if (devKey) headers['x-gemini-api-key'] = devKey;
      const messages = (this.holoUI?.messages || []).map(m => ({ role: m.role, content: m.text }));
      const fetchFn = this.options.fetchFn || globalThis.fetch;
      const res = await fetchFn('/api/chat', { method: 'POST', headers, body: JSON.stringify({ messages }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.text || 'Understood.';
      let primaryTool = null;
      if (Array.isArray(data.toolCalls) && data.toolCalls.length > 0) {
        primaryTool = data.toolCalls[0];
        for (const call of data.toolCalls) {
          try { await this.actionDispatcher?.dispatch?.(call); } catch (e) { console.warn('[Zada] Action rejected:', e.message); }
        }
      }
      if (!this.stateManager?.setState?.('RESPONDING')) this.stateManager?.interrupt?.('RESPONDING');
      this.holoUI?.addMessage?.('zada', reply, primaryTool);
      this.audioSync?.speak?.(reply, () => {
        if (!this.stateManager?.setState?.('IDLE')) this.stateManager?.interrupt?.('IDLE');
      });
    } catch {
      if (!this.stateManager?.setState?.('ERROR')) this.stateManager?.interrupt?.('ERROR');
      this.holoUI?.addMessage?.('zada', "I'm having trouble connecting right now. Please try again in a moment.");
      setTimeout(() => {
        if (!this.stateManager?.setState?.('IDLE')) this.stateManager?.interrupt?.('IDLE');
      }, 2500);
    }
  }

  _createActionHandlers() {
    return {
      scrollToSection: async (p) => {
        const sid = p?.sectionId || 'hero';
        const el = (this.options.getElement ? this.options.getElement(sid) : null) || (typeof document !== 'undefined' ? document.getElementById(sid) : null);
        el?.scrollIntoView?.({ behavior: 'smooth' });
        this.activeSection = sid;
        if (this.holoUI && SECTION_PROMPTS[sid]) this.holoUI.setContextPrompts(SECTION_PROMPTS[sid]);
        return { success: true, sectionId: sid };
      },
      openProjectPreview: async (p) => {
        const pid = p?.projectId || 'growth';
        let card = this.options.getProjectCard ? this.options.getProjectCard(pid) : null;
        if (!card && typeof document !== 'undefined') {
          const sel = { growth: '[data-lightbox*="growth"]', hospitality: '[data-lightbox*="hospitality"]', services: '[data-lightbox*="services"]' }[pid];
          card = document.querySelector(sel || '[data-lightbox]');
        }
        card?.click?.();
        return { success: true, projectId: pid };
      },
      prefillContactBrief: async (p) => {
        const form = (this.options.getContactForm ? this.options.getContactForm() : null) || (typeof document !== 'undefined' ? document.getElementById('contactForm') : null);
        if (form) {
          const select = form.querySelector ? form.querySelector('select[name="service"]') : null;
          if (select) {
            const map = { 'signature-website': 'Signature Website', 'landing-page': 'Landing Page', 'web-app': 'Custom Web App', 'autonomous-business': 'Custom Web App', 'custom-ai': 'Custom Web App' };
            select.value = map[p.serviceType] || 'Signature Website';
          }
          const textarea = form.querySelector ? form.querySelector('textarea[name="goals"]') : null;
          if (textarea && p.details) textarea.value = p.details;
          const contactSec = (this.options.getElement ? this.options.getElement('contact') : null) || (typeof document !== 'undefined' ? document.getElementById('contact') : null);
          (contactSec || form).scrollIntoView?.({ behavior: 'smooth' });
        }
        return { success: true, serviceType: p.serviceType };
      },
      toggleAudioOutput: async (p) => {
        const enabled = Boolean(p?.enabled);
        this.audioSync?.setMuted?.(!enabled);
        return { success: true, enabled };
      },
      openDevSettings: async () => {
        this.holoUI?.openDevSettings?.();
        return { success: true };
      }
    };
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._boundScroll);
      window.removeEventListener('mousemove', this._boundMouse);
      window.removeEventListener('resize', this._boundResize);
    }
    this.renderer?.dispose?.();
    this.holoUI?.unmount?.();
    if (this.podTrigger?.parentNode) this.podTrigger.parentNode.removeChild(this.podTrigger);
    if (this.canvasWrapper?.parentNode) this.canvasWrapper.parentNode.removeChild(this.canvasWrapper);
    this.container = this.podTrigger = this.canvasWrapper = null;
    this.isInitialized = false;
  }
}

// Auto-bootstrap in browser environment when script is loaded
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const mountZada = async () => {
    let container = document.getElementById('zada-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'zada-container';
      container.className = 'zada-container';
      document.body.appendChild(container);
    }
    const companion = new ZadaCompanion();
    await companion.init(container);
    window.zadaCompanion = companion;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountZada);
  else setTimeout(mountZada, 0);
}

const _exports = { ZadaCompanion, SECTION_PROMPTS };
if (typeof module !== 'undefined' && module.exports) module.exports = _exports;
if (typeof window !== 'undefined') Object.assign(window, _exports);
if (typeof globalThis !== 'undefined') Object.assign(globalThis, _exports);
