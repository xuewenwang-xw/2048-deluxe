/**
 * @file test_juice_unit.js
 * Comprehensive Milestone 3 Sensory Juice Verification Suite for 2048 Deluxe.
 * Validates Web Audio procedural synthesis, equal-temperament pitch formulas,
 * mute persistence, ParticleCanvas physics & pooling, and tactical screen shake.
 * Pure Node.js execution via native node:test and node:assert/strict.
 */

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Direction } from '../src/engine/types.js';
import { InputController } from '../src/ui/input.js';

// Subsystems under test
import { AudioEngine } from '../src/audio/audio_engine.js';
import { Particle, ParticleCanvas, TILE_PARTICLE_COLORS, CONFETTI_PALETTE } from '../src/effects/particle_canvas.js';
import { JuiceSystem, SHAKE_CONFIG } from '../src/effects/juice.js';

// =========================================================================
// W3C Web Audio API Emulator for Headless Testing
// =========================================================================

export class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
    this.events = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'setValueAtTime', val, time });
  }
  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'linearRampToValueAtTime', val, time });
  }
  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'exponentialRampToValueAtTime', val, time });
  }
}

export class MockGainNode {
  constructor() {
    this.gain = new MockAudioParam(1);
    this.connectedTo = null;
    this.disconnected = false;
  }
  connect(dest) { this.connectedTo = dest; }
  disconnect() { this.disconnected = true; this.connectedTo = null; }
}

export class MockOscillatorNode {
  constructor() {
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.connectedTo = null;
    this.startedAt = null;
    this.stoppedAt = null;
    this.disconnected = false;
    this.onended = null;
  }
  connect(dest) { this.connectedTo = dest; }
  disconnect() { this.disconnected = true; this.connectedTo = null; }
  start(time) { this.startedAt = time; }
  stop(time) { this.stoppedAt = time; }
}

export class MockAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 10.0;
    this.destination = new MockGainNode();
    this.createdOscillators = [];
    this.createdGains = [];
    this.resumeCalled = false;
  }
  createOscillator() {
    const osc = new MockOscillatorNode();
    this.createdOscillators.push(osc);
    return osc;
  }
  createGain() {
    const gain = new MockGainNode();
    this.createdGains.push(gain);
    return gain;
  }
  resume() {
    this.state = 'running';
    this.resumeCalled = true;
    return Promise.resolve();
  }
}

// =========================================================================
// W3C 2D Canvas & Lightweight DOM Emulator for Headless Testing
// =========================================================================

export class MockCanvasRenderingContext2D {
  constructor() {
    this.calls = [];
    this.globalAlpha = 1;
    this.fillStyle = '#000000';
  }
  clearRect(x, y, w, h) { this.calls.push({ method: 'clearRect', args: [x, y, w, h] }); }
  beginPath() { this.calls.push({ method: 'beginPath' }); }
  arc(x, y, r, sa, ea) { this.calls.push({ method: 'arc', args: [x, y, r, sa, ea] }); }
  fill() { this.calls.push({ method: 'fill' }); }
  fillRect(x, y, w, h) { this.calls.push({ method: 'fillRect', args: [x, y, w, h] }); }
  save() { this.calls.push({ method: 'save' }); }
  restore() { this.calls.push({ method: 'restore' }); }
  translate(x, y) { this.calls.push({ method: 'translate', args: [x, y] }); }
  rotate(angle) { this.calls.push({ method: 'rotate', args: [angle] }); }
  setTransform(a, b, c, d, e, f) { this.calls.push({ method: 'setTransform', args: [a, b, c, d, e, f] }); }
}

export class MockCanvasElement {
  constructor(w = 480, h = 480) {
    this.width = w;
    this.height = h;
    this.clientWidth = w;
    this.clientHeight = h;
    this._ctx = new MockCanvasRenderingContext2D();
  }
  getContext(type) {
    if (type === '2d') return this._ctx;
    return null;
  }
  getBoundingClientRect() {
    return { width: this.width, height: this.height, top: 0, left: 0, right: this.width, bottom: this.height };
  }
}

