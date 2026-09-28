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
const DEV_WARNING_TEXT = '⚠ LOCAL DEVELOPMENT ONLY — NOT SECURE FOR PRODUCTION. Production credentials must remain server-side.';
const DEV_INPUT_LABEL = '[ ENTER GEMINI API KEY HERE ]';
const STORAGE_KEY = 'webzad_dev_gemini_key';

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
    this.storage = options.storage !== undefined ? options.storage : (typeof localStorage !== 'undefined' ? localStorage : null);
    this.onSendMessage = typeof options.onSendMessage === 'function' ? options.onSendMessage : null;
    this.onPromptSelect = typeof options.onPromptSelect === 'function' ? options.onPromptSelect : null;
    this.onVerifyKey = typeof options.onVerifyKey === 'function' ? options.onVerifyKey : null;
    this.isOpen = this.isDevModalOpen = this.isListening = false; this.messages = []; this.status = 'READY';
    this.promptChips = Array.isArray(options.promptChips) ? [...options.promptChips] : [...DEFAULT_PROMPT_CHIPS];
    this.container = this.hudEl = this.dialogueEl = this.inputEl = this.statusEl = this.statusDotEl = this.chipsContainerEl = this.micBtnEl = this.muteBtnEl = this.devModalEl = this.devKeyInputEl = this.devStatusEl = this.recognition = this._createElement = null;
    this._boundKeyDown = (e) => this._handleKeyDown(e);
    this._stateUnsubscribe = this.stateManager?.subscribe?.((st) => this.updateStatus(st)) || null;
  }
  mount(containerEl, config = {}) {
    if (!containerEl) return false;
    this.container = containerEl;
    this._createElement = config.createElement || ((t) => (typeof document !== 'undefined' ? document.createElement(t) : null));
    this._buildHudMarkup(this._createElement); this._buildDevModalMarkup(this._createElement); this._bindEventListeners();
    if (typeof containerEl.appendChild === 'function') { containerEl.appendChild(this.hudEl); containerEl.appendChild(this.devModalEl); }
    if (typeof window !== 'undefined') window.addEventListener('keydown', this._boundKeyDown);
    this.updateStatus(this.stateManager?.getState ? this.stateManager.getState() : 'IDLE');
    this._renderPromptChips(); return true;
  }
  unmount() {
    this.recognition?.abort?.();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this._boundKeyDown);
    this._stateUnsubscribe?.();
    [this.hudEl, this.devModalEl].forEach((el) => { if (el?.parentNode === this.container) this.container.removeChild(el); });
    this.hudEl = this.devModalEl = this.container = null;
  }
  open() { this.isOpen = true; this.hudEl?.classList?.add('open'); if (this.dialogueEl) this.dialogueEl.scrollTop = this.dialogueEl.scrollHeight; this.options.onOpen?.(); }
  close() { this.isOpen = false; this.hudEl?.classList?.remove('open'); if (this.isListening) this.toggleSpeechRecognition(); this.options.onClose?.(); }
  toggle() { this.isOpen ? this.close() : this.open(); }
  addMessage(role, text, toolCall = null) {
    const validRole = role === 'user' || role === 'zada' ? role : 'system';
    const message = { role: validRole, text: String(text || ''), toolCall: toolCall || null, timestamp: Date.now() };
    this.messages.push(message); if (this.dialogueEl) this._renderMessageBubble(message);
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
  openDevSettings() {
    this.isDevModalOpen = true; this.devModalEl?.classList?.add('open');
    if (this.devKeyInputEl) { this.devKeyInputEl.value = this.getDevKey(); this.devKeyInputEl.focus?.(); }
    if (this.getDevKey()) this._setDevStatus('API key active from localStorage.', 'info');
  }
  closeDevSettings() {
    const v = this.devKeyInputEl?.value?.trim();
    if (v) this.setDevKey(v);
    this.isDevModalOpen = false; this.devModalEl?.classList?.remove('open');
  }
  toggleDevSettings() { this.isDevModalOpen ? this.closeDevSettings() : this.openDevSettings(); }
  getDevKey() { try { return (this.storage && this.storage.getItem(STORAGE_KEY)) || ''; } catch { return ''; } }
  setDevKey(key) { try { if (this.storage) this.storage.setItem(STORAGE_KEY, String(key || '').trim()); } catch {} }
  clearDevKey() {
    try { if (this.storage) this.storage.removeItem(STORAGE_KEY); } catch {}
    if (this.devKeyInputEl) this.devKeyInputEl.value = ''; this._setDevStatus('Developer key cleared from localStorage.', 'info');
  }
  async testDevKey(key) {
    const k = String(key || this.devKeyInputEl?.value || this.getDevKey()).trim();
    if (!k) { this._setDevStatus('Please enter an API key first.', 'error'); return false; }
    this.setDevKey(k);
    this._setDevStatus('Verifying API key...', 'info');
    if (typeof this.onVerifyKey === 'function') {
      try {
        const ok = await this.onVerifyKey(k);
        this._setDevStatus(ok ? 'Key verified successfully.' : 'Key verification failed.', ok ? 'success' : 'error'); return ok;
      } catch (err) { this._setDevStatus(`Verification error: ${err.message}`, 'error'); return false; }
    }
    try {
      const res = await fetch('/api/verify-key', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': k }, body: JSON.stringify({ key: k }) });
      const data = await res.json(), ok = Boolean(data && data.valid);
      this._setDevStatus(ok ? 'Key verified with Gemini proxy.' : 'Invalid Gemini API key.', ok ? 'success' : 'error'); return ok;
    } catch { this._setDevStatus('Failed to connect to verification server.', 'error'); return false; }
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
    this.statusDotEl = _createNode(c, 'span', 'zada-status-dot', null, pill); this.statusEl = _createNode(c, 'span', null, '● READY', pill);
    this.muteBtnEl = _createNode(c, 'button', 'zada-btn-icon zada-btn-mute', '🔊', act, { 'aria-label': 'Toggle Voice' });
    _createNode(c, 'button', 'zada-btn-icon zada-btn-dev-trigger', '⚙', act, { 'aria-label': 'Developer Settings' }); _createNode(c, 'button', 'zada-btn-icon zada-btn-close', '✕', act, { 'aria-label': 'Close HUD' });
    this.dialogueEl = _createNode(c, 'div', 'zada-dialogue', null, this.hudEl); this.chipsContainerEl = _createNode(c, 'div', 'zada-chips', null, this.hudEl);
    const form = _createNode(c, 'form', 'zada-input-form', null, this.hudEl), wrap = _createNode(c, 'div', 'zada-input-wrapper', null, form);
    this.inputEl = _createNode(c, 'input', 'zada-input-field', null, wrap, { type: 'text', placeholder: 'Ask Zada anything...', 'aria-label': 'Chat input' });
    this.micBtnEl = _createNode(c, 'button', 'zada-mic-btn', '🎤', wrap, { type: 'button', 'aria-label': 'Voice Input' }); _createNode(c, 'button', 'zada-send-btn', '➤', wrap, { type: 'submit', 'aria-label': 'Send message' });
  }
  _buildDevModalMarkup(c) {
    this.devModalEl = _createNode(c, 'div', 'zada-dev-modal');
    const card = _createNode(c, 'div', 'zada-dev-card', null, this.devModalEl), hdr = _createNode(c, 'div', 'zada-dev-header', null, card);
    _createNode(c, 'h3', 'zada-dev-title', 'Developer Settings', hdr); _createNode(c, 'button', 'zada-btn-icon zada-dev-modal-close', '✕', hdr);
    _createNode(c, 'div', 'zada-dev-warning', DEV_WARNING_TEXT, card); _createNode(c, 'label', 'zada-dev-label', DEV_INPUT_LABEL, card);
    this.devKeyInputEl = _createNode(c, 'input', 'zada-dev-input', null, card, { type: 'password', placeholder: 'AIzaSy...' });
    const act = _createNode(c, 'div', 'zada-dev-actions', null, card);
    [['Save Key', 'save'], ['Test Key', 'test'], ['Clear Key', 'clear']].forEach(([l, a]) => _createNode(c, 'button', `zada-btn-dev zada-btn-dev-${a}`, l, act));
    this.devStatusEl = _createNode(c, 'div', 'zada-dev-status', null, card);
  }
  _bindEventListeners() {
    this.hudEl?.querySelector('.zada-btn-close')?.addEventListener('click', () => this.close());
    this.hudEl?.querySelector('.zada-btn-dev-trigger')?.addEventListener('click', () => this.openDevSettings());
    this.muteBtnEl?.addEventListener('click', () => this.toggleVoiceMute()); this.micBtnEl?.addEventListener('click', () => this.toggleSpeechRecognition());
    this.hudEl?.querySelector('form')?.addEventListener('submit', (e) => {
      e?.preventDefault?.(); const txt = this.inputEl?.value?.trim();
      if (txt) { this.addMessage('user', txt); if (this.inputEl) this.inputEl.value = ''; this.onSendMessage?.(txt); }
    });
    this.devModalEl?.querySelector('.zada-dev-modal-close')?.addEventListener('click', () => this.closeDevSettings());
    const onKeyInput = () => {
      const val = this.devKeyInputEl?.value?.trim() || '';
      if (val) this.setDevKey(val);
    };
    this.devKeyInputEl?.addEventListener('input', onKeyInput);
    this.devKeyInputEl?.addEventListener('change', onKeyInput);
    this.devKeyInputEl?.addEventListener('paste', () => setTimeout(onKeyInput, 50));
    this.devModalEl?.querySelector('.zada-btn-dev-save')?.addEventListener('click', () => {
      const v = this.devKeyInputEl?.value?.trim() || ''; this.setDevKey(v); this._setDevStatus(v ? 'Key saved to localStorage.' : 'Empty key saved.', 'success');
    });
    this.devModalEl?.querySelector('.zada-btn-dev-test')?.addEventListener('click', () => this.testDevKey(this.devKeyInputEl?.value)); this.devModalEl?.querySelector('.zada-btn-dev-clear')?.addEventListener('click', () => this.clearDevKey());
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
    let html = sanitizeMarkdown(msg.text);
    if (msg.toolCall?.name) {
      const p = msg.toolCall.params ? Object.values(msg.toolCall.params)[0] || '' : '';
      html += `<div class="zada-tool-badge">⚡ Action: ${escapeHtml(msg.toolCall.name)}(${escapeHtml(p)})</div>`;
    }
    bubble.innerHTML = html;
    if (this.dialogueEl) this.dialogueEl.scrollTop = this.dialogueEl.scrollHeight;
  }
  _setDevStatus(msg, type = 'info') {
    if (!this.devStatusEl) return;
    this.devStatusEl.textContent = msg;
    if (this.devStatusEl.className !== undefined) this.devStatusEl.className = `zada-dev-status ${type}`;
  }
  _handleKeyDown(e) { if (e?.key === 'Escape') { if (this.isDevModalOpen) this.closeDevSettings(); else if (this.isOpen) this.close(); } }
}
const _exports = { ZadaHoloUI, ZadaHoloTelemetryMap, DEFAULT_PROMPT_CHIPS, DEV_WARNING_TEXT, DEV_INPUT_LABEL, STORAGE_KEY, sanitizeMarkdown, escapeHtml };
if (typeof module !== 'undefined' && module.exports) module.exports = _exports;
if (typeof window !== 'undefined') Object.assign(window, _exports);
if (typeof globalThis !== 'undefined') Object.assign(globalThis, _exports);