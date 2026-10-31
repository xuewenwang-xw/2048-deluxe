/**
 * @file juice.js
 * Tactical Feedback & Juice Subsystem for 2048 Deluxe.
 * Provides hardware-accelerated screen micro-shake and dynamic floating combo badges.
 * Safe for headless environments (Node.js).
 */

export const SHAKE_INTENSITY = Object.freeze({
  LIGHT: 1,   // 512 merge
  MEDIUM: 2,  // 1024 merge
  HEAVY: 3    // 2048+ merge / victory
});

export const SHAKE_CONFIG = Object.freeze({
  1: { className: 'shake-light', duration: 120 },
  2: { className: 'shake-medium', duration: 140 },
  3: { className: 'shake-heavy', duration: 180 }
});

export class JuiceSystem {
  /**
   * @param {Object} [options={}]
   */
  constructor(options = {}) {
    const resolveEl = (opt, defaultId, defaultSelector) => {
      if (typeof opt === 'string') {
        return (typeof document !== 'undefined' && typeof document.querySelector === 'function')
          ? document.querySelector(opt)
          : null;
      }
      if (opt) return opt;
      if (typeof document !== 'undefined') {
        if (defaultId && typeof document.getElementById === 'function') {
          const byId = document.getElementById(defaultId);
          if (byId) return byId;
        }
        if (defaultSelector && typeof document.querySelector === 'function') {
          return document.querySelector(defaultSelector);
        }
      }
      return null;
    };

    this.container = resolveEl(options.container, 'game-container', '.game-container');
    this.floatingContainer = resolveEl(options.floatingContainer, 'floating-juice-container', '.floating-juice-container');
    this.shakeTimer = null;
    this.isSupported = typeof document !== 'undefined';
  }

  /**
   * Initializes or updates container element references.
   * @param {Object} elements
   */
  init(elements = {}) {
    if (elements.container) this.container = elements.container;
    if (elements.floatingContainer) this.floatingContainer = elements.floatingContainer;
  }

  /**
   * Triggers hardware-accelerated micro-shake on the game board.
   * @param {number} [intensity=1] - 1 (Light), 2 (Medium), 3 (Heavy)
   */
  triggerScreenShake(intensity = 1) {
    if (!this.container || !this.container.classList) return;

    const clampedIntensity = Math.max(1, Math.min(3, Math.floor(intensity)));
    const config = SHAKE_CONFIG[clampedIntensity] || SHAKE_CONFIG[1];

    if (this.shakeTimer) {
      clearTimeout(this.shakeTimer);
      this.shakeTimer = null;
    }

    // Clean up any existing shake classes
    this.container.classList.remove('shake-light', 'shake-medium', 'shake-heavy');

    // Force layout reflow to restart CSS keyframe animation if supported
    if (typeof this.container.offsetWidth === 'number') {
      void this.container.offsetWidth;
    }

    this.container.classList.add(config.className);

    this.shakeTimer = setTimeout(() => {
      if (this.container && this.container.classList) {
        this.container.classList.remove(config.className);
      }
      this.shakeTimer = null;
    }, config.duration);
  }

  /**
   * Spawns a floating score or combo badge drifting upwards with CSS fade.
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @param {string} text - Badge text (e.g. '+64', '+128 COMBO x2!')
   * @param {Object} [options={}]
   * @param {'normal'|'combo'|'mega'} [options.tier='normal']
   * @param {number} [options.duration=650]
   * @returns {HTMLElement|null} The created badge element
   */
  spawnFloatingScore(x, y, text, options = {}) {
    if (!this.floatingContainer || typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return null;
    }

    const tier = options.tier || 'normal';
    const badge = document.createElement('div');
    badge.className = `floating-badge badge-${tier}`;
    if (badge.classList && typeof badge.classList.add === 'function') {
      badge.classList.add('floating-badge', `badge-${tier}`);
    }
    badge.textContent = text;

    if (badge.style && typeof badge.style.setProperty === 'function') {
      badge.style.setProperty('left', `${x}px`);
      badge.style.setProperty('top', `${y}px`);
    } else if (badge.style) {
      badge.style.left = `${x}px`;
      badge.style.top = `${y}px`;
    }

    this.floatingContainer.appendChild(badge);

    const duration = options.duration || 650;
    setTimeout(() => {
      if (badge.parentNode && typeof badge.parentNode.removeChild === 'function') {
        badge.parentNode.removeChild(badge);
      }
    }, duration);

    return badge;
  }

  /**
   * Spawns a floating badge based on grid cell coordinates (row, col).
   * @param {number} r - Row index
   * @param {number} c - Column index
   * @param {string} text - Badge text
   * @param {Object} [options={}]
   */
  spawnBadgeAtCell(r, c, text, options = {}) {
    const coords = this.getCellCoordinates(r, c);
    return this.spawnFloatingScore(coords.x, coords.y, text, options);
  }

  /**
   * Resolves pixel center coordinates of a grid cell.
   * @param {number} r
   * @param {number} c
   * @param {number} [gridSize=4]
   * @returns {{ x: number, y: number }}
   */
  getCellCoordinates(r, c, gridSize = 4) {
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      const cell = document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
      if (cell && cell.offsetLeft !== undefined && cell.offsetWidth !== undefined && cell.offsetWidth > 0) {
        return {
          x: cell.offsetLeft + cell.offsetWidth / 2,
          y: cell.offsetTop + cell.offsetHeight / 2
        };
      }
    }

    // Mathematical fallback based on container width or 480px standard
    const containerWidth = (this.container && this.container.clientWidth) || 480;
    const padding = 14;
    const gap = 14;
    const cellSize = (containerWidth - (padding * 2) - (gap * (gridSize - 1))) / gridSize;
    const x = padding + c * (cellSize + gap) + cellSize / 2;
    const y = padding + r * (cellSize + gap) + cellSize / 2;
    return { x, y };
  }

  /**
   * Dispatches appropriate juice effects for a move result.
   * @param {Object} moveResult - MoveResult from engine.move()
   * @param {Array<{ to: { r: number, c: number }, value: number }>} merges
   */
  applyMoveJuice(moveResult, merges = []) {
    if (!moveResult || !moveResult.moved) return;

    // 1. Screen micro-shake on high merges
    if (moveResult.isFirstWin || moveResult.highestMerge >= 2048) {
      this.triggerScreenShake(SHAKE_INTENSITY.HEAVY);
    } else if (moveResult.highestMerge >= 1024) {
      this.triggerScreenShake(SHAKE_INTENSITY.MEDIUM);
    } else if (moveResult.highestMerge >= 512) {
      this.triggerScreenShake(SHAKE_INTENSITY.LIGHT);
    }

    // 2. Floating combo badges
    if (moveResult.combos >= 2 && merges.length > 0) {
      const highest = merges.reduce((max, m) => m.value > max.value ? m : max, merges[0]);
      const tier = moveResult.combos >= 3 || moveResult.highestMerge >= 1024 ? 'mega' : 'combo';
      const text = `+${moveResult.scoreGained} COMBO x${moveResult.combos}!`;
      this.spawnBadgeAtCell(highest.to.r, highest.to.c, text, { tier });
    } else if (moveResult.scoreGained >= 128 && merges.length > 0) {
      const highest = merges.reduce((max, m) => m.value > max.value ? m : max, merges[0]);
      this.spawnBadgeAtCell(highest.to.r, highest.to.c, `+${moveResult.scoreGained}`, { tier: 'normal' });
    }
  }

  /**
   * Cleans up all pending timers and active badges.
   */
  destroy() {
    if (this.shakeTimer) {
      clearTimeout(this.shakeTimer);
      this.shakeTimer = null;
    }
    if (this.container && this.container.classList) {
      this.container.classList.remove('shake-light', 'shake-medium', 'shake-heavy');
    }
    if (this.floatingContainer) {
      if (typeof this.floatingContainer.innerHTML !== 'undefined') {
        this.floatingContainer.innerHTML = '';
      }
      if (this.floatingContainer.children && Array.isArray(this.floatingContainer.children)) {
        this.floatingContainer.children.length = 0;
      }
    }
  }
}
