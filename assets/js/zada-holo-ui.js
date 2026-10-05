/**
 * ZadaHoloUI - Holographic Conversation HUD & Developer Configuration Modal.
 * Dark glassmorphism dialogue stream, voice mic input, prompt pills, telemetry & local key storage.
 */

/** @readonly */
const ZadaHoloTelemetryMap = Object.freeze({
  WELCOME: '● WELCOME', IDLE: '● READY', LISTENING: '● LISTENING', THINKING: '● PROCESSING', RESPONDING: '● SPEAKING',
  NAVIGATING: '● NAVIGATING', SUCCESS: '● SUCCESS', WARNING: '● WARNING', ERROR: '● ERROR', GOODBYE: '● GOODBYE'
});
const DEFAULT_PROMPT_CHIPS = Object.freeze(['Explain Autonomous Systems', 'Show Webzad Portfolio', 'Start Project Brief']);

/** Human-friendly labels for whitelisted tool actions shown in the UI. */
const TOOL_LABELS = Object.freeze({
  scrollToSection: 'Navigated to section',
  openProjectPreview: 'Opened project preview',
  prefillContactBrief: 'Filled project brief',
  toggleAudioOutput: 'Toggled voice output',
  dismissOverlay: 'Dismissed overlay'
});

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function sanitizeMarkdown(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|#)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g, '<br>');
}
function _createNode(create, tag, cls, text, parent, attrs = {}) {
  const e = create(tag);
  if (!e) return null;
  if (cls) e.className = cls; if (text) e.textContent = text;
  if (parent?.appendChild) parent.appendChild(e);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Holographic HUD UI Controller managing messages, prompts, telemetry, and dev modal. */
class ZadaHoloUI {
  constructor(options = {}) {
    this.options = options;
    this.stateManager = options.stateManager || null; this.actionDispatcher = options.actionDispatcher || null; this.audioSync = options.audioSync || null;
    this.onSendMessage = typeof options.onSendMessage === 'function' ? options.onSendMessage : null;
    this.onPromptSelect = typeof options.onPromptSelect === 'function' ? options.onPromptSelect : null;
    this.isOpen = this.isListening = false; this.messages = []; this.status = 'READY';
    this.promptChips = Array.isArray(options.promptChips) ? [...options.promptChips] : [...DEFAULT_PROMPT_CHIPS];
    this.container = this.hudEl = this.dialogueEl = this.inputEl = this.statusEl = this.statusDotEl = this.chipsContainerEl = this.micBtnEl = this.muteBtnEl = this.recognition = this._createElement = this.typingEl = null;
    this._boundKeyDown = (e) => this._handleKeyDown(e);
    this._stateUnsubscribe = this.stateManager?.subscribe?.((st) => this.updateStatus(st)) || null;
  }
  mount(containerEl, config = {}) {
    if (!containerEl) return false;
    this.container = containerEl;
    this._createElement = config.createElement || ((t) => (typeof document !== 'undefined' ? document.createElement(t) : null));
    this._buildHudMarkup(this._createElement); this._bindEventListeners();
    if (typeof containerEl.appendChild === 'function') containerEl.appendChild(this.hudEl);
    if (typeof window !== 'undefined') window.addEventListener('keydown', this._boundKeyDown);
    this.updateStatus(this.stateManager?.getState ? this.stateManager.getState() : 'IDLE');
    this._renderPromptChips(); return true;
  }
  unmount() {
    this.recognition?.abort?.();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this._boundKeyDown);
    this._stateUnsubscribe?.();
    if (this.hudEl?.parentNode === this.container) this.container.removeChild(this.hudEl);
    this.hudEl = this.container = null;
  }
  open() { this.isOpen = true; this.hudEl?.classList?.add('open'); if (this.dialogueEl) this.dialogueEl.scrollTop = this.dialogueEl.scrollHeight; this.options.onOpen?.(); }
  close() { this.isOpen = false; this.hudEl?.classList?.remove('open'); if (this.isListening) this.toggleSpeechRecognition(); this.options.onClose?.(); }
  toggle() { this.isOpen ? this.close() : this.open(); }
  addMessage(role, text, toolCall = null) {
    const validRole = role === 'user' || role === 'zada' ? role : 'system';
    const message = { role: validRole, text: String(text || ''), toolCall: toolCall || null, timestamp: Date.now() };
    this.messages.push(message); if (this.dialogueEl) this._renderMessageBubble(message);
    return message;
  }
  showTyping() {
    this.hideTyping();
    const c = this._createElement || ((t) => (typeof document !== 'undefined' ? document.createElement(t) : null));
    const el = _createNode(c, 'div', 'zada-msg zada-msg-zada zada-typing', null, this.dialogueEl);
    if (el) { el.innerHTML = '<span class="zada-typing-dot"></span><span class="zada-typing-dot"></span><span class="zada-typing-dot"></span>'; this.typingEl = el; }
    if (this.dialogueEl) this.dialogueEl.scrollTop = this.dialogueEl.scrollHeight;
  }
  hideTyping() {
    if (this.typingEl?.parentNode) this.typingEl.parentNode.removeChild(this.typingEl);
    this.typingEl = null;
  }
  /**
   * Opens a live-streaming zada message bubble; returns a controller to append text chunks.
   * @returns {{append: Function, finalize: Function, message: Object}}
   */
  startStreamMessage() {
    this.hideTyping();
    const message = this.addMessage('zada', '');
    const bubble = this.dialogueEl?.lastElementChild || null;
    if (bubble) bubble.classList.add('zada-streaming');
    return {
      message,
      append: (chunk) => {
        message.text += String(chunk || '');
        if (bubble) { bubble.innerHTML = sanitizeMarkdown(message.text); this.dialogueEl && (this.dialogueEl.scrollTop = this.dialogueEl.scrollHeight); }
      },
      finalize: (toolCall = null) => {
        if (bubble) { bubble.classList.remove('zada-streaming'); this._renderMessageBubbleContent(bubble, message, toolCall); }
      }
    };
  }
  updateStatus(state) {
    const label = ZadaHoloTelemetryMap[state] || ZadaHoloTelemetryMap.IDLE;
    this.status = label.replace(/^●\s*/, '');
    if (this.statusEl) this.statusEl.textContent = label;
    if (!this.statusDotEl?.classList) return;
    this.statusDotEl.classList.remove('listening', 'processing', 'speaking', 'error');
    const cls = { LISTENING: 'listening', THINKING: 'processing', RESPONDING: 'speaking', ERROR: 'error' }[state];
    if (cls) this.statusDotEl.classList.add(cls);
  }
  setContextPrompts(prompts) {
    this.promptChips = Array.isArray(prompts) ? [...prompts] : [...DEFAULT_PROMPT_CHIPS];
    if (this.chipsContainerEl) this._renderPromptChips();
  }
  toggleVoiceMute() {
    if (!this.audioSync) return;
    const nextMuted = !this.audioSync.isMuted(); this.audioSync.setMuted(nextMuted);
    if (this.muteBtnEl) { this.muteBtnEl.textContent = nextMuted ? '🔇' : '🔊'; this.muteBtnEl.classList.toggle('muted', nextMuted); }
  }
  toggleSpeechRecognition() {
    const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRec) return;
    if (this.isListening && this.recognition) {
      this.recognition.stop(); this.isListening = false; this.micBtnEl?.classList?.remove('active'); return;
    }
    try {
      this.recognition = new SpeechRec(); this.recognition.continuous = this.recognition.interimResults = false;
      this.recognition.onstart = () => { this.isListening = true; this.micBtnEl?.classList?.add('active'); this.stateManager?.setState?.('LISTENING'); };
      this.recognition.onresult = (e) => { const t = e.results?.[0]?.[0]?.transcript; if (t && this.inputEl) this.inputEl.value = t; };
      this.recognition.onend = () => { this.isListening = false; this.micBtnEl?.classList?.remove('active'); };
      this.recognition.start();
    } catch { this.isListening = false; }
  }
  _buildHudMarkup(c) {
    this.hudEl = _createNode(c, 'div', 'zada-hud');
    const hdr = _createNode(c, 'div', 'zada-hud-header', null, this.hudEl), pill = _createNode(c, 'div', 'zada-status-pill', null, hdr), act = _createNode(c, 'div', 'zada-hud-actions', null, hdr);
    this.statusDotEl = _createNode(c, 'span', 'zada-status-dot', null, pill);
    const nameplate = _createNode(c, 'span', 'zada-status-name', null, pill); nameplate.innerHTML = 'ZADA<span class="zada-status-sub">AI</span>';
    this.statusEl = _createNode(c, 'span', 'zada-status-text', '● READY', pill);
    this.muteBtnEl = _createNode(c, 'button', 'zada-btn-icon zada-btn-mute', '🔊', act, { 'aria-label': 'Toggle Voice' });
    _createNode(c, 'button', 'zada-btn-icon zada-btn-close', '✕', act, { 'aria-label': 'Close HUD' });
    this.dialogueEl = _createNode(c, 'div', 'zada-dialogue', null, this.hudEl); this.chipsContainerEl = _createNode(c, 'div', 'zada-chips', null, this.hudEl);
    const form = _createNode(c, 'form', 'zada-input-form', null, this.hudEl), wrap = _createNode(c, 'div', 'zada-input-wrapper', null, form);
    this.inputEl = _createNode(c, 'input', 'zada-input-field', null, wrap, { type: 'text', placeholder: 'Ask Zada anything...', 'aria-label': 'Chat input' });
    this.micBtnEl = _createNode(c, 'button', 'zada-mic-btn', '🎤', wrap, { type: 'button', 'aria-label': 'Voice Input' }); _createNode(c, 'button', 'zada-send-btn', '➤', wrap, { type: 'submit', 'aria-label': 'Send message' });
  }
  _bindEventListeners() {
    this.hudEl?.querySelector('.zada-btn-close')?.addEventListener('click', () => this.close());
    this.muteBtnEl?.addEventListener('click', () => this.toggleVoiceMute()); this.micBtnEl?.addEventListener('click', () => this.toggleSpeechRecognition());
    this.hudEl?.querySelector('form')?.addEventListener('submit', (e) => {
      e?.preventDefault?.(); const txt = this.inputEl?.value?.trim();
      if (txt) { this.addMessage('user', txt); if (this.inputEl) this.inputEl.value = ''; this.onSendMessage?.(txt); }
    });
  }
  _renderPromptChips() {
    if (!this.chipsContainerEl) return;
    this.chipsContainerEl.innerHTML = '';
    const c = this._createElement || ((t) => (typeof document !== 'undefined' ? document.createElement(t) : null));
    this.promptChips.forEach((txt) => {
      const chip = _createNode(c, 'button', 'zada-chip', txt, this.chipsContainerEl, { type: 'button' });
      chip?.addEventListener('click', () => (this.onPromptSelect ? this.onPromptSelect(txt) : (this.addMessage('user', txt), this.onSendMessage?.(txt))));
    });
  }
  _renderMessageBubble(msg) {
    const c = this._createElement || ((t) => (typeof document !== 'undefined' ? document.createElement(t) : null));
    const bubble = _createNode(c, 'div', `zada-msg zada-msg-${msg.role}`, null, this.dialogueEl);
    if (!bubble) return;
    this._renderMessageBubbleContent(bubble, msg, msg.toolCall);
    if (this.dialogueEl) this.dialogueEl.scrollTop = this.dialogueEl.scrollHeight;
  }
  _renderMessageBubbleContent(bubble, msg, toolCall = null) {
    if (!bubble) return;
    let html = sanitizeMarkdown(msg.text);
    const call = toolCall || msg.toolCall;
    if (call?.name) {
      msg.toolCall = call;
      const label = TOOL_LABELS[call.name] || call.name;
      html += `<div class="zada-tool-badge">⚡ ${escapeHtml(label)}</div>`;
    }
    bubble.innerHTML = html;
    if (this.dialogueEl) this.dialogueEl.scrollTop = this.dialogueEl.scrollHeight;
  }
  _handleKeyDown(e) { if (e?.key === 'Escape' && this.isOpen) this.close(); }
}
const _exports = { ZadaHoloUI, ZadaHoloTelemetryMap, DEFAULT_PROMPT_CHIPS, sanitizeMarkdown, escapeHtml };
if (typeof module !== 'undefined' && module.exports) module.exports = _exports;
if (typeof window !== 'undefined') Object.assign(window, _exports);
if (typeof globalThis !== 'undefined') Object.assign(globalThis, _exports);