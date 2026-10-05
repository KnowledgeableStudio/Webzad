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

/** Resolves cross-origin API base: webzad.dev on static hosting proxies API calls to the Pages Functions origin. */
const ZADA_API_BASE = (typeof location !== 'undefined' && /^(www\.)?webzad\.dev$/.test(location.hostname)) ? 'https://webzad.pages.dev' : '';

/** Contextual quick-action prompt chips per website section */
const SECTION_PROMPTS = Object.freeze({
  hero: Object.freeze(['What is Webzad?', 'Show Selected Work', 'Start Project Brief']),
  services: Object.freeze(['Explain Signature Websites', 'Custom Web Apps', 'Get Tailored Scope']),
  automation: Object.freeze(['AI Workflow Agents', 'Connect Business Tools', 'Automate Onboarding']),
  work: Object.freeze(['Authority Websites', 'Hospitality Experience', 'Growth Campaigns']),
  process: Object.freeze(['How do we start?', 'Design & Build Phase', 'Turnaround Times']),
  contact: Object.freeze(['Prefill Signature Website', 'Direct Email', 'Schedule Discovery'])
});

class ZadaCompanion {
  constructor(options = {}) {
    this.options = options;
    this.cursor = { x: 0, y: 0 };
    this.dockMode = this.activeSection = 'hero';
    this.isInitialized = false;
    this.stateManager = options.stateManager || (ZadaStateManager ? new ZadaStateManager() : null);
    this.audioSync = options.audioSync || (ZadaAudioSync ? new ZadaAudioSync() : null);
    this.motion = options.motion || (ZadaMotionController ? new ZadaMotionController() : null);
    this.aura = options.aura || (options.THREE && ZadaAura ? new ZadaAura(options.THREE) : null);
    this.actionDispatcher = options.actionDispatcher || (ZadaActionDispatcher ? new ZadaActionDispatcher(this._createActionHandlers()) : null);
    this.holoUI = options.holoUI || (ZadaHoloUI ? new ZadaHoloUI({
      stateManager: this.stateManager, audioSync: this.audioSync, actionDispatcher: this.actionDispatcher,
      promptChips: SECTION_PROMPTS.hero, onSendMessage: (msg) => this.handleUserMessage(msg)
    }) : null);
    this.renderer = options.renderer || (ZadaRenderer ? new ZadaRenderer({
      THREE: options.THREE, aura: this.aura, motion: this.motion, stateManager: this.stateManager, audioSync: this.audioSync, cursor: this.cursor
    }) : null);
    this.container = this.podTrigger = this.canvasWrapper = this._boundScroll = this._boundMouse = this._boundResize = null;
  }