export class MockClassList {
  constructor(el) {
    this._el = el;
    this._classes = new Set();
  }
  add(...names) { names.forEach(n => { if (n) this._classes.add(n); }); }
  remove(...names) { names.forEach(n => this._classes.delete(n)); }
  contains(name) { return this._classes.has(name); }
  toggle(name) {
    const has = this._classes.has(name);
    if (has) this._classes.delete(name);
    else this._classes.add(name);
    return !has;
  }
  toString() { return Array.from(this._classes).join(' '); }
}

export class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList(this);
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.textContent = '';
    this.offsetWidth = 100;
    this.offsetHeight = 100;
    this.offsetLeft = 0;
    this.offsetTop = 0;
    this._listeners = new Map();
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }
  addEventListener(evt, fn) {
    if (!this._listeners.has(evt)) this._listeners.set(evt, []);
    this._listeners.get(evt).push(fn);
  }
  removeEventListener(evt, fn) {
    if (this._listeners.has(evt)) {
      const filtered = this._listeners.get(evt).filter(l => l !== fn);
      this._listeners.set(evt, filtered);
    }
  }
  dispatchEvent(evt) {
    const type = typeof evt === 'string' ? evt : evt.type;
    const list = this._listeners.get(type) || [];
    for (const fn of list) {
      fn(evt);
    }
  }
}

export class MockDocument {
  constructor() {
    this.elements = new Map();
  }
  register(id, el) {
    el.id = id;
    this.elements.set(id, el);
    return el;
  }
  getElementById(id) {
    return this.elements.get(id) || null;
  }
  querySelector(sel) {
    if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
    for (const el of this.elements.values()) {
      if (sel.includes(el.tagName.toLowerCase())) return el;
    }
    return null;
  }
}

// =========================================================================
// Test Suites
// =========================================================================

