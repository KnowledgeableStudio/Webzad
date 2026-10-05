const test = require('node:test');
const assert = require('node:assert/strict');
const { ZadaCompanion, SECTION_PROMPTS } = require('../assets/js/zada.js');
const { ZadaStateManager } = require('../assets/js/zada-state.js');
const { ZadaAudioSync } = require('../assets/js/zada-audio.js');

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
    clientWidth: 800,
    clientHeight: 600,
    dataset: {},
    get textContent() {
      if (_textContent) return _textContent;
      return children.map(c => c.textContent).join(' ');
    },
    set textContent(val) { _textContent = String(val); },
    get innerHTML() { return _innerHTML; },
    set innerHTML(val) { _innerHTML = String(val); },
    classList: {
      add: (cls) => classes.add(cls),
      remove: (cls) => classes.delete(cls),
      contains: (cls) => classes.has(cls),
      toggle: (cls, force) => {
        if (force === undefined) {
          if (classes.has(cls)) classes.delete(cls); else classes.add(cls);
        } else if (force) classes.add(cls); else classes.delete(cls);
      }
    },
    setAttribute: (k, v) => attributes.set(k, String(v)),
    getAttribute: (k) => attributes.get(k) || null,
    hasAttribute: (k) => attributes.has(k),
    appendChild: (child) => {
      child.parentNode = element;
      children.push(child);
      return child;
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentNode = null;
      return child;
    },
    querySelector: (sel) => {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        const search = (node) => {
          if (node.classList?.contains?.(cls)) return node;
          for (const ch of node.children) {
            const found = search(ch);
            if (found) return found;
          }
          return null;
        };
        return search(element);
      }
      return children[0] || null;
    },
    querySelectorAll: (sel) => {
      const out = [];
      const search = (node) => {
        if (sel.startsWith('.') && node.classList?.contains?.(sel.slice(1))) out.push(node);
        node.children.forEach(search);
      };
      search(element);
      return out;
    },
    addEventListener: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
      if (listeners.has(event)) {
        listeners.set(event, listeners.get(event).filter(h => h !== handler));
      }
    },
    dispatchEvent: (event) => {
      const handlers = listeners.get(event?.type || event) || [];
      handlers.forEach(h => h(event));
      return true;
    },
    click: () => {
      const handlers = listeners.get('click') || [];
      handlers.forEach(h => h({ type: 'click', target: element }));
    },
    scrollIntoView: (opt) => {
      element._scrolledIntoView = opt || true;
    }
  };

  return element;
}

