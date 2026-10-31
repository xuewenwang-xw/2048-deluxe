/**
 * @file audio_engine.js
 * Procedural Web Audio Synthesis Engine for 2048 Deluxe.
 * Zero external audio assets (100% offline self-containment).
 * 
 * Features:
 * - Lazy AudioContext initialization on first user gesture.
 * - Move Slide Whoosh: Exponential frequency sweep (200Hz -> 100Hz, 60ms).
 * - Harmonic Merge Chimes: Equal-temperament scale pitch formula f(v) = 220 * 2^((k-1)/12).
 *   Dual oscillator harmonics (sine + triangle) with exponential decay (80ms -> 300ms).
 * - Blocked Bump: Low frequency damped thud (90Hz -> 45Hz, 80ms).
 * - Victory Arpeggio: 5-note celebratory chord progression (C5 - E5 - G5 - C6 - E6).
 * - Master gain mute/unmute control.
 * - Transparent headless fallback in environments without Web Audio API (e.g. Node.js).
 */

export class AudioEngine {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.muted=false] - Initial mute state
   * @param {number} [options.volume=0.7] - Master volume [0.0, 1.0]
   * @param {typeof AudioContext|null} [options.audioContextClass] - Custom AudioContext class for mocking
   * @param {AudioContext|null} [options.audioContext] - Existing AudioContext instance
   */
  constructor(options = {}) {
    this._muted = Boolean(options.muted);
    this._volume = (typeof options.volume === 'number' && !isNaN(options.volume))
      ? Math.max(0, Math.min(1, options.volume))
      : 0.7;
    this._customAudioContextClass = options.audioContextClass || null;
    this._customAudioContext = options.audioContext || null;

    this._ctx = null;
    this._masterGain = null;
    this._initialized = false;
    this._gestureListenersAttached = false;

    // Detect if Web Audio API is potentially supported
    this._supported = Boolean(
      this._customAudioContext ||
      this._customAudioContextClass ||
      (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
    );

    // Auto-bind user gesture unlock in browser DOM environments
    this._bindGestureUnlock();
  }

  /**
   * Binds one-time user gesture listeners to resume or initialize AudioContext.
   * Modern browsers require user gestures (pointerdown, keydown, touchstart)
   * before audio playback is permitted.
   * @private
   */
  _bindGestureUnlock() {
    if (this._gestureListenersAttached) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const unlockEvents = ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click'];
    const unlockHandler = () => {
      this.init();
      if (this._ctx && this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
        this._ctx.resume().catch(() => {});
      }
    };

    unlockEvents.forEach(evt => {
      try {
        window.addEventListener(evt, unlockHandler, { passive: true, capture: true });
        document.addEventListener(evt, unlockHandler, { passive: true, capture: true });
      } catch (_) {}
    });

    this._gestureListenersAttached = true;
  }

  /**
   * Safely resolves the AudioContext constructor.
   * @private
   * @returns {typeof AudioContext|null}
   */
  _resolveAudioContextClass() {
    if (this._customAudioContextClass) return this._customAudioContextClass;
    if (typeof window !== 'undefined') {
      return window.AudioContext || window.webkitAudioContext || null;
    }
    return null;
  }

  /**
   * Initializes or resumes the Web Audio Context and Master Gain Node.
   * Idempotent and safe to call multiple times or in headless environments.
   * @returns {boolean} True if initialized and running/ready, false otherwise
   */
  init() {
    if (!this._supported) return false;

    if (!this._ctx) {
      if (this._customAudioContext) {
        this._ctx = this._customAudioContext;
      } else {
        const AudioContextClass = this._resolveAudioContextClass();
        if (!AudioContextClass) {
          this._supported = false;
          return false;
        }
        try {
          this._ctx = new AudioContextClass();
        } catch (_) {
          this._supported = false;
          return false;
        }
      }

      // Initialize Master GainNode
      try {
        this._masterGain = this._ctx.createGain();
        const initialVol = this._muted ? 0 : this._volume;
        this._masterGain.gain.setValueAtTime(initialVol, this._ctx.currentTime || 0);
        if ('value' in this._masterGain.gain) {
          this._masterGain.gain.value = initialVol;
        }
        this._masterGain.connect(this._ctx.destination);
      } catch (_) {
        this._supported = false;
        return false;
      }

      this._initialized = true;
    }

    // Resume if suspended by browser autoplay policy
    if (this._ctx && this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
      this._ctx.resume().catch(() => {});
    }

    return true;
  }

  /**
   * Checks if audio engine is supported in current runtime.
   * @returns {boolean}
   */
  isSupported() {
    return this._supported;
  }

  /**
   * Mute or unmute master audio.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this._muted = Boolean(muted);
    if (this._masterGain && this._ctx) {
      try {
        const target = this._muted ? 0 : this._volume;
        this._masterGain.gain.setValueAtTime(target, this._ctx.currentTime || 0);
        if ('value' in this._masterGain.gain) {
          this._masterGain.gain.value = target;
        }
      } catch (_) {}
    }
  }

  /**
   * Retrieves active mute state.
   * @returns {boolean}
   */
  isMuted() {
    return this._muted;
  }

  /**
   * Adjusts master audio volume level.
   * @param {number} vol - Range [0.0, 1.0]
   */
  setVolume(vol) {
    if (typeof vol !== 'number' || isNaN(vol)) {
      this._volume = 0;
    } else {
      this._volume = Math.max(0, Math.min(1, vol));
    }
    if (!this._muted && this._masterGain && this._ctx) {
      try {
        this._masterGain.gain.setValueAtTime(this._volume, this._ctx.currentTime || 0);
      } catch (_) {}
    }
  }

  /**
   * Retrieves active master volume.
   * @returns {number}
   */
  getVolume() {
    return this._volume;
  }

  /**
   * Helper to ensure AudioContext is active and ready before scheduling voices.
   * @private
   * @returns {AudioContext|null}
   */
  _ensureActiveContext() {
    if (this._muted || !this._supported) return null;
    if (!this._initialized || !this._ctx) {
      this.init();
    }
    if (!this._ctx) return null;
    if (this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  /**
   * Computes the equal-temperament merge pitch frequency:
   * f(v) = 220 * 2^((k - 1) / 12) where v = 2^k.
   * @param {number} value - Merged tile value (e.g. 2, 4, 8, ... 2048)
   * @returns {number} Frequency in Hertz
   */
  static calculateMergeFrequency(value) {
    const k = (typeof value === 'number' && !isNaN(value) && value > 1) ? Math.round(Math.log2(value)) : 1;
    return 220 * Math.pow(2, (k - 1) / 12);
  }

  /**
   * Play subtle slide whoosh sound on tile movement.
   * Profile: Exponential frequency sweep from 200Hz to 100Hz over 60ms.
   */
  playMove() {
    const ctx = this._ensureActiveContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const duration = 0.06; // 60ms

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + duration);

      // Instant audible attack and smooth exponential fade out (zero jitter drop)
      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(this._masterGain);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(t);
      osc.stop(t + duration);
    } catch (_) {}
  }

  /**
   * Play harmonically scaled chime on tile merge.
   * Profile:
   * - Fundamental frequency f(v) = 220 * 2^((k-1)/12)
   * - Dual oscillator harmonics:
   *     Osc 1: Sine at fundamental f(v)
   *     Osc 2: Triangle at fundamental f(v) (or harmonic overtone)
   * - Exponential decay scaling dynamically from 80ms (low values) to 300ms (2048+).
   * @param {number} value - Merged tile value (4, 8, 16, ... 2048)
   */
  playMerge(value) {
    const ctx = this._ensureActiveContext();
    if (!ctx) return;

    try {
      const k = (typeof value === 'number' && !isNaN(value) && value > 1) ? Math.round(Math.log2(value)) : 1;
      const freq = 220 * Math.pow(2, (k - 1) / 12);

      // Decay duration scales smoothly from 100ms (low values) to 320ms (2048+)
      const clampedK = Math.max(1, Math.min(11, k));
      const duration = 0.10 + (clampedK - 1) * 0.022; // [0.10s, 0.32s]

      const t = ctx.currentTime;

      // Voice 1: Sine fundamental (warmth & body)
      const oscSine = ctx.createOscillator();
      const gainSine = ctx.createGain();
      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(freq, t);

      gainSine.gain.setValueAtTime(0.75, t);
      gainSine.gain.exponentialRampToValueAtTime(0.001, t + duration);

      oscSine.connect(gainSine);
      gainSine.connect(this._masterGain);

      // Voice 2: Triangle harmonic overtone (crystal chime shimmer)
      const oscTri = ctx.createOscillator();
      const gainTri = ctx.createGain();
      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(freq, t);

      gainTri.gain.setValueAtTime(0.45, t);
      gainTri.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.85);

      oscTri.connect(gainTri);
      gainTri.connect(this._masterGain);

      // Garbage collection cleanup on voice completion
      oscSine.onended = () => {
        try {
          oscSine.disconnect();
          gainSine.disconnect();
          oscTri.disconnect();
          gainTri.disconnect();
        } catch (_) {}
      };

      oscSine.start(t);
      oscSine.stop(t + duration);
      oscTri.start(t);
      oscTri.stop(t + duration);
    } catch (_) {}
  }

  /**
   * Play tactile damped thud when a move is blocked.
   * Profile: Low frequency damped sweep from 90Hz down to 45Hz over 80ms.
   */
  playBlocked() {
    const ctx = this._ensureActiveContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const duration = 0.08; // 80ms

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + duration);

      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(this._masterGain);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start(t);
      osc.stop(t + duration);
    } catch (_) {}
  }

  /**
   * Play triumphant 5-note celebratory chord arpeggio upon victory (reaching 2048).
   * Profile: Ascending chord progression: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz),
   * C6 (1046.50Hz), E6 (1318.51Hz) with sparkling bell decay.
   */
  playWin() {
    const ctx = this._ensureActiveContext();
    if (!ctx) return;

    try {
      const chord = [
        { freq: 523.25, offset: 0.00, dur: 0.25, gain: 0.45 }, // C5
        { freq: 659.25, offset: 0.09, dur: 0.25, gain: 0.45 }, // E5
        { freq: 783.99, offset: 0.18, dur: 0.25, gain: 0.45 }, // G5
        { freq: 1046.50, offset: 0.27, dur: 0.30, gain: 0.50 }, // C6
        { freq: 1318.51, offset: 0.36, dur: 0.60, gain: 0.55 }  // E6 (prolonged ring)
      ];

      const baseTime = ctx.currentTime;

      chord.forEach((note) => {
        const noteStart = baseTime + note.offset;
        const noteEnd = noteStart + note.dur;

        // Sine fundamental
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, noteStart);

        gain.gain.setValueAtTime(note.gain, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

        osc.connect(gain);
        gain.connect(this._masterGain);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (_) {}
        };

        osc.start(noteStart);
        osc.stop(noteEnd);
      });
    } catch (_) {}
  }

  /**
   * Play instant acoustic confirmation chime (e.g. when unmuting).
   * Profile: 2-note ascending major third chime (C5 523.25Hz -> G5 783.99Hz).
   */
  playChime() {
    const ctx = this._ensureActiveContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      [
        { freq: 523.25, start: t, dur: 0.10, gain: 0.45 },
        { freq: 783.99, start: t + 0.09, dur: 0.22, gain: 0.50 }
      ].forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, note.start);
        gain.gain.setValueAtTime(note.gain, note.start);
        gain.gain.exponentialRampToValueAtTime(0.001, note.start + note.dur);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(note.start);
        osc.stop(note.start + note.dur);
      });
    } catch (_) {}
  }
}
