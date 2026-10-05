const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ZadaHoloUI,
  ZadaHoloTelemetryMap,
  sanitizeMarkdown
} = require('../assets/js/zada-holo-ui.js');

/**
 * Creates a lightweight mock DOM element for testing headless mounting.
 */
function createMockElement(tagName = 'div', parent = null) {
  const listeners = new Map();
  const classes = new Set();
  const children = [];
  const attributes = new Map();
  let _textContent = '';
  let _innerHTML = '';

  const element = {
    tagName: tagName.toUpperCase(),
    parentNode: parent,
    children,
    style: {},
    value: '',
    get textContent() {
      if (_textContent) return _textContent;
      return children.map(c => c.textContent).join(' ');
    },
    set textContent(val) {
      _textContent = String(val);
    },
    get innerHTML() {
      if (_innerHTML) return _innerHTML;
      return children.map(c => `<${c.tagName.toLowerCase()} class="${c.className}">${c.innerHTML || c.textContent}</${c.tagName.toLowerCase()}>`).join('');
    },
    set innerHTML(val) {
      _innerHTML = String(val);
    },
    get className() {
      return Array.from(classes).join(' ');
    },
    set className(val) {
      classes.clear();
      String(val || '').split(/\s+/).filter(Boolean).forEach(n => classes.add(n));
    },
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const has = classes.has(name);
        const shouldAdd = typeof force === 'boolean' ? force : !has;
        if (shouldAdd) classes.add(name); else classes.delete(name);
        return shouldAdd;
      }
    },
    setAttribute: (name, val) => attributes.set(name, String(val)),
    getAttribute: (name) => attributes.get(name) || null,
    hasAttribute: (name) => attributes.has(name),
    removeAttribute: (name) => attributes.delete(name),
    appendChild: (child) => {
      if (child) {
        child.parentNode = element;
        children.push(child);
      }
      return child;
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    },
    querySelector: (selector) => {
      const match = (el) => {
        if (!el) return null;
        if (selector.startsWith('.') && el.classList.contains(selector.slice(1))) return el;
        if (selector.startsWith('#') && el.getAttribute('id') === selector.slice(1)) return el;
        if (el.tagName && el.tagName.toLowerCase() === selector.toLowerCase()) return el;
        if (selector.includes('[') && selector.includes(']')) {
          const attr = selector.replace(/[\[\]]/g, '');
          if (el.hasAttribute(attr)) return el;
        }
        for (const child of el.children) {
          const found = match(child);
          if (found) return found;
        }
        return null;
      };
      return match(element);
    },
    querySelectorAll: (selector) => {
      const results = [];
      const collect = (el) => {
        if (!el) return;
        if (selector.startsWith('.') && el.classList.contains(selector.slice(1))) results.push(el);
        for (const child of el.children) collect(child);
      };
      collect(element);
      return results;
    },
    addEventListener: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
      if (!listeners.has(event)) return;
      const list = listeners.get(event).filter(h => h !== handler);
      listeners.set(event, list);
    },
    dispatchEvent: (eventObj) => {
      const handlers = listeners.get(eventObj.type) || [];
      handlers.forEach(h => h(eventObj));
      return true;
    },
    focus: () => {},
    blur: () => {},
    scrollTo: () => {}
  };

  return element;
}

test('ZadaHoloUI interface and message management', async (t) => {
  await t.test('ZadaHoloUI instantiates with default state', () => {
    const ui = new ZadaHoloUI();
    assert.equal(ui.isOpen, false);
    assert.equal(Array.isArray(ui.messages), true);
    assert.equal(ui.messages.length, 0);
    assert.equal(ui.status, 'READY');
  });

  await t.test('addMessage stores history and renders cleanly', () => {
    const ui = new ZadaHoloUI();
    ui.addMessage('user', 'Hello Zada');
    ui.addMessage('zada', 'Hello! How can I assist you with Webzad?');
    assert.equal(ui.messages.length, 2);
    assert.equal(ui.messages[0].role, 'user');
    assert.equal(ui.messages[0].text, 'Hello Zada');
    assert.equal(ui.messages[1].role, 'zada');
    assert.equal(ui.messages[1].text, 'Hello! How can I assist you with Webzad?');
    assert.ok(typeof ui.messages[0].timestamp === 'number');
  });

  await t.test('addMessage supports toolCall payload attachment', () => {
    const ui = new ZadaHoloUI();
    const toolCall = { name: 'scrollToSection', params: { sectionId: 'services' } };
    ui.addMessage('zada', 'Navigating to services section.', toolCall);
    assert.equal(ui.messages.length, 1);
    assert.deepEqual(ui.messages[0].toolCall, toolCall);
  });

  await t.test('addMessage handles null, undefined, or missing text safely', () => {
    const ui = new ZadaHoloUI();
    ui.addMessage('user', null);
    ui.addMessage(undefined, undefined);
    assert.equal(ui.messages.length, 2);
    assert.equal(ui.messages[0].text, '');
    assert.equal(ui.messages[1].role, 'system');
  });

  await t.test('open and close updates visibility state', () => {
    const ui = new ZadaHoloUI();
    ui.open();
    assert.equal(ui.isOpen, true);
    ui.close();
    assert.equal(ui.isOpen, false);
  });

  await t.test('toggle switches visibility state back and forth', () => {
    const ui = new ZadaHoloUI();
    assert.equal(ui.isOpen, false);
    ui.toggle();
    assert.equal(ui.isOpen, true);
    ui.toggle();
    assert.equal(ui.isOpen, false);
  });
});

