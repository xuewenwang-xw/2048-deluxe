/**
 * @file particle_canvas.js
 * High-performance 2D Canvas Particle Engine for 2048 Deluxe.
 * Handles merge sparks, victory confetti fountains, object pooling, and battery-efficient RAF loop.
 * Safe for headless environments (Node.js).
 */

export const DEFAULT_SPARK_COUNT = 20;
export const MAX_POOL_SIZE = 300;

export const TILE_PARTICLE_COLORS = Object.freeze({
  128: '#edcf72',
  256: '#edcc61',
  512: '#edc850',
  1024: '#edc53f',
  2048: '#edc22e',
  4096: '#a349a4',
  8192: '#00b4d8',
  16384: '#2ec4b6',
  32768: '#e01a4f',
  65536: '#00fff5'
});

export const CONFETTI_PALETTE = Object.freeze([
  '#edc22e', // Gold
  '#ff007f', // Cyber Pink
  '#00fff5', // Cyber Cyan
  '#00b4d8', // Vivid Blue
  '#2ec4b6', // Neon Teal
  '#e01a4f', // Crimson
  '#ffb000', // Amber
  '#ffffff', // Shimmer White
  '#a349a4'  // Cyber Violet
]);

/**
 * Individual Particle representing a spark or confetti ribbon.
 */
export class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 0;
    this.drag = 1;
    this.size = 3;
    this.color = '#ffffff';
    this.alpha = 1;
    this.alphaDecay = 0.03;
    this.rotation = 0;
    this.vRot = 0;
    this.shape = 'circle'; // 'circle' | 'rect'
    this.wobble = 0;
    this.wobbleSpeed = 0;
    this.aspectRatio = 1;
  }

  initSpark(x, y, color, size, vx, vy, gravity, drag, alphaDecay) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.drag = drag;
    this.alpha = 1.0;
    this.alphaDecay = alphaDecay;
    this.rotation = 0;
    this.vRot = 0;
    this.shape = 'circle';
    this.wobble = 0;
    this.wobbleSpeed = 0;
    this.aspectRatio = 1;
  }

  initConfetti(x, y, color, width, height, vx, vy, gravity, drag, alphaDecay, vRot, wobbleSpeed) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = width;
    this.aspectRatio = height / width;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.drag = drag;
    this.alpha = 1.0;
    this.alphaDecay = alphaDecay;
    this.rotation = Math.random() * Math.PI * 2;
    this.vRot = vRot;
    this.shape = 'rect';
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = wobbleSpeed;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy = (this.vy + this.gravity) * this.drag;
    this.vx *= this.drag;
    this.rotation += this.vRot;
    this.wobble += this.wobbleSpeed;
    this.alpha -= this.alphaDecay;
  }

  isAlive(width, height) {
    return this.alpha > 0.01 && this.y < height + 60 && this.x > -60 && this.x < width + 60;
  }

  render(ctx) {
    if (this.alpha <= 0 || !ctx) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
    ctx.fillStyle = this.color;

    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.size * this.alpha), 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'rect') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      const wobbleWidth = this.size * Math.abs(Math.cos(this.wobble));
      const height = this.size * this.aspectRatio;
      ctx.fillRect(-wobbleWidth / 2, -height / 2, wobbleWidth, height);
    }
    ctx.restore();
  }
}

/**
 * 2D Canvas Particle Engine with Object Pooling and Auto-Pausing RAF Loop.
 */
export class ParticleCanvas {
  /**
   * @param {Object} [options={}]
   */
  constructor(options = {}) {
    this.canvas = null;
    this.ctx = null;
    this.isSupported = false;
    this.width = 480;
    this.height = 480;
    this.dpr = 1;
    this.maxPoolSize = options.maxPoolSize || MAX_POOL_SIZE;

    this.pool = [];
    this.activeParticles = [];
    this.isRunning = false;
    this.rafId = null;

    this._tick = this._tick.bind(this);
    this.resize = this.resize.bind(this);

    if (options.canvas) {
      this.init(options.canvas);
    }
  }