test('ZadaCompanion Master Orchestrator', async (t) => {
  await t.test('instantiates with modular defaults and authoritative state', () => {
    const companion = new ZadaCompanion();
    assert.ok(companion.stateManager instanceof ZadaStateManager);
    assert.equal(companion.stateManager.getState(), 'IDLE');
    assert.equal(companion.dockMode, 'hero');
    assert.equal(companion.isInitialized, false);
  });

  await t.test('initializes cleanly in container with mock subsystems', async () => {
    const container = createMockElement('div');
    const companion = new ZadaCompanion({
      fetchFn: async () => ({ ok: true, json: async () => ({ text: 'Mock response', toolCalls: [] }) })
    });

    const initResult = await companion.init(container, {
      skipModelLoad: true,
      createElement: (t) => createMockElement(t)
    });

    assert.equal(initResult, true);
    assert.equal(companion.isInitialized, true);
    assert.ok(container.children.length > 0);
  });

  await t.test('updates dock mode on scroll threshold', () => {
    const companion = new ZadaCompanion();
    companion.handleScroll(50);
    assert.equal(companion.dockMode, 'hero');

    companion.handleScroll(250);
    assert.equal(companion.dockMode, 'dock');

    companion.handleScroll(80);
    assert.equal(companion.dockMode, 'hero');
  });

  await t.test('calculates normalized cursor coordinates within bounds', () => {
    const companion = new ZadaCompanion();
    companion.handleMouseMove(500, 300, 1000, 600);
    assert.equal(companion.cursor.x, 0);
    assert.equal(companion.cursor.y, 0);

    companion.handleMouseMove(1000, 600, 1000, 600);
    assert.equal(companion.cursor.x, 1);
    assert.equal(companion.cursor.y, 1);
  });

  await t.test('wires scrollToSection action to element scroll and chip update', async () => {
    const sections = {
      work: createMockElement('section')
    };
    const companion = new ZadaCompanion({
      getElement: (id) => sections[id] || null
    });
    companion.init(createMockElement('div'), { skipModelLoad: true, createElement: createMockElement });

    const res = await companion.actionDispatcher.dispatch({
      name: 'scrollToSection',
      params: { sectionId: 'work' }
    });

    assert.equal(res.success, true);
    assert.ok(sections.work._scrolledIntoView);
    assert.deepEqual(companion.holoUI.promptChips, SECTION_PROMPTS.work);
  });

  await t.test('wires scrollToSection for hero falling back to #top element', async () => {
    const topEl = createMockElement('section');
    const companion = new ZadaCompanion({
      getElement: (id) => (id === 'hero' ? topEl : null)
    });
    companion.init(createMockElement('div'), { skipModelLoad: true, createElement: createMockElement });

    const res = await companion.actionDispatcher.dispatch({
      name: 'scrollToSection',
      params: { sectionId: 'hero' }
    });

    assert.equal(res.success, true);
    assert.ok(topEl._scrolledIntoView);
  });

  await t.test('wires openProjectPreview action to matching project media click', async () => {
    let clickedProject = null;
    const cards = [
      { id: 'growth', el: createMockElement('div') },
      { id: 'hospitality', el: createMockElement('div') },
      { id: 'services', el: createMockElement('div') }
    ];
    cards.forEach(c => c.el.addEventListener('click', () => { clickedProject = c.id; }));

    const companion = new ZadaCompanion({
      getProjectCard: (id) => cards.find(c => c.id === id)?.el || null
    });
    companion.init(createMockElement('div'), { skipModelLoad: true, createElement: createMockElement });

    const res = await companion.actionDispatcher.dispatch({
      name: 'openProjectPreview',
      params: { projectId: 'growth' }
    });

    assert.equal(res.success, true);
    assert.equal(clickedProject, 'growth');
  });

  await t.test('wires prefillContactBrief action and NEVER submits form', async () => {
    const serviceSelect = createMockElement('select');
    const goalsTextarea = createMockElement('textarea');
    let formSubmitted = false;

    const mockForm = {
      querySelector: (sel) => {
        if (sel === 'select[name="service"]') return serviceSelect;
        if (sel === 'textarea[name="goals"]') return goalsTextarea;
        return null;
      },
      submit: () => { formSubmitted = true; },
      _scrolledIntoView: false,
      scrollIntoView: function(opt) { this._scrolledIntoView = opt || true; }
    };

    const companion = new ZadaCompanion({
      getContactForm: () => mockForm
    });
    companion.init(createMockElement('div'), { skipModelLoad: true, createElement: createMockElement });

    const res = await companion.actionDispatcher.dispatch({
      name: 'prefillContactBrief',
      params: { serviceType: 'signature-website', details: 'Need an authority site' }
    });

    assert.equal(res.success, true);
    assert.equal(serviceSelect.value, 'Signature Website');
    assert.equal(goalsTextarea.value, 'Need an authority site');
    assert.equal(formSubmitted, false, 'Form must NEVER be automatically submitted');
    assert.ok(mockForm._scrolledIntoView);
  });

  await t.test('wires toggleAudioOutput action and synchronizes mute button', async () => {
    const audioSync = new ZadaAudioSync();
    assert.equal(audioSync.isMuted(), false);

    const companion = new ZadaCompanion({ audioSync });
    companion.init(createMockElement('div'), { skipModelLoad: true, createElement: createMockElement });

    const res = await companion.actionDispatcher.dispatch({
      name: 'toggleAudioOutput',
      params: { enabled: false }
    });

    assert.equal(res.success, true);
    assert.equal(audioSync.isMuted(), true);
    assert.equal(companion.holoUI.muteBtnEl.textContent, '🔇');
    assert.ok(companion.holoUI.muteBtnEl.classList.contains('muted'));

    await companion.actionDispatcher.dispatch({
      name: 'toggleAudioOutput',
      params: { enabled: true }
    });
    assert.equal(audioSync.isMuted(), false);
    assert.equal(companion.holoUI.muteBtnEl.textContent, '🔊');
  });

  await t.test('executes handleUserMessage with API communication, tool dispatch, and speech', async () => {
    let speechText = '';
    const mockAudio = {
      isMuted: () => false,
      interrupt: () => {},
      speak: (txt, onEnd) => { speechText = txt; if (onEnd) onEnd(); },
      getAmplitude: () => 0
    };

    let dispatchedAction = null;
    let sentBody = null;
    const companion = new ZadaCompanion({
      audioSync: mockAudio,
      fetchFn: async (url, opts) => {
        sentBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            text: 'I will navigate to services for you.',
            toolCalls: [{ name: 'scrollToSection', params: { sectionId: 'services' } }]
          })
        };
      }
    });

    const container = createMockElement('div');
    companion.init(container, { skipModelLoad: true, createElement: createMockElement });

    // Spy on action dispatcher
    const origDispatch = companion.actionDispatcher.dispatch.bind(companion.actionDispatcher);
    companion.actionDispatcher.dispatch = async (call) => {
      dispatchedAction = call;
      return origDispatch(call);
    };

    await companion.handleUserMessage('Take me to services');

    assert.ok(sentBody.messages.some(m => m.content === 'Take me to services'), 'Request body must include user message');
    assert.equal(dispatchedAction?.name, 'scrollToSection');
    assert.equal(speechText, 'I will navigate to services for you.');
    assert.equal(companion.stateManager.getState(), 'IDLE');
  });

  await t.test('prompt chip click records user message in HUD and forwards to API', async () => {
    let sentBody = null;
    const companion = new ZadaCompanion({
      fetchFn: async (url, opts) => {
        sentBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ text: 'Webzad builds websites.', toolCalls: [] })
        };
      }
    });

    const container = createMockElement('div');
    companion.init(container, { skipModelLoad: true, createElement: createMockElement });

    // Find the first prompt chip and click it
    const chip = companion.holoUI.chipsContainerEl.children[0];
    assert.ok(chip, 'Prompt chip must exist');
    chip.click();

    // Allow promise tick
    await new Promise(r => setTimeout(r, 10));

    assert.ok(sentBody.messages.some(m => m.content === 'What is Webzad?'));
    const userMsg = companion.holoUI.messages.find(m => m.role === 'user' && m.text === 'What is Webzad?');
    assert.ok(userMsg, 'User prompt must appear in HUD dialogue stream');
  });

  await t.test('handles network failure gracefully without crashing', async () => {
    const companion = new ZadaCompanion({
      fetchFn: async () => { throw new Error('Network failure'); }
    });
    companion.init(createMockElement('div'), { skipModelLoad: true, createElement: createMockElement });

    await companion.handleUserMessage('Hello');
    assert.equal(companion.stateManager.getState(), 'ERROR');
    const lastMsg = companion.holoUI.messages[companion.holoUI.messages.length - 1];
    assert.equal(lastMsg.role, 'zada');
    assert.ok(lastMsg.text.includes('unavailable') || lastMsg.text.includes('trouble'));
  });

  await t.test('destroy cleans up listeners and disposes subsystems', () => {
    let disposed = false;
    const mockRenderer = {
      init: () => true,
      start: () => {},
      dispose: () => { disposed = true; },
      setDockMode: () => {}
    };

    const companion = new ZadaCompanion({ renderer: mockRenderer });
    companion.init(createMockElement('div'), { skipModelLoad: true, createElement: createMockElement });
    companion.destroy();

    assert.equal(disposed, true);
    assert.equal(companion.isInitialized, false);
  });

  await t.test('greetVisitor adds welcome message, mounts greeting bubble, and speaks aloud', () => {
    let spokenText = null;
    const mockAudio = {
      muted: false,
      speak: (text) => { spokenText = text; },
      interrupt: () => {},
      getAmplitude: () => 0
    };
    const companion = new ZadaCompanion({ audioSync: mockAudio });
    const container = createMockElement('div');
    companion.init(container, { skipModelLoad: true, createElement: createMockElement });

    // Clear initial message to test greetVisitor insertion
    companion.holoUI.messages = [];
    const greeting = companion.greetVisitor();

    assert.ok(greeting.includes('Welcome') || greeting.includes('Zada'));
    assert.equal(companion.holoUI.messages.length, 1);
    assert.equal(companion.holoUI.messages[0].text, greeting);
    assert.equal(spokenText, greeting);
    assert.ok(companion.greetingBubble);
    assert.ok(companion.greetingBubble.classList.contains('zada-greeting-bubble'));

    companion.destroy();
    assert.equal(companion.greetingBubble, null);
  });

  await t.test('pod trigger click dismisses active greeting bubble and toggles HUD', () => {
    const companion = new ZadaCompanion();
    const container = createMockElement('div');
    companion.init(container, { skipModelLoad: true, createElement: createMockElement });

    companion.showGreetingBubble('Hello from Zada', createMockElement);
    assert.ok(companion.greetingBubble);

    companion.podTrigger.click();
    assert.equal(companion.greetingBubble, null);
    assert.equal(companion.holoUI.isOpen, true);

    companion.destroy();
  });
});