test('ZadaHoloUI telemetry and state machine integration', async (t) => {
  await t.test('ZadaHoloTelemetryMap maps companion states accurately', () => {
    assert.equal(ZadaHoloTelemetryMap.IDLE, '● READY');
    assert.equal(ZadaHoloTelemetryMap.LISTENING, '● LISTENING');
    assert.equal(ZadaHoloTelemetryMap.THINKING, '● PROCESSING');
    assert.equal(ZadaHoloTelemetryMap.RESPONDING, '● SPEAKING');
    assert.equal(ZadaHoloTelemetryMap.NAVIGATING, '● NAVIGATING');
    assert.equal(ZadaHoloTelemetryMap.ERROR, '● ERROR');
  });

  await t.test('updateStatus updates instance status property and telemetry', () => {
    const ui = new ZadaHoloUI();
    ui.updateStatus('THINKING');
    assert.equal(ui.status, 'PROCESSING');
    ui.updateStatus('LISTENING');
    assert.equal(ui.status, 'LISTENING');
    ui.updateStatus('IDLE');
    assert.equal(ui.status, 'READY');
  });

  await t.test('subscribes to stateManager if passed in constructor', () => {
    let subscriberCb = null;
    const mockStateManager = {
      subscribe: (fn) => { subscriberCb = fn; return () => {}; },
      getState: () => 'IDLE'
    };
    const ui = new ZadaHoloUI({ stateManager: mockStateManager });
    assert.equal(ui.status, 'READY');

    // Simulate state transition
    subscriberCb('RESPONDING', 'THINKING');
    assert.equal(ui.status, 'SPEAKING');
  });
});

test('ZadaHoloUI prompt chips and markdown rendering', async (t) => {
  await t.test('default prompt chips contain core suggestions', () => {
    const ui = new ZadaHoloUI();
    assert.ok(ui.promptChips.includes('Explain Autonomous Systems'));
    assert.ok(ui.promptChips.includes('Show Webzad Portfolio'));
    assert.ok(ui.promptChips.includes('Start Project Brief'));
  });

  await t.test('setContextPrompts updates chips dynamically', () => {
    const ui = new ZadaHoloUI();
    ui.setContextPrompts(['Custom Prompt 1', 'Custom Prompt 2']);
    assert.deepEqual(ui.promptChips, ['Custom Prompt 1', 'Custom Prompt 2']);
  });

  await t.test('sanitizeMarkdown formats bold, italic, code, and escapes script injection', () => {
    const raw = '**Bold** and *Italic* and `code` <script>alert(1)</script>';
    const formatted = sanitizeMarkdown(raw);
    assert.ok(formatted.includes('<strong>Bold</strong>'));
    assert.ok(formatted.includes('<em>Italic</em>'));
    assert.ok(formatted.includes('<code>code</code>'));
    assert.ok(!formatted.includes('<script>'));
    assert.ok(formatted.includes('&lt;script&gt;'));
  });
});

test('ZadaHoloUI DOM mounting and interactions', async (t) => {
  const container = createMockElement('div');
  let sentMessage = null;
  let selectedPrompt = null;

  const ui = new ZadaHoloUI({
    onSendMessage: (msg) => { sentMessage = msg; },
    onPromptSelect: (p) => { selectedPrompt = p; }
  });

  await t.test('mount renders HUD structure', () => {
    const mounted = ui.mount(container, { createElement: createMockElement });
    assert.equal(mounted, true);
    assert.ok(ui.hudEl);
    assert.equal(container.children.length, 1);
  });

  await t.test('open and close updates HUD DOM classList', () => {
    ui.open();
    assert.equal(ui.hudEl.classList.contains('open'), true);
    ui.close();
    assert.equal(ui.hudEl.classList.contains('open'), false);
  });

  await t.test('addMessage appends message bubble to dialogue element', () => {
    ui.addMessage('user', 'Hello there');
    ui.addMessage('zada', 'Greetings!', { name: 'openProjectPreview', params: { projectId: 'growth' } });
    assert.equal(ui.dialogueEl.children.length, 2);
  });

  await t.test('audioSync mute button reflects and toggles state', () => {
    let muted = false;
    const mockAudioSync = {
      isMuted: () => muted,
      setMuted: (val) => { muted = val; }
    };
    ui.audioSync = mockAudioSync;
    ui.toggleVoiceMute();
    assert.equal(muted, true);
    assert.equal(ui.muteBtnEl.textContent, '🔇');
    ui.toggleVoiceMute();
    assert.equal(muted, false);
    assert.equal(ui.muteBtnEl.textContent, '🔊');
  });

  await t.test('unmount removes elements from container', () => {
    ui.unmount();
    assert.equal(container.children.length, 0);
  });
});

test('ZadaHoloUI universal export', async (t) => {
  await t.test('exports to module.exports, window, and globalThis', () => {
    assert.equal(typeof ZadaHoloUI, 'function');
    if (typeof globalThis !== 'undefined') {
      assert.equal(globalThis.ZadaHoloUI, ZadaHoloUI);
    }
  });
});