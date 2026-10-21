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
  work: Object.freeze(['Show Zaddy.art', 'La Socieda Record', '1 of 6 Productions', 'BRG Official']),
  process: Object.freeze(['How do we start?', 'Design & Build Phase', 'Turnaround Times']),
  contact: Object.freeze(['Prefill Signature Website', 'Direct Email', 'Help Plan My Project'])
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
    if (!containerEl || this.isInitialized) return this.isInitialized;
    this._destroyed = false;
    this._config = config;
    this.container = containerEl;
    this.createElement = config.createElement || this.options.createElement || null;
    const create = this.createElement || ((tag) => (typeof document !== 'undefined' ? document.createElement(tag) : null));
    // Chat is the primary interface; the optional renderer must never block it.
    this.holoUI?.mount?.(containerEl, config);
    this.canvasWrapper = create('div');
    if (this.canvasWrapper) {
      this.canvasWrapper.className = 'zada-canvas-wrapper';
      this.canvasWrapper.hidden = true;
      (this.holoUI?.visualStageEl || containerEl).appendChild?.(this.canvasWrapper);
    }
    if (this.holoUI) {
      this.holoUI.options ||= {};
      const beforeOpen = this.holoUI.options.onOpen;
      const beforeClose = this.holoUI.options.onClose;
      this.holoUI.options.onOpen = () => {
        beforeOpen?.();
        if (this._threeReady) this._sync3DVisibility();
        else if (!config.skipModelLoad && this._motionAllowed()) this.ensure3D();
      };
      this.holoUI.options.onClose = () => { beforeClose?.(); this._sync3DVisibility(); };
      this.holoUI.options.onEnable3D = () => this.ensure3D();
    }
    this.motionPolicy = this.options.motionPolicy || (typeof window !== 'undefined' ? window.WebzadMotion : null);
    this._motionUnsubscribe = this.motionPolicy?.subscribe?.((enabled) => {
      if (enabled && !this._threeReady && !this._threePromise && !this._config?.skipModelLoad) this.ensure3D();
      else this._sync3DVisibility();
    });
    this._mountPodTrigger(containerEl, create);
    this._bindEvents();
    if (this.holoUI?.messages?.length === 0) {
      this.holoUI.addMessage('zada', "Greetings! I'm Zada, your intelligent 3D companion. How can I assist your project today?");
    }
    this.isInitialized = true;
    if (!config.skipModelLoad && this._motionAllowed()) this._schedule3DBoot();
    if (typeof window !== 'undefined') {
      window.zadaCompanion = this;
      window.dispatchEvent(new CustomEvent('zada:ready'));
    }
    return true;
  }

  _motionAllowed() {
    return this.motionPolicy ? this.motionPolicy.enabled : true;
  }

  /** Defers the optional 3D boot until after first paint so chat stays instant. */
  _schedule3DBoot() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._threeBootScheduled || this._threeReady || this._threePromise) return;
    this._threeBootScheduled = true;
    const idle = typeof window.requestIdleCallback === 'function'
      ? (cb) => window.requestIdleCallback(cb, { timeout: 2500 })
      : (cb) => setTimeout(cb, 900);
    const kick = () => {
      this._threeBootScheduled = false;
      if (this._destroyed || this._threeReady || this._threePromise || !this._motionAllowed()) return;
      this.ensure3D();
    };
    if (document.readyState === 'complete') idle(kick);
    else window.addEventListener('load', () => idle(kick), { once: true });
  }

  _sync3DVisibility() {
    if (!this._threeReady || !this.canvasWrapper || this._destroyed) return;
    const open = Boolean(this.holoUI?.isOpen);
    const stage = this.holoUI?.visualStageEl;
    if (open && stage) {
      if (this.canvasWrapper.parentNode !== stage) stage.appendChild(this.canvasWrapper);
      this.canvasWrapper.classList?.remove?.('is-floating');
    } else {
      if (this.canvasWrapper.parentNode !== this.container) this.container.appendChild(this.canvasWrapper);
      this.canvasWrapper.classList?.add?.('is-floating');
    }
    this.canvasWrapper.hidden = false;
    if (this._motionAllowed()) this.renderer?.start?.();
    else { this.renderer?.pause?.(); this.renderer?.renderStatic?.(); }
    this.renderer?.resize?.();
  }

  /** Idempotent enhancement: failures leave the conversation and voice controls intact. */
  ensure3D() {
    if (this._destroyed || this._config?.skipModelLoad) return Promise.resolve(false);
    if (this._threePromise) return this._threePromise;
    this.holoUI?.set3DState?.('loading');
    this._threePromise = (async () => {
      try {
        const load = this.options.loadVendors || (async () => {
          const [THREE, loader] = await Promise.all([import('../vendor/three.module.js'), import('../vendor/GLTFLoader.js')]);
          return { THREE, GLTFLoader: loader.GLTFLoader };
        });
        const {THREE, GLTFLoader} = await load();
        if (this._destroyed) return false;
        if (!this.renderer) throw new Error('3D renderer unavailable');
        this.renderer.options ||= {};
        this.renderer.THREE = this.renderer.options.THREE = THREE;
        this.renderer.options.GLTFLoader = GLTFLoader;
        this.renderer.options.embeddedStage = true;
        this.renderer.options.dockTransforms = { hero:{x:0,y:0,z:0,scale:.9}, dock:{x:0,y:0,z:0,scale:.9} };
        if (!this.aura && ZadaAura) { this.aura = new ZadaAura(THREE); this.renderer.aura = this.aura; }
        if (this.canvasWrapper) this.canvasWrapper.hidden = false;
        if (this.renderer.init(this.canvasWrapper || this.container) === false) throw new Error('3D renderer unavailable');
        const loaded = await this._loadCompanionModel();
        if (this._destroyed) return false;
        if (!loaded) throw new Error('3D model unavailable');
        this._threeReady = true;
        this.holoUI?.set3DState?.('ready');
        this.renderer.resize?.();
        this._sync3DVisibility();
        return true;
      } catch (error) {
        this.renderer?.pause?.();
        this.renderer?.dispose?.();
        if (!this._destroyed) {
          if (this.canvasWrapper) this.canvasWrapper.hidden = true;
          this.holoUI?.set3DState?.('unavailable');
        }
        return false;
      }
    })();
    return this._threePromise;
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
        <img src="assets/media/zada-portrait.webp" alt="Zada AI Specialist" class="zada-chat-avatar-img" />
        <span class="zada-chat-ai-badge" aria-hidden="true">AI</span>
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
      if (!this.renderer?.loadModel) return false;
      await this.renderer.loadModel('assets/zada.glb');
      return !this._destroyed;
    } catch { return false; }
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
    for (const call of toolCalls) {
      try {
        const result = await this.actionDispatcher?.dispatch?.(call);
        if (!result?.success) continue;
        if (!primaryTool) primaryTool = call;
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
      const headers = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
      const allMsgs = (this.holoUI?.messages || []).filter(m => m.role !== 'system' && m.text).map(m => ({ role: m.role, content: m.text }));
      const messages = [...allMsgs];
      while (messages.length > 0 && messages[0].role === 'zada') messages.shift();
      const fetchFn = this.options.fetchFn || globalThis.fetch;
      const res = await fetchFn(ZADA_API_BASE + '/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: messages.length > 0 ? messages : allMsgs, context: this._buildSiteContext() })
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: messages.length > 0 ? messages : allMsgs, context: this._buildSiteContext() })
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
      let notice = "I'm having trouble connecting right now. Please try again in a moment, or reach us directly at knowledgablellc@gmail.com.";
      if (err.message && (err.message.toLowerCase().includes('prepayment') || err.message.toLowerCase().includes('credits') || err.message.includes('402'))) {
        notice = "Google AI Studio notice: Your prepayment credits are depleted. Please visit https://ai.studio/projects to manage your project billing.";
      } else if (err.message && (err.message.toLowerCase().includes('high demand') || err.message.includes('503'))) {
        notice = "Google Gemini is currently experiencing a brief demand spike. Please ask again in a moment.";
      } else if (err.message && (err.message.toLowerCase().includes('key') || err.message.includes('401'))) {
        notice = "My AI connection isn't configured on this site right now. You can still reach the team at knowledgablellc@gmail.com.";
      } else if (err.message && !err.message.startsWith('HTTP')) {
        notice = `I'm having trouble connecting right now: ${err.message}. You can also reach us at knowledgablellc@gmail.com.`;
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
        if (!el) return {success:false,reason:'Section unavailable',sectionId:sid};
        this.holoUI?.close?.();
        el.scrollIntoView?.({ behavior: this._motionAllowed() ? 'smooth' : 'auto' });
        this.activeSection = sid;
        if (this.holoUI && SECTION_PROMPTS[sid]) this.holoUI.setContextPrompts(SECTION_PROMPTS[sid]);
        return { success: true, sectionId: sid };
      },
      openProjectPreview: async (p) => {
        const pid = p?.projectId;
        const portfolio = this.options.portfolio || (typeof window !== 'undefined' ? window.WebzadPortfolio : null);
        if (['zaddy','la-socieda','one-of-six','brg'].includes(pid)) {
          const success = Boolean(portfolio?.openProject?.(pid));
          return {success,projectId:pid,...(!success?{reason:'Project presentation unavailable'}:{})};
        }
        if (portfolio?.openStudy) return {success:Boolean(portfolio.openStudy(pid)),projectId:pid};
        let card = this.options.getProjectCard ? this.options.getProjectCard(pid) : null;
        if (!card && typeof document !== 'undefined') {
          const selector = {growth:'[data-study="growth"]',hospitality:'[data-study="hospitality"]',services:'[data-study="services"]'}[pid];
          if (selector) card = document.querySelector(selector);
        }
        if (!card?.click) return {success:false,projectId:pid,reason:'Design study unavailable'};
        card.click();
        return {success:true,projectId:pid};
      },
      prefillContactBrief: async (p) => {
        const form = (this.options.getContactForm ? this.options.getContactForm() : null) || (typeof document !== 'undefined' ? document.getElementById('contactForm') : null);
        if (!form) return {success:false,reason:'Contact form unavailable'};
        if (form) {
          this.holoUI?.close?.();
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
          (contactSec || form).scrollIntoView?.({ behavior: this._motionAllowed() ? 'smooth' : 'auto' });
          form.querySelector?.('textarea[name="goals"]')?.focus?.({preventScroll:true});
        }
        return { success: true, serviceType: p.serviceType };
      },
      dismissOverlay: async () => {
        const portfolio = this.options.portfolio || (typeof window !== 'undefined' ? window.WebzadPortfolio : null);
        if (portfolio?.closeTopOverlay?.()) return {success:true};
        if (this.holoUI?.isOpen) {this.holoUI.close();return {success:true};}
        if (typeof document === 'undefined') return {success:false,reason:'No open overlay'};
        const menu = document.getElementById('mobileMenu');
        if (menu && !menu.hidden) {document.dispatchEvent(new CustomEvent('webzad:close-menu'));return {success:true};}
        if (this.greetingBubble) {this.hideGreetingBubble();return {success:true};}
        return {success:false,reason:'No open overlay'};
      },
      toggleAudioOutput: async (p) => {
        const enabled = Boolean(p?.enabled);
        this.audioSync?.setMuted?.(!enabled);
        if (this.holoUI?.muteBtnEl) {
          this.holoUI.muteBtnEl.textContent = !enabled ? '🔇' : '🔊';
          this.holoUI.muteBtnEl.classList.toggle('muted', !enabled);
          this.holoUI.muteBtnEl.setAttribute?.('aria-pressed', String(!enabled));
          this.holoUI.muteBtnEl.setAttribute?.('aria-label',enabled?'Mute spoken replies':'Enable spoken replies');
        }
        return { success: true, enabled };
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
    this._destroyed = true;
    this._motionUnsubscribe?.();
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