  async init(containerEl, config = {}) {
    if (!containerEl) return false;
    this.container = containerEl;
    this.createElement = config.createElement || this.options.createElement || null;
    const create = this.createElement || ((t) => (typeof document !== 'undefined' ? document.createElement(t) : null));
    this.canvasWrapper = create('div');
    if (this.canvasWrapper) {
      this.canvasWrapper.className = 'zada-canvas-wrapper';
      if (containerEl.appendChild) containerEl.appendChild(this.canvasWrapper);
    }
    if (!config.skipModelLoad && typeof window !== 'undefined') {
      try {
        const [threeMod, gltfMod] = await Promise.all([import('../vendor/three.module.js'), import('../vendor/GLTFLoader.js')]);
        if (this.renderer) {
          this.renderer.THREE = this.renderer.options.THREE = threeMod;
          this.renderer.options.GLTFLoader = gltfMod.GLTFLoader;
        }
        if (!this.aura && ZadaAura) {
          this.aura = new ZadaAura(threeMod);
          if (this.renderer) this.renderer.aura = this.aura;
        }
      } catch (e) { console.warn('[Zada] 3D vendor load failed:', e.message); }
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
    this.podTrigger.className = 'zada-pod-trigger zada-chat-circle';
    this.podTrigger.setAttribute('type', 'button');
    this.podTrigger.setAttribute('aria-label', 'Open Zada AI Assistant');
    this.podTrigger.setAttribute('title', 'Chat with Zada AI Specialist');
    this.podTrigger.innerHTML = `
      <div class="zada-chat-avatar-wrap">
        <img src="assets/zada-avatar.jpg" alt="Zada AI Specialist" class="zada-chat-avatar-img" />
        <div class="zada-chat-online-badge" aria-hidden="true"></div>
      </div>
    `;
    this.podTrigger.addEventListener('click', () => {
      this.hideGreetingBubble();
      this.holoUI?.toggle?.();
    });
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
    this.handleScroll();
  }

  async _loadCompanionModel() {
    try {
      if (this.renderer?.loadModel) await this.renderer.loadModel('assets/zada.glb');
    } catch (e) { console.warn('[Zada] 3D model load failed:', e.message); }
  }

  handleScroll(scrollY) {
    const y = typeof scrollY === 'number' ? scrollY : (typeof window !== 'undefined' ? window.pageYOffset : 0);
    const nextMode = (y >= 200) ? 'dock' : 'hero';
    if (this.dockMode !== nextMode) {
      this.dockMode = nextMode;
      this.renderer?.setDockMode?.(nextMode);
    }
    const section = this._detectSection();
    if (section !== this.activeSection) {
      this.activeSection = section;
      if (this.holoUI && SECTION_PROMPTS[section]) this.holoUI.setContextPrompts(SECTION_PROMPTS[section]);
    }
  }

  /** Detects which site section currently occupies the viewport midpoint. */
  _detectSection() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return this.activeSection || 'hero';
    const map = [['top', 'hero'], ['services', 'services'], ['automation', 'automation'], ['work', 'work'], ['process', 'process'], ['contact', 'contact']];
    const mid = window.innerHeight * 0.4;
    for (const [id, key] of map) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) return key;
    }
    return window.pageYOffset < 200 ? 'hero' : (this.activeSection || 'hero');
  }

  /** Builds a live snapshot of the visitor's on-page context for the chat backend. */
  _buildSiteContext() {
    try {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      return {
        section: this._detectSection(),
        scrollPercent: Math.max(0, Math.min(100, Math.round((window.pageYOffset / max) * 100))),
        dockMode: this.dockMode,
        device: (window.innerWidth < 768 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) ? 'mobile' : 'desktop',
        hudOpen: Boolean(this.holoUI?.isOpen),
        lastAction: this._lastAction || null
      };
    } catch { return null; }
  }

  /** Dispatches whitelisted tool calls, tracking the last action for conversational context. */
  async _dispatchToolCalls(toolCalls) {
    let primaryTool = null;
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
    primaryTool = toolCalls[0];
    for (const call of toolCalls) {
      try {
        await this.actionDispatcher?.dispatch?.(call);
        this._lastAction = { name: call.name, params: call.params || call.args || {}, at: Date.now() };
      } catch (e) { console.warn('[Zada] Action rejected:', e.message); }
    }
    return primaryTool;
  }

  /** Consumes a Gemini SSE stream, emitting text chunks and collecting tool calls. */
  async _consumeChatStream(body, onText) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', text = '', firstChunk = true;
    const toolCalls = [];
    const handleData = (jsonStr) => {
      let data;
      try { data = JSON.parse(jsonStr); } catch { return; }
      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.text) {
          text += p.text;
          if (firstChunk) {
            firstChunk = false;
            if (!this.stateManager?.setState?.('RESPONDING')) this.stateManager?.interrupt?.('RESPONDING');
          }
          onText?.(p.text);
        }
        if (p.functionCall) toolCalls.push({ name: p.functionCall.name, params: p.functionCall.args || {}, args: p.functionCall.args || {} });
      }
    };
    const flushLines = (chunk) => {
      for (const line of chunk.split('\n')) {
        const t = line.trim();
        if (t.startsWith('data:')) handleData(t.slice(5).trim());
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        flushLines(raw);
      }
    }
    buffer += decoder.decode();
    flushLines(buffer);
    return { text, toolCalls };
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
    const msgs = this.holoUI?.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.text !== text) {
      this.holoUI?.addMessage?.('user', text);
    }
    this.stateManager?.setState?.('THINKING');
    this.holoUI?.showTyping?.();
    try {
      const devKey = this.holoUI?.getDevKey?.() || '';
      const headers = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
      if (devKey) headers['x-gemini-api-key'] = devKey;
      const allMsgs = (this.holoUI?.messages || []).filter(m => m.role !== 'system' && m.text).map(m => ({ role: m.role, content: m.text }));
      const messages = [...allMsgs];
      while (messages.length > 0 && messages[0].role === 'zada') messages.shift();
      const fetchFn = this.options.fetchFn || globalThis.fetch;
      const res = await fetchFn(ZADA_API_BASE + '/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: messages.length > 0 ? messages : allMsgs, apiKey: devKey, context: this._buildSiteContext() })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMsg = data?.error || `HTTP ${res.status}`;
        console.error('[Zada] Chat API error:', res.status, errorMsg);
        throw new Error(errorMsg);
      }
      const ct = res.headers?.get?.('content-type') || '';
      let reply = '', primaryTool = null;
      if (ct.includes('text/event-stream') && res.body?.getReader) {
        const stream = this.holoUI?.startStreamMessage?.() || null;
        let result = await this._consumeChatStream(res.body, (chunk) => stream?.append?.(chunk));
        if (!result.text && result.toolCalls.length === 0) {
          // Empty/interrupted stream — retry once through the plain JSON path
          const retry = await fetchFn(ZADA_API_BASE + '/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(devKey ? { 'x-gemini-api-key': devKey } : {}) },
            body: JSON.stringify({ messages: messages.length > 0 ? messages : allMsgs, apiKey: devKey, context: this._buildSiteContext() })
          });
          const data = await retry.json().catch(() => ({}));
          if (!retry.ok) throw new Error(data?.error || `HTTP ${retry.status}`);
          if (data.text) { result.text = data.text; stream?.append?.(data.text); }
          result.toolCalls = data.toolCalls || [];
        }
        reply = result.text || 'Done.';
        primaryTool = await this._dispatchToolCalls(result.toolCalls);
        stream?.finalize?.(primaryTool);
        if (!stream) this.holoUI?.addMessage?.('zada', reply, primaryTool);
      } else {
        const data = await res.json().catch(() => ({}));
        reply = data.text || 'Understood.';
        primaryTool = await this._dispatchToolCalls(data.toolCalls);
        this.holoUI?.hideTyping?.();
        this.holoUI?.addMessage?.('zada', reply, primaryTool);
      }
      if (!this.stateManager?.setState?.('RESPONDING')) this.stateManager?.interrupt?.('RESPONDING');
      this.audioSync?.speak?.(reply, () => {
        if (!this.stateManager?.setState?.('IDLE')) this.stateManager?.interrupt?.('IDLE');
      });
    } catch (err) {
      this.holoUI?.hideTyping?.();
      console.error('[Zada] handleUserMessage error:', err);
      if (!this.stateManager?.setState?.('ERROR')) this.stateManager?.interrupt?.('ERROR');
      let notice = "I'm having trouble connecting right now. Please verify your API key in Developer Settings (⚙).";
      if (err.message && (err.message.toLowerCase().includes('prepayment') || err.message.toLowerCase().includes('credits') || err.message.includes('402'))) {
        notice = "Google AI Studio notice: Your prepayment credits are depleted. Please visit https://ai.studio/projects to manage your project billing.";
      } else if (err.message && (err.message.toLowerCase().includes('high demand') || err.message.includes('503'))) {
        notice = "Google Gemini is currently experiencing a brief demand spike. Please ask again in a moment.";
      } else if (err.message && (err.message.toLowerCase().includes('key') || err.message.includes('401'))) {
        notice = "Gemini API key is missing or invalid. Please open Developer Settings (⚙) to enter your Gemini API key.";
      } else if (err.message && !err.message.startsWith('HTTP')) {
        notice = `I'm having trouble connecting right now: ${err.message}. Please check Developer Settings (⚙).`;
      }
      this.holoUI?.addMessage?.('zada', notice);
      const errTimer = setTimeout(() => {
        if (this.stateManager?.getState() === 'ERROR') {
          if (!this.stateManager?.setState?.('IDLE')) this.stateManager?.interrupt?.('IDLE');
        }
      }, 3500);
      if (typeof errTimer?.unref === 'function') errTimer.unref();
    }
  }

  _createActionHandlers() {
    return {
      scrollToSection: async (p) => {
        const sid = p?.sectionId || 'hero';
        let el = this.options.getElement ? this.options.getElement(sid) : null;
        if (!el && typeof document !== 'undefined') {
          el = document.getElementById(sid) || (sid === 'hero' ? (document.getElementById('top') || document.querySelector('.hero')) : null);
        }
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
          const set = (sel, v) => { const el = form.querySelector?.(sel); if (el && v) el.value = v; };
          const select = form.querySelector ? form.querySelector('select[name="service"]') : null;
          if (select) {
            const map = {
              'signature-website': 'Signature Website',
              'landing-page': 'Landing Page',
              'web-app': 'Custom Web App',
              'autonomous-business': 'AI & Workflow Automation',
              'custom-ai': 'AI & Workflow Automation',
              'ai-automation': 'AI & Workflow Automation'
            };
            select.value = map[p.serviceType] || 'Signature Website';
          }
          set('input[name="name"]', p.name);
          set('input[name="email"]', p.email);
          set('input[name="company"]', p.company);
          set('input[name="timeline"]', p.timeline);
          set('textarea[name="goals"]', p.details);
          const contactSec = (this.options.getElement ? this.options.getElement('contact') : null) || (typeof document !== 'undefined' ? document.getElementById('contact') : null);
          (contactSec || form).scrollIntoView?.({ behavior: 'smooth' });
        }
        return { success: true, serviceType: p.serviceType };
      },
      dismissOverlay: async () => {
        if (typeof document === 'undefined') return { success: true };
        document.querySelector('.lightbox.open .lightbox-close')?.click?.();
        document.getElementById('mobileMenu')?.classList?.remove('open');
        this.holoUI?.closeDevSettings?.();
        this.hideGreetingBubble();
        return { success: true };
      },
      toggleAudioOutput: async (p) => {
        const enabled = Boolean(p?.enabled);
        this.audioSync?.setMuted?.(!enabled);
        if (this.holoUI?.muteBtnEl) {
          this.holoUI.muteBtnEl.textContent = !enabled ? '🔇' : '🔊';
          this.holoUI.muteBtnEl.classList.toggle('muted', !enabled);
        }
        return { success: true, enabled };
      },
      openDevSettings: async () => {
        this.holoUI?.openDevSettings?.();
        return { success: true };
      }
    };
  }

  /**
   * Displays an animated holographic speech bubble greeting above the pod trigger.
   * @param {string} text - Greeting message text.
   * @param {Function} [createElementFn] - Custom DOM element factory for headless testing.
   * @returns {HTMLElement|null}
   */
  showGreetingBubble(text, createElementFn = null) {
    this.hideGreetingBubble();
    const create = createElementFn || this.createElement || this.options.createElement || ((t) => (typeof document !== 'undefined' ? document.createElement(t) : null));
    if (!create) return null;
    const bubble = create('div');
    if (!bubble) return null;
    bubble.className = 'zada-greeting-bubble';
    bubble.classList?.add?.('zada-greeting-bubble');
    bubble.setAttribute?.('role', 'status');
    bubble.setAttribute?.('aria-live', 'polite');
    bubble.innerHTML = `
      <div class="zada-greeting-header">
        <span class="zada-greeting-badge">
          <span class="zada-greeting-dot" aria-hidden="true"></span>
          ZADA AI
        </span>
        <button type="button" class="zada-greeting-close" aria-label="Dismiss greeting">×</button>
      </div>
      <p class="zada-greeting-text"></p>
      <div class="zada-greeting-actions">
        <button type="button" class="zada-greeting-btn zada-greeting-chat">Chat with Zada</button>
        <button type="button" class="zada-greeting-btn zada-greeting-prompt">Explore Services</button>
      </div>
    `;
    const textEl = bubble.querySelector?.('.zada-greeting-text');
    if (textEl) textEl.textContent = String(text || '');

    const closeBtn = bubble.querySelector?.('.zada-greeting-close');
    closeBtn?.addEventListener?.('click', (e) => {
      e?.stopPropagation?.();
      this.hideGreetingBubble();
    });

    const chatBtn = bubble.querySelector?.('.zada-greeting-chat');
    chatBtn?.addEventListener?.('click', (e) => {
      e?.stopPropagation?.();
      this.hideGreetingBubble();
      this.holoUI?.open?.();
    });

    const promptBtn = bubble.querySelector?.('.zada-greeting-prompt');
    promptBtn?.addEventListener?.('click', (e) => {
      e?.stopPropagation?.();
      this.hideGreetingBubble();
      this.actionDispatcher?.dispatch?.({ name: 'scrollToSection', params: { sectionId: 'services' } })?.catch?.(() => {});
    });

    bubble.addEventListener?.('click', () => {
      this.hideGreetingBubble();
      this.holoUI?.open?.();
    });

    const targetContainer = this.container || (typeof document !== 'undefined' ? document.body : null);
    if (targetContainer?.appendChild) targetContainer.appendChild(bubble);
    this.greetingBubble = bubble;

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => bubble.classList?.add?.('visible'));
    } else {
      bubble.classList?.add?.('visible');
    }
    return bubble;
  }

  /**
   * Smoothly hides and removes the greeting bubble.
   */
  hideGreetingBubble() {
    if (this.greetingBubble) {
      const bubble = this.greetingBubble;
      bubble.classList?.remove?.('visible');
      this.greetingBubble = null;
      if (typeof setTimeout === 'function') {
        setTimeout(() => {
          if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
        }, 300);
      } else if (bubble.parentNode) {
        bubble.parentNode.removeChild(bubble);
      }
    }
  }

  /**
   * Welcomes the visitor with both visual greeting and natural voice audio.
   * @param {string} [customGreeting] - Optional custom greeting text.
   * @returns {string}
   */
  greetVisitor(customGreeting = null) {
    const greetingText = customGreeting || "Greetings! Welcome to Webzad. I'm Zada, your intelligent 3D companion. What can we help you build today?";
    if (this.holoUI && this.holoUI.messages?.length === 0) {
      this.holoUI.addMessage('zada', greetingText);
    }
    this.showGreetingBubble(greetingText);
    if (this.audioSync && !this.audioSync.muted) {
      this.stateManager?.setState?.('SPEAKING');
      this.audioSync.speak(greetingText, () => {
        this.stateManager?.setState?.('IDLE');
      });
    }
    return greetingText;
  }

  destroy() {
    this.hideGreetingBubble();
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._boundScroll);
      window.removeEventListener('mousemove', this._boundMouse);
      window.removeEventListener('resize', this._boundResize);
    }
    this.renderer?.dispose?.();
    this.holoUI?.unmount?.();
    if (this.podTrigger?.parentNode) this.podTrigger.parentNode.removeChild(this.podTrigger);
    if (this.canvasWrapper?.parentNode) this.canvasWrapper.parentNode.removeChild(this.canvasWrapper);
    this.container = this.podTrigger = this.canvasWrapper = this.greetingBubble = null;
    this.isInitialized = false;
  }
}

// Auto-bootstrap in browser environment
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

    // Trigger welcoming greeting once page is fully loaded
    const triggerGreeting = () => {
      setTimeout(() => {
        companion.greetVisitor();
      }, 1200);
    };

    if (document.readyState === 'complete') {
      triggerGreeting();
    } else {
      window.addEventListener('load', triggerGreeting, { once: true });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountZada);
  else setTimeout(mountZada, 0);
}

const _exports = { ZadaCompanion, SECTION_PROMPTS };
if (typeof module !== 'undefined' && module.exports) module.exports = _exports;
if (typeof window !== 'undefined') Object.assign(window, _exports);
if (typeof globalThis !== 'undefined') Object.assign(globalThis, _exports);
