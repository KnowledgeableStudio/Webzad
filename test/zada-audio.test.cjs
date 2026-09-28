const test = require('node:test');
const assert = require('node:assert/strict');
const { ZadaAudioSync } = require('../assets/js/zada-audio.js');

test('ZadaAudioSync state and interruption management', async (t) => {
  await t.test('interrupt aborts playback and resets amplitude', () => {
    const audio = new ZadaAudioSync();
    audio.amplitude = 0.8;
    audio.playing = true;
    audio.interrupt();
    assert.equal(audio.getAmplitude(), 0);
    assert.equal(audio.isPlaying(), false);
  });

  await t.test('mute flag prevents audio output and resets amplitude', () => {
    const audio = new ZadaAudioSync();
    audio.amplitude = 0.5;
    audio.setMuted(true);
    assert.equal(audio.isMuted(), true);
    assert.equal(audio.getAmplitude(), 0);
  });

  await t.test('speak when muted returns immediately via onEnd', (t, done) => {
    const audio = new ZadaAudioSync();
    audio.setMuted(true);
    audio.speak('Hello', () => {
      assert.equal(audio.isPlaying(), false);
      done();
    });
  });

  await t.test('playAudioBuffer handles null buffer safely', (t, done) => {
    const audio = new ZadaAudioSync();
    audio.playAudioBuffer(null, () => {
      assert.equal(audio.isPlaying(), false);
      done();
    });
  });

  await t.test('interrupt triggers abort on active AbortController and stops node', () => {
    const audio = new ZadaAudioSync();
    const controller = new AbortController();
    let stopped = false;
    let disconnected = false;

    audio.abortController = controller;
    audio.currentSourceNode = {
      stop: () => { stopped = true; },
      disconnect: () => { disconnected = true; }
    };
    audio.playing = true;
    audio.amplitude = 0.7;

    audio.interrupt();

    assert.equal(controller.signal.aborted, true);
    assert.equal(stopped, true);
    assert.equal(disconnected, true);
    assert.equal(audio.currentSourceNode, null);
    assert.equal(audio.isPlaying(), false);
    assert.equal(audio.getAmplitude(), 0);
  });

  await t.test('setMuted(true) triggers interrupt', () => {
    const audio = new ZadaAudioSync();
    let interrupted = false;
    audio.interrupt = () => { interrupted = true; };
    audio.setMuted(true);
    assert.equal(interrupted, true);
    assert.equal(audio.isMuted(), true);
  });

  await t.test('speak with mocked speechSynthesis updates envelope and completes', (t, done) => {
    const originalWindow = global.window;
    let spokenUtterance = null;
    let cancelled = false;

    global.window = {
      speechSynthesis: {
        speak: (u) => {
          spokenUtterance = u;
          u.onstart();
        },
        cancel: () => { cancelled = true; }
      }
    };
    global.SpeechSynthesisUtterance = function (text) {
      this.text = text;
      this.rate = 1.0;
      this.pitch = 1.0;
    };

    try {
      const audio = new ZadaAudioSync();
      audio.speak('Test synthesis', () => {
        assert.equal(audio.isPlaying(), false);
        assert.equal(audio.getAmplitude(), 0);
        done();
      });

      assert.equal(audio.isPlaying(), true);
      assert.equal(audio.getAmplitude(), 0.4);

      spokenUtterance.onboundary();
      assert.ok(audio.getAmplitude() >= 0.35 && audio.getAmplitude() <= 0.8);

      spokenUtterance.onend();
    } finally {
      global.window = originalWindow;
      delete global.SpeechSynthesisUtterance;
    }
  });

  await t.test('playAudioBuffer with mocked AudioContext decodes and calculates amplitude', (t, done) => {
    const originalWindow = global.window;
    let sourceStarted = false;
    let sourceNodeInstance = null;

    class MockAnalyser {
      constructor() {
        this.frequencyBinCount = 32;
        this.fftSize = 64;
      }
      connect() {}
      getByteFrequencyData(arr) {
        arr.fill(128);
      }
    }

    class MockAudioContext {
      constructor() {
        this.state = 'suspended';
        this.destination = {};
      }
      createAnalyser() { return new MockAnalyser(); }
      createBufferSource() {
        sourceNodeInstance = {
          buffer: null,
          connect: () => {},
          start: () => { sourceStarted = true; },
          stop: () => {},
          disconnect: () => {}
        };
        return sourceNodeInstance;
      }
      resume() { this.state = 'running'; }
    }

    global.window = { AudioContext: MockAudioContext };

    try {
      const audio = new ZadaAudioSync();
      const mockBuffer = { duration: 1.0 };

      audio.playAudioBuffer(mockBuffer, () => {
        assert.equal(audio.isPlaying(), false);
        done();
      });

      assert.equal(sourceStarted, true);
      assert.equal(audio.isPlaying(), true);
      const amp = audio.getAmplitude();
      assert.ok(amp > 0 && amp <= 1.0, `Amplitude ${amp} should be bounded`);

      sourceNodeInstance.onended();
    } finally {
      global.window = originalWindow;
    }
  });

  await t.test('fault isolation handles audio context exceptions without throwing', (t, done) => {
    const originalWindow = global.window;
    global.window = {
      AudioContext: class {
        constructor() { throw new Error('Hardware failure'); }
      }
    };

    try {
      const audio = new ZadaAudioSync();
      audio.playAudioBuffer({ length: 100 }, () => {
        assert.equal(audio.isPlaying(), false);
        assert.equal(audio.getAmplitude(), 0);
        done();
      });
    } finally {
      global.window = originalWindow;
    }
  });

  await t.test('universal export exposes ZadaAudioSync to globalThis and module.exports', () => {
    assert.ok(typeof ZadaAudioSync === 'function');
    assert.equal(globalThis.ZadaAudioSync, ZadaAudioSync);
  });
});