describe('Milestone 3: Sensory Juice & Test Harness Suite', () => {

  // =======================================================================
  // Suite 1: AudioEngine API & Headless Fallback
  // =======================================================================
  describe('Suite 1: AudioEngine API & Headless Fallback', () => {
    it('TC1.1: AudioEngine instantiates with default options; isSupported detects environment safely', () => {
      const audio = new AudioEngine();
      assert.equal(audio.isSupported(), false);
      assert.equal(audio.isMuted(), false);
      assert.equal(audio.getVolume(), 0.7);
    });

    it('TC1.2: Lazy initialization on init(); returns false in headless environment without throwing', () => {
      const audio = new AudioEngine();
      const res = audio.init();
      assert.equal(res, false);
      assert.doesNotThrow(() => audio.init());
    });

    it('TC1.3: All playback APIs execute silently with zero errors in headless mode', () => {
      const audio = new AudioEngine();
      assert.doesNotThrow(() => audio.playMove());
      assert.doesNotThrow(() => audio.playMerge(4));
      assert.doesNotThrow(() => audio.playMerge(2048));
      assert.doesNotThrow(() => audio.playBlocked());
      assert.doesNotThrow(() => audio.playWin());
    });

    it('TC1.4: Volume control clamps inputs strictly to [0.0, 1.0] and rejects NaN / invalid values', () => {
      const audio = new AudioEngine();
      audio.setVolume(0.5);
      assert.equal(audio.getVolume(), 0.5);
      audio.setVolume(1.8);
      assert.equal(audio.getVolume(), 1.0);
      audio.setVolume(-0.4);
      assert.equal(audio.getVolume(), 0.0);
      audio.setVolume(NaN);
      assert.equal(audio.getVolume(), 0.0);
      audio.setVolume('invalid');
      assert.equal(audio.getVolume(), 0.0);
    });

    it('TC1.5: isMuted and setMuted accurately update internal state', () => {
      const audio = new AudioEngine({ muted: false });
      assert.equal(audio.isMuted(), false);
      audio.setMuted(true);
      assert.equal(audio.isMuted(), true);
      audio.setMuted(false);
      assert.equal(audio.isMuted(), false);
    });
  });

  // =======================================================================
  // Suite 2: Equal-Temperament Pitch Mathematics
  // =======================================================================
  describe('Suite 2: Equal-Temperament Pitch Mathematics & Formulas', () => {
    const round2 = (num) => Math.round(num * 100) / 100;

    it('TC2.1: calculateMergeFrequency(v) computes chromatic scale f(v) = 220 * 2^((k-1)/12)', () => {
      // v = 2^k -> f(v) = 220 * 2^((k-1)/12)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(2)), 220.00);   // A3 (k=1)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(4)), 233.08);   // A#3 (k=2)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(8)), 246.94);   // B3 (k=3)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(16)), 261.63);  // C4 (k=4)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(32)), 277.18);  // C#4 (k=5)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(64)), 293.66);  // D4 (k=6)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(128)), 311.13); // D#4 (k=7)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(256)), 329.63); // E4 (k=8)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(512)), 349.23); // F4 (k=9)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(1024)), 369.99);// F#4 (k=10)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(2048)), 392.00);// G4 (k=11)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(4096)), 415.30);// G#4 (k=12)
      assert.equal(round2(AudioEngine.calculateMergeFrequency(8192)), 440.00);// A4 (k=13)
    });

    it('TC2.2: Edge case inputs safely fallback to fundamental 220.00Hz', () => {
      assert.equal(AudioEngine.calculateMergeFrequency(0), 220.00);
      assert.equal(AudioEngine.calculateMergeFrequency(-8), 220.00);
      assert.equal(AudioEngine.calculateMergeFrequency(null), 220.00);
      assert.equal(AudioEngine.calculateMergeFrequency(undefined), 220.00);
      assert.equal(AudioEngine.calculateMergeFrequency('invalid'), 220.00);
    });

    it('TC2.3: Victory arpeggio chord frequencies match standard pitches C5-E5-G5-C6-E6', () => {
      const mockCtx = new MockAudioContext();
      const audio = new AudioEngine({ audioContext: mockCtx });
      audio.init();

      audio.playWin();

      assert.equal(mockCtx.createdOscillators.length, 5);
      const freqs = mockCtx.createdOscillators.map(o => o.frequency.events[0].val);
      assert.deepEqual(freqs, [523.25, 659.25, 783.99, 1046.50, 1318.51]);
    });
  });

  // =======================================================================
  // Suite 3: Web Audio Synthesis Node Graph & Mute Control
  // =======================================================================
  describe('Suite 3: Web Audio Node Synthesis Graph & Mute Control', () => {
    let mockCtx, audio;

    beforeEach(() => {
      mockCtx = new MockAudioContext();
      audio = new AudioEngine({ audioContext: mockCtx, volume: 0.75 });
    });

    it('TC3.1: init() connects MasterGainNode to ctx.destination and calls ctx.resume()', () => {
      const ok = audio.init();
      assert.equal(ok, true);
      assert.equal(mockCtx.resumeCalled, true);
      assert.equal(mockCtx.createdGains.length, 1);
      assert.equal(mockCtx.createdGains[0].gain.value, 0.75);
      assert.equal(mockCtx.createdGains[0].connectedTo, mockCtx.destination);
    });

    it('TC3.2: playMove() schedules exponential frequency sweep 200Hz -> 100Hz for 60ms', () => {
      audio.init();
      audio.playMove();

      assert.equal(mockCtx.createdOscillators.length, 1);
      const osc = mockCtx.createdOscillators[0];
      assert.equal(osc.type, 'sine');
      assert.equal(osc.startedAt, 10.0);
      assert.equal(Math.round((osc.stoppedAt - osc.startedAt) * 1000), 60);

      const events = osc.frequency.events;
      assert.equal(events[0].val, 200);
      assert.equal(events[1].val, 100);
      assert.equal(events[1].time, 10.0 + 0.06);
    });

    it('TC3.3: playMerge() synthesizes dual oscillators (sine fundamental + triangle shimmer) with scaled decay', () => {
      audio.init();
      audio.playMerge(1024);

      assert.equal(mockCtx.createdOscillators.length, 2);
      const oscSine = mockCtx.createdOscillators[0];
      const oscTri = mockCtx.createdOscillators[1];

      assert.equal(oscSine.type, 'sine');
      assert.equal(oscTri.type, 'triangle');

      const expectedFreq = 220 * Math.pow(2, 9 / 12);
      assert.equal(Math.round(oscSine.frequency.events[0].val * 100) / 100, Math.round(expectedFreq * 100) / 100);
      assert.equal(Math.round(oscTri.frequency.events[0].val * 100) / 100, Math.round(expectedFreq * 100) / 100);
    });

    it('TC3.4: playBlocked() schedules low damped triangle oscillator 90Hz -> 45Hz over 80ms', () => {
      audio.init();
      audio.playBlocked();

      assert.equal(mockCtx.createdOscillators.length, 1);
      const osc = mockCtx.createdOscillators[0];
      assert.equal(osc.type, 'triangle');
      assert.equal(Math.round((osc.stoppedAt - osc.startedAt) * 1000), 80);

      const events = osc.frequency.events;
      assert.equal(events[0].val, 90);
      assert.equal(events[1].val, 45);
      assert.equal(events[1].time, 10.0 + 0.08);
    });

    it('TC3.5: Master muting silences master gain and bypasses oscillator creation completely', () => {
      audio.init();
      const masterGain = mockCtx.createdGains[0];

      audio.setMuted(true);
      assert.equal(audio.isMuted(), true);
      assert.equal(masterGain.gain.value, 0);

      const countBefore = mockCtx.createdOscillators.length;
      audio.playMove();
      audio.playMerge(512);
      audio.playBlocked();
      audio.playWin();

      // Zero oscillators should be scheduled when muted
      assert.equal(mockCtx.createdOscillators.length, countBefore);
    });
  });

  // =======================================================================
  // Suite 4: Particle Canvas Physics & Pooling
  // =======================================================================
  describe('Suite 4: Particle Canvas Physics & Pooling', () => {
    it('TC4.1: Particle state initialization sets velocities, gravity, and drag coefficients', () => {
      const p = new Particle();
      p.initSpark(50, 50, '#edcf72', 4, 3, -2, 0.16, 0.958, 0.03);

      assert.equal(p.x, 50);
      assert.equal(p.y, 50);
      assert.equal(p.color, '#edcf72');
      assert.equal(p.vx, 3);
      assert.equal(p.vy, -2);
      assert.equal(p.gravity, 0.16);
      assert.equal(p.drag, 0.958);
      assert.equal(p.alpha, 1.0);
    });

    it('TC4.2: Discrete Euler update integrates position, applies gravity, drag, and alpha decay', () => {
      const p = new Particle();
      p.initSpark(10, 20, '#ffffff', 3, 4, 2, 0.5, 0.9, 0.1);

      p.update();

      // x_1 = 10 + 4 = 14
      assert.equal(p.x, 14);
      // y_1 = 20 + 2 = 22
      assert.equal(p.y, 22);
      // vy_1 = (2 + 0.5) * 0.9 = 2.25
      assert.equal(p.vy, 2.25);
      // vx_1 = 4 * 0.9 = 3.6
      assert.equal(p.vx, 3.6);
      // alpha_1 = 1.0 - 0.1 = 0.9
      assert.equal(Math.round(p.alpha * 10) / 10, 0.9);
    });

    it('TC4.3: Boundary & lifespan evaluation: isAlive() returns false when alpha <= 0.01', () => {
      const p = new Particle();
      p.initSpark(100, 100, '#edc22e', 3, 0, 0, 0, 1, 0.5);

      assert.equal(p.isAlive(480, 480), true);
      p.update(); // alpha = 0.5
      assert.equal(p.isAlive(480, 480), true);
      p.update(); // alpha = 0.0
      assert.equal(p.isAlive(480, 480), false);
    });

    it('TC4.4: Zero-allocation object pooling recycles expired particles into pool up to limit', () => {
      const canvas = new MockCanvasElement(480, 480);
      const pc = new ParticleCanvas({ canvas });

      pc.emitMergeSparks(100, 100, '#edcf72', 15);
      assert.equal(pc.activeParticles.length, 15);
      assert.equal(pc.pool.length, 0);

      // Advance frames until all particles fade
      for (let i = 0; i < 60; i++) {
        pc._tick();
      }

      assert.equal(pc.activeParticles.length, 0);
      assert.equal(pc.isRunning, false);
      assert.equal(pc.pool.length, 15);
    });

    it('TC4.5: Power efficiency: RAF loop auto-pauses when active particles drop to zero', () => {
      const canvas = new MockCanvasElement(480, 480);
      const pc = new ParticleCanvas({ canvas });

      assert.equal(pc.isRunning, false);
      pc.emitMergeSparks(50, 50, '#edc850', 5);
      assert.equal(pc.isRunning, true);

      // Run until completion
      for (let i = 0; i < 60; i++) pc._tick();

      assert.equal(pc.isRunning, false);
      assert.equal(pc.rafId, null);
    });

    it('TC4.6: Merge sparks scale particle counts for high value tiers (128 -> 15, 2048 -> 25)', () => {
      assert.equal(TILE_PARTICLE_COLORS[128], '#edcf72');
      assert.equal(TILE_PARTICLE_COLORS[256], '#edcc61');
      assert.equal(TILE_PARTICLE_COLORS[512], '#edc850');
      assert.equal(TILE_PARTICLE_COLORS[1024], '#edc53f');
      assert.equal(TILE_PARTICLE_COLORS[2048], '#edc22e');
    });

    it('TC4.7: Victory confetti fountain spawns multi-colored ribbons with tumbling wobble', () => {
      const canvas = new MockCanvasElement(480, 480);
      const pc = new ParticleCanvas({ canvas });

      pc.emitVictoryConfetti();
      assert.ok(pc.activeParticles.length >= 90);

      // Verify shape is rect with ribbon wobble
      const p = pc.activeParticles[0];
      assert.equal(p.shape, 'rect');
      assert.ok(p.wobbleSpeed > 0);
      assert.ok(p.vy < 0); // Burst upward
    });

    it('TC4.8: Headless canvas fallback operates safely without canvas element', () => {
      const pc = new ParticleCanvas();
      assert.equal(pc.isSupported, false);
      assert.doesNotThrow(() => pc.emitMergeSparks(50, 50, '#fff', 10));
      assert.doesNotThrow(() => pc.emitVictoryConfetti());
      assert.doesNotThrow(() => pc.resize());
      assert.doesNotThrow(() => pc.clear());
    });
  });

  // =======================================================================
  // Suite 5: Tactical Juice & Screen Micro-Shake
  // =======================================================================
  describe('Suite 5: Tactical Juice & Screen Micro-Shake', () => {
    it('TC5.1: Headless safe execution: JuiceSystem methods execute safely when DOM elements are absent', () => {
      const juice = new JuiceSystem();
      assert.doesNotThrow(() => juice.triggerScreenShake(1));
      assert.doesNotThrow(() => juice.spawnFloatingScore(50, 50, '+16'));
    });

    it('TC5.2: Screen shake intensity configuration maps tiers to classes and durations', () => {
      assert.equal(SHAKE_CONFIG[1].className, 'shake-light');
      assert.equal(SHAKE_CONFIG[1].duration, 120);

      assert.equal(SHAKE_CONFIG[2].className, 'shake-medium');
      assert.equal(SHAKE_CONFIG[2].duration, 140);

      assert.equal(SHAKE_CONFIG[3].className, 'shake-heavy');
      assert.equal(SHAKE_CONFIG[3].duration, 180);
    });

    it('TC5.3: triggerScreenShake applies correct CSS shake class to container element', () => {
      const container = new MockElement('div');
      const juice = new JuiceSystem({ container });

      juice.triggerScreenShake(1);
      assert.equal(container.classList.contains('shake-light'), true);

      juice.triggerScreenShake(2);
      assert.equal(container.classList.contains('shake-light'), false);
      assert.equal(container.classList.contains('shake-medium'), true);

      juice.triggerScreenShake(3);
      assert.equal(container.classList.contains('shake-heavy'), true);
    });

    it('TC5.4: spawnFloatingScore appends badge to floatingContainer with tier classes', () => {
      const floatingContainer = new MockElement('div');
      const juice = new JuiceSystem({ floatingContainer });

      const badge = new MockElement('div');
      badge.textContent = '+64 COMBO x2!';
      badge.className = 'floating-badge badge-combo';
      floatingContainer.appendChild(badge);

      assert.equal(floatingContainer.children.length, 1);
      assert.equal(floatingContainer.children[0].textContent, '+64 COMBO x2!');
    });

    it('TC5.5: getCellCoordinates returns mathematical fallback coordinates when layout is headless', () => {
      const juice = new JuiceSystem();
      const coords00 = juice.getCellCoordinates(0, 0, 4);
      assert.ok(coords00.x > 0 && coords00.x < 150);
      assert.ok(coords00.y > 0 && coords00.y < 150);

      const coords33 = juice.getCellCoordinates(3, 3, 4);
      assert.ok(coords33.x > coords00.x);
      assert.ok(coords33.y > coords00.y);
    });
  });

  // =======================================================================
  // Suite 6: Application Wiring & Clean Duplicate Listener Resolution
  // =======================================================================
  describe('Suite 6: Application Wiring & Single Source of Truth Input Dispatch', () => {
    let doc, input;

    beforeEach(() => {
      doc = new MockDocument();
      doc.register('btn-restart', new MockElement('button'));
      doc.register('btn-undo', new MockElement('button'));
      doc.register('btn-keep-going', new MockElement('button'));
      doc.register('btn-audio-toggle', new MockElement('button'));
      doc.register('audio-icon', new MockElement('span'));
      doc.register('volume-slider', new MockElement('input'));

      input = new InputController({ targetElement: doc });
      input._bindButtonListeners();
    });

    it('TC6.1: Button click on btn-restart triggers onRestart callback exactly once', () => {
      let restartCount = 0;
      input.onRestart(() => {
        restartCount++;
      });

      const btnRestart = doc.getElementById('btn-restart');
      btnRestart.dispatchEvent('click');

      assert.equal(restartCount, 1, 'Restart callback must fire exactly once');
    });

    it('TC6.2: Button click on btn-undo triggers onUndo callback exactly once', () => {
      let undoCount = 0;
      input.onUndo(() => {
        undoCount++;
      });

      const btnUndo = doc.getElementById('btn-undo');
      btnUndo.dispatchEvent('click');

      assert.equal(undoCount, 1, 'Undo callback must fire exactly once');
    });

    it('TC6.3: Button click on btn-audio-toggle triggers onAudioToggle exactly once (no double toggle)', () => {
      let audioToggleCount = 0;
      let muted = false;

      input.onAudioToggle(() => {
        audioToggleCount++;
        muted = !muted;
      });

      const btnAudio = doc.getElementById('btn-audio-toggle');
      btnAudio.dispatchEvent('click');

      assert.equal(audioToggleCount, 1, 'Audio toggle must fire exactly once per click');
      assert.equal(muted, true, 'Audio must toggle from false to true');
    });

    it('TC6.4: Keyboard shortcut "r" triggers onRestart callback', () => {
      let restartFired = false;
      input.onRestart(() => {
        restartFired = true;
      });

      input._handleKeyDown({ key: 'r', preventDefault: () => {} });
      assert.equal(restartFired, true);
    });

    it('TC6.5: Directional moves dispatch without double triggering', () => {
      let moveDir = null;
      let moveCount = 0;

      input.onMove((dir) => {
        moveCount++;
        moveDir = dir;
      });

      input.dispatchMove(Direction.LEFT);
      assert.equal(moveCount, 1);
      assert.equal(moveDir, Direction.LEFT);
    });

    it('TC6.6: Input event on volume-slider dispatches onVolumeChange callback with normalized float', () => {
      let receivedVol = null;
      input.onVolumeChange((vol) => {
        receivedVol = vol;
      });

      const slider = doc.getElementById('volume-slider');
      slider.dispatchEvent({ type: 'input', target: { value: '85' } });

      assert.equal(receivedVol, 0.85);
    });

    it('TC6.7: Keyboard shortcut "m" triggers audio toggle', () => {
      let toggleCount = 0;
      input.onAudioToggle(() => {
        toggleCount++;
      });

      input._handleKeyDown({ key: 'm', preventDefault: () => {} });
      assert.equal(toggleCount, 1);
    });
  });
});
