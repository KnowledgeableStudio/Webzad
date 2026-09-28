/**
 * ZadaAudioSync - Audio Synchronization & Unified Interruption Controller.
 * Manages SpeechSynthesis, Web Audio API decoding, amplitude envelopes,
 * and unified AbortController cancellation for barge-in interruptions.
 */

class ZadaAudioSync {
  /**
   * Initializes audio context and playback state variables.
   */
  constructor() {
    this.muted = false;
    this.amplitude = 0;
    this.playing = false;
    this.abortController = null;
    this.audioContext = null;
    this.analyser = null;
    this.currentSourceNode = null;
  }

  /**
   * Checks whether audio output is currently muted.
   * @returns {boolean} True if muted.
   */
  isMuted() {
    return this.muted;
  }

  /**
   * Sets mute state. Immediately interrupts audio when muted.
   * @param {boolean} muted - Desired mute status.
   */
  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) {
      this.interrupt();
    }
  }

  /**
   * Checks if audio is currently playing.
   * @returns {boolean} True if actively playing speech or buffer.
   */
  isPlaying() {
    return this.playing;
  }

  /**
   * Retrieves current normalized amplitude level [0, 1.0].
   * @returns {number} Clamped amplitude.
   */
  getAmplitude() {
    if (this.muted) return 0;
    if (this.analyser && this.playing) {
      try {
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / (data.length * 255);
        this.amplitude = Math.min(1.0, Math.max(0, avg * 1.5));
      } catch (err) {
        // Fallback to current amplitude if frequency analysis throws
      }
    }
    return this.amplitude;
  }

  /**
   * Instantly interrupts all active playback, speech, and decoding.
   */
  interrupt() {
    if (this.abortController) {
      try { this.abortController.abort(); } catch (e) {}
      this.abortController = null;
    }

    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch (e) {}
      this.currentSourceNode = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    this.playing = false;
    this.amplitude = 0;
  }

  /**
   * Synthesizes spoken text using Web Speech API with simulated envelope.
   * @param {string} text - Spoken dialogue text.
   * @param {Function} [onEnd] - Completion callback.
   */
  speak(text, onEnd) {
    this.interrupt();
    if (this.muted || !text || typeof window === 'undefined' || !window.speechSynthesis) {
      this._deferEnd(onEnd);
      return;
    }

    this.abortController = new AbortController();
    this.playing = true;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (this.playing) this.amplitude = 0.4;
      };
      utterance.onboundary = () => {
        if (this.playing) this.amplitude = 0.35 + Math.random() * 0.45;
      };
      utterance.onend = () => this._safeEnd(onEnd);
      utterance.onerror = () => this._safeEnd(onEnd);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      this._safeEnd(onEnd);
    }
  }

  /**
   * Plays an in-memory AudioBuffer through Web Audio API with analyser node.
   * @param {AudioBuffer} audioBuffer - Decoded audio sample buffer.
   * @param {Function} [onEnd] - Completion callback.
   */
  playAudioBuffer(audioBuffer, onEnd) {
    this.interrupt();
    const hasAudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (this.muted || !audioBuffer || !hasAudioCtx) {
      this._deferEnd(onEnd);
      return;
    }

    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.connect(this.audioContext.destination);
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.abortController = new AbortController();
      this.playing = true;

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyser);
      this.currentSourceNode = source;

      source.onended = () => {
        this.currentSourceNode = null;
        this._safeEnd(onEnd);
      };

      source.start(0);
    } catch (err) {
      this._safeEnd(onEnd);
    }
  }

  /**
   * Completes playback cleanly and triggers callback.
   * @private
   */
  _safeEnd(onEnd) {
    this.playing = false;
    this.amplitude = 0;
    if (typeof onEnd === 'function') onEnd();
  }

  /**
   * Asynchronously invokes callback when playback cannot start.
   * @private
   */
  _deferEnd(onEnd) {
    if (typeof onEnd === 'function') setTimeout(onEnd, 0);
  }
}

// Universal export across Node.js, Browser Window, and Service Workers
if (typeof module !== 'undefined' && module.exports) module.exports = { ZadaAudioSync };
if (typeof window !== 'undefined') window.ZadaAudioSync = ZadaAudioSync;
if (typeof globalThis !== 'undefined') globalThis.ZadaAudioSync = ZadaAudioSync;