  /**
   * Binds canvas element and initializes context & dimensions.
   * @param {HTMLCanvasElement|string} canvasElement
   */
  init(canvasElement) {
    let el = canvasElement;
    if (typeof el === 'string' && typeof document !== 'undefined') {
      el = document.querySelector(el);
    }

    if (!el || typeof el.getContext !== 'function') {
      this.isSupported = false;
      return;
    }

    try {
      this.canvas = el;
      this.ctx = el.getContext('2d');
      this.isSupported = Boolean(this.ctx);
    } catch {
      this.isSupported = false;
      return;
    }

    if (this.isSupported) {
      this.resize();
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('resize', this.resize);
      }
    }
  }

  /**
   * Resizes canvas to match container with High-DPI support.
   */
  resize() {
    if (!this.isSupported || !this.canvas) return;

    let w = 480;
    let h = 480;

    if (typeof this.canvas.getBoundingClientRect === 'function') {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        w = rect.width;
        h = rect.height;
      }
    } else if (this.canvas.clientWidth && this.canvas.clientHeight) {
      w = this.canvas.clientWidth;
      h = this.canvas.clientHeight;
    } else if (this.canvas.width && this.canvas.height) {
      w = this.canvas.width;
      h = this.canvas.height;
    }

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.width = w;
    this.height = h;
    this.dpr = dpr;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);

    if (this.ctx && typeof this.ctx.setTransform === 'function') {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /**
   * Obtains a particle instance from pool or instantiates new.
   * @private
   * @returns {Particle}
   */
  _obtainParticle() {
    return this.pool.pop() || new Particle();
  }

  /**
   * Emits spark burst at (x, y) with color coordination.
   * @param {number} x - Center X in CSS pixels
   * @param {number} y - Center Y in CSS pixels
   * @param {string} [color='#edcf72'] - Particle color hex
   * @param {number} [count=20] - Number of spark particles
   */
  emitMergeSparks(x, y, color = '#edcf72', count = DEFAULT_SPARK_COUNT) {
    if (!this.isSupported) return;

    const resolvedColor = TILE_PARTICLE_COLORS[color] || color;
    const clampedCount = Math.max(5, Math.min(50, count));

    for (let i = 0; i < clampedCount; i++) {
      const p = this._obtainParticle();
      const angle = (Math.PI * 2 * i) / clampedCount + (Math.random() - 0.5) * (Math.PI / clampedCount);
      const speed = 2.8 + Math.random() * 4.4;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 0.75;
      const gravity = 0.16;
      const drag = 0.958;
      const size = 2.5 + Math.random() * 2.5;
      const alphaDecay = 0.026 + Math.random() * 0.016;

      // 20% sparkling white accent core
      const sparkColor = Math.random() < 0.2 ? '#ffffff' : resolvedColor;

      p.initSpark(x, y, sparkColor, size, vx, vy, gravity, drag, alphaDecay);
      this.activeParticles.push(p);
    }

    this._startLoop();
  }

  /**
   * Emits celebratory multi-color confetti fountain from bottom of screen.
   * @param {Object} [options={}]
   */
  emitVictoryConfetti(options = {}) {
    if (!this.isSupported) return;

    const count = options.count || 100;
    const colors = options.colors || CONFETTI_PALETTE;

    for (let i = 0; i < count; i++) {
      const p = this._obtainParticle();
      const x = this.width * (0.15 + Math.random() * 0.7);
      const y = this.height;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const width = 6 + Math.random() * 4;
      const height = 10 + Math.random() * 6;
      const vx = (Math.random() - 0.5) * 11;
      const vy = -8.5 - Math.random() * 5.5;
      const gravity = 0.22;
      const drag = 0.984;
      const alphaDecay = 0.009 + Math.random() * 0.007;
      const vRot = (Math.random() - 0.5) * 0.2;
      const wobbleSpeed = 0.08 + Math.random() * 0.1;

      p.initConfetti(x, y, color, width, height, vx, vy, gravity, drag, alphaDecay, vRot, wobbleSpeed);
      this.activeParticles.push(p);
    }

    this._startLoop();
  }

  /**
   * Starts RAF loop if not already running.
   * @private
   */
  _startLoop() {
    if (!this.isRunning && this.activeParticles.length > 0) {
      this.isRunning = true;
      if (typeof requestAnimationFrame !== 'undefined') {
        this.rafId = requestAnimationFrame(this._tick);
      } else {
        this.rafId = setTimeout(this._tick, 16);
      }
    }
  }

  /**
   * Animation frame tick with Euler physics step and auto-pause.
   * @private
   */
  _tick() {
    if (!this.isRunning) return;

    this.update();
    this.render();

    // Auto-pause RAF when active particles are exhausted
    if (this.activeParticles.length === 0) {
      this.isRunning = false;
      this.rafId = null;
      this.clearCanvas();
      return;
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this._tick);
    } else {
      this.rafId = setTimeout(this._tick, 16);
    }
  }

  /**
   * Updates all active particles and recycles dead particles into pool.
   */
  update() {
    let writeIdx = 0;
    for (let i = 0; i < this.activeParticles.length; i++) {
      const p = this.activeParticles[i];
      p.update();
      if (p.isAlive(this.width, this.height)) {
        this.activeParticles[writeIdx++] = p;
      } else {
        if (this.pool.length < this.maxPoolSize) {
          p.reset();
          this.pool.push(p);
        }
      }
    }
    this.activeParticles.length = writeIdx;
  }

  /**
   * Renders active particles to 2D context.
   */
  render() {
    if (!this.ctx) return;
    this.clearCanvas();
    for (let i = 0; i < this.activeParticles.length; i++) {
      this.activeParticles[i].render(this.ctx);
    }
  }

  /**
   * Clears entire canvas area.
   */
  clearCanvas() {
    if (this.ctx && typeof this.ctx.clearRect === 'function') {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  /**
   * Stops loop and recycles all active particles immediately.
   */
  clear() {
    if (this.rafId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId);
      }
      this.rafId = null;
    }
    this.isRunning = false;

    for (let i = 0; i < this.activeParticles.length; i++) {
      if (this.pool.length < this.maxPoolSize) {
        this.activeParticles[i].reset();
        this.pool.push(this.activeParticles[i]);
      }
    }
    this.activeParticles = [];
    this.clearCanvas();
  }

  /**
   * Destroys engine and unbinds listeners.
   */
  destroy() {
    this.clear();
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.resize);
    }
  }
}
