/**
 * @file input.js
 * Multi-modal user input controller for 2048 Deluxe.
 * Handles Keyboard, Touch/Swipe gestures, Virtual On-Screen D-Pad, and UI Action buttons.
 */

import { Direction } from '../engine/types.js';

export const SWIPE_THRESHOLD_PX = 30;
export const MAX_SWIPE_TIME_MS = 1000;
export const DEFAULT_DEBOUNCE_MS = 0;

export class InputController {
  /**
   * @param {Object} [options={}]
   * @param {HTMLElement|Document} [options.targetElement=document]
   * @param {number} [options.swipeThreshold=30]
   * @param {number} [options.debounceMs=80]
   */
  constructor(options = {}) {
    this.targetElement = options.targetElement || (typeof document !== 'undefined' ? document : null);
    this.swipeThreshold = options.swipeThreshold || SWIPE_THRESHOLD_PX;
    this.debounceMs = options.debounceMs !== undefined ? options.debounceMs : DEFAULT_DEBOUNCE_MS;

    this.enabled = true;
    this._locked = false;
    this._lockTimer = null;
    this._lastInputTime = 0;

    // Callbacks registry
    this._callbacks = {
      move: [],
      undo: [],
      restart: [],
      keepGoing: [],
      themeToggle: [],
      audioToggle: [],
      volumeChange: []
    };

    // Touch gesture tracking state
    this._touchState = {
      tracking: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      touchId: null
    };

    // Bound event handlers for clean removal
    this._boundKeyDown = this._handleKeyDown.bind(this);
    this._boundTouchStart = this._handleTouchStart.bind(this);
    this._boundTouchMove = this._handleTouchMove.bind(this);
    this._boundTouchEnd = this._handleTouchEnd.bind(this);
    this._boundTouchCancel = this._handleTouchCancel.bind(this);

    // Mouse drag gesture tracking
    this._mouseState = {
      tracking: false,
      startX: 0,
      startY: 0,
      startTime: 0
    };
    this._boundMouseDown = this._handleMouseDown.bind(this);
    this._boundMouseMove = this._handleMouseMove.bind(this);
    this._boundMouseUp = this._handleMouseUp.bind(this);
    this._boundCompositionEnd = this._handleCompositionEnd.bind(this);
  }

  /**
   * Subscribes a listener to directional movement events.
   * @param {(direction: string) => void} fn
   * @returns {() => void} unsubscribe function
   */
  onMove(fn) {
    this._callbacks.move.push(fn);
    return () => {
      this._callbacks.move = this._callbacks.move.filter(cb => cb !== fn);
    };
  }

  /**
   * Subscribes a listener to undo action events.
   * @param {() => void} fn
   * @returns {() => void} unsubscribe function
   */
  onUndo(fn) {
    this._callbacks.undo.push(fn);
    return () => {
      this._callbacks.undo = this._callbacks.undo.filter(cb => cb !== fn);
    };
  }

  /**
   * Subscribes a listener to restart action events.
   * @param {() => void} fn
   * @returns {() => void} unsubscribe function
   */
  onRestart(fn) {
    this._callbacks.restart.push(fn);
    return () => {
      this._callbacks.restart = this._callbacks.restart.filter(cb => cb !== fn);
    };
  }

  /**
   * Subscribes a listener to keep going action events.
   * @param {() => void} fn
   * @returns {() => void} unsubscribe function
   */
  onKeepGoing(fn) {
    this._callbacks.keepGoing.push(fn);
    return () => {
      this._callbacks.keepGoing = this._callbacks.keepGoing.filter(cb => cb !== fn);
    };
  }

  /**
   * Subscribes a listener to theme toggle action events.
   * @param {() => void} fn
   * @returns {() => void} unsubscribe function
   */
  onThemeToggle(fn) {
    this._callbacks.themeToggle.push(fn);
    return () => {
      this._callbacks.themeToggle = this._callbacks.themeToggle.filter(cb => cb !== fn);
    };
  }

  /**
   * Subscribes a listener to audio toggle action events.
   * @param {() => void} fn
   * @returns {() => void} unsubscribe function
   */
  onAudioToggle(fn) {
    this._callbacks.audioToggle.push(fn);
    return () => {
      this._callbacks.audioToggle = this._callbacks.audioToggle.filter(cb => cb !== fn);
    };
  }

  /**
   * Subscribes a listener to volume change events.
   * @param {(volume: number) => void} fn
   * @returns {() => void} unsubscribe function
   */
  onVolumeChange(fn) {
    this._callbacks.volumeChange.push(fn);
    return () => {
      this._callbacks.volumeChange = this._callbacks.volumeChange.filter(cb => cb !== fn);
    };
  }

  /**
   * Locks input handling (e.g. while tile animation is executing).
   * Includes a watchdog safety timer to prevent any persistent locked state.
   * @param {number} [timeoutMs=300]
   */
  lock(timeoutMs = 300) {
    this._locked = true;
    if (this._lockTimer) clearTimeout(this._lockTimer);
    if (typeof setTimeout !== 'undefined' && timeoutMs > 0) {
      this._lockTimer = setTimeout(() => {
        this._locked = false;
        this._lockTimer = null;
      }, timeoutMs);
    }
  }

  /**
   * Unlocks input handling.
   */
  unlock() {
    this._locked = false;
    if (this._lockTimer) {
      clearTimeout(this._lockTimer);
      this._lockTimer = null;
    }
  }

  /**
   * Checks whether input is currently locked or disabled.
   * @returns {boolean}
   */
  isLocked() {
    return !this.enabled || this._locked;
  }

  /**
   * Attaches listeners to the DOM target and action buttons.
   * @param {HTMLElement|Document} [target]
   */
  bind(target) {
    if (target) this.targetElement = target;
    if (!this.targetElement || typeof window === 'undefined') return;

    window.addEventListener('keydown', this._boundKeyDown, { capture: true, passive: false });
    window.addEventListener('compositionend', this._boundCompositionEnd, { capture: true });

    const touchRoot = this.targetElement.getElementById
      ? (this.targetElement.getElementById('game-container') || this.targetElement.body || this.targetElement)
      : this.targetElement;

    if (touchRoot && touchRoot.addEventListener) {
      touchRoot.addEventListener('touchstart', this._boundTouchStart, { passive: true });
      touchRoot.addEventListener('touchmove', this._boundTouchMove, { passive: false });
      touchRoot.addEventListener('touchend', this._boundTouchEnd, { passive: true });
      touchRoot.addEventListener('touchcancel', this._boundTouchCancel, { passive: true });
      touchRoot.addEventListener('mousedown', (e) => {
        if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
          if (typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
        }
        this._boundMouseDown(e);
      });
    }
    window.addEventListener('mousemove', this._boundMouseMove);
    window.addEventListener('mouseup', this._boundMouseUp);

    this._bindButtonListeners();
  }

  /**
   * Unbinds all listeners and cleans up event handlers.
   */
  unbind() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._boundKeyDown, { capture: true });
      window.removeEventListener('compositionend', this._boundCompositionEnd, { capture: true });
      window.removeEventListener('mousemove', this._boundMouseMove);
      window.removeEventListener('mouseup', this._boundMouseUp);
    }
    const touchRoot = this.targetElement && this.targetElement.getElementById
      ? (this.targetElement.getElementById('game-container') || this.targetElement.body || this.targetElement)
      : this.targetElement;

    if (touchRoot && touchRoot.removeEventListener) {
      touchRoot.removeEventListener('touchstart', this._boundTouchStart);
      touchRoot.removeEventListener('touchmove', this._boundTouchMove);
      touchRoot.removeEventListener('touchend', this._boundTouchEnd);
      touchRoot.removeEventListener('touchcancel', this._boundTouchCancel);
      touchRoot.removeEventListener('mousedown', this._boundMouseDown);
    }
  }

  /**
   * Destroys controller instance and clears callbacks.
   */
  destroy() {
    this.unbind();
    if (this._lockTimer) {
      clearTimeout(this._lockTimer);
      this._lockTimer = null;
    }
    this._callbacks = { move: [], undo: [], restart: [], keepGoing: [], themeToggle: [], audioToggle: [], volumeChange: [] };
  }

  /**
   * Dispatches a directional move if unlocked and outside debounce window.
   * @param {string} direction
   */
  dispatchMove(direction) {
    if (this.isLocked()) return;

    const now = Date.now();
    if (now - this._lastInputTime < this.debounceMs) {
      return;
    }
    this._lastInputTime = now;

    // Visual press feedback on on-screen D-Pad buttons
    if (typeof document !== 'undefined') {
      const btnMap = {
        [Direction.UP]: 'dpad-up',
        [Direction.DOWN]: 'dpad-down',
        [Direction.LEFT]: 'dpad-left',
        [Direction.RIGHT]: 'dpad-right'
      };
      const btnId = btnMap[direction];
      if (btnId) {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.classList.add('active-press');
          setTimeout(() => btn.classList.remove('active-press'), 120);
        }
      }
    }

    for (const fn of this._callbacks.move) {
      try {
        fn(direction);
      } catch {
        // Suppress callback errors
      }
    }
  }

  dispatchUndo() {
    if (!this.enabled) return;
    for (const fn of this._callbacks.undo) {
      try { fn(); } catch {}
    }
  }

  dispatchRestart() {
    if (!this.enabled) return;
    for (const fn of this._callbacks.restart) {
      try { fn(); } catch {}
    }
  }

  dispatchKeepGoing() {
    if (!this.enabled) return;
    for (const fn of this._callbacks.keepGoing) {
      try { fn(); } catch {}
    }
  }

  /**
   * Dispatches volume adjustment event.
   * @param {number} vol - Volume level [0.0, 1.0]
   */
  dispatchVolumeChange(vol) {
    if (!this.enabled) return;
    for (const fn of this._callbacks.volumeChange) {
      try { fn(vol); } catch {}
    }
  }

  /**
   * Internal keyboard event listener.
   * @param {KeyboardEvent|Object} e
   * @private
   */
  _handleKeyDown(e) {
    if (!this.enabled) return;

    // Ignore input if user is typing in genuine form text fields
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const target = e.target;

    const isTextEditable = (el) => {
      if (!el) return false;
      const tag = (el.tagName || '').toUpperCase();
      if (tag === 'TEXTAREA' || el.isContentEditable) return true;
      if (tag === 'INPUT') {
        const type = (el.type || 'text').toLowerCase();
        // Range slider, buttons, checkboxes, radio are not text editing controls
        return type !== 'range' && type !== 'button' && type !== 'checkbox' && type !== 'radio' && type !== 'submit';
      }
      return false;
    };

    if (isTextEditable(active) || isTextEditable(target)) {
      return;
    }

    // Release focus from non-text UI controls (range slider, select, buttons) so game inputs take precedence
    if (active && active !== (typeof document !== 'undefined' ? document.body : null) && typeof active.blur === 'function') {
      active.blur();
    }

    const key = (e.key || '').toLowerCase();
    const code = e.code || '';
    const keyCode = e.keyCode || e.which || 0;

    // Undo shortcut: Ctrl+Z / Meta+Z or single key 'u' / 'U'
    if (((e.ctrlKey || e.metaKey) && key === 'z') || (!e.ctrlKey && !e.metaKey && (key === 'u' || code === 'KeyU' || keyCode === 85))) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      this.dispatchUndo();
      return;
    }

    // Restart shortcut: 'r' / 'R' without modifier keys
    if (key === 'r' || code === 'KeyR' || keyCode === 82) {
      if (!e.ctrlKey && !e.metaKey) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        this.dispatchRestart();
        return;
      }
    }

    // Audio toggle shortcut: 'm' / 'M' without modifier keys
    if (key === 'm' || code === 'KeyM' || keyCode === 77) {
      if (!e.ctrlKey && !e.metaKey) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        for (const fn of this._callbacks.audioToggle) {
          try { fn(); } catch {}
        }
        return;
      }
    }

    // Modal dismiss / Keep going: Escape or Enter
    if (key === 'escape' || key === 'enter' || code === 'Escape' || code === 'Enter' || keyCode === 27 || keyCode === 13) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      this.dispatchKeepGoing();
      return;
    }

    // Directional Mappings (Arrow keys, WASD, Vim keys)
    let direction = null;

    if (key === 'arrowup' || code === 'KeyW' || key === 'w' || key === 'k' || code === 'ArrowUp' || keyCode === 38 || keyCode === 87) {
      direction = Direction.UP;
    } else if (key === 'arrowdown' || code === 'KeyS' || key === 's' || key === 'j' || code === 'ArrowDown' || keyCode === 40 || keyCode === 83) {
      direction = Direction.DOWN;
    } else if (key === 'arrowleft' || code === 'KeyA' || key === 'a' || key === 'h' || code === 'ArrowLeft' || keyCode === 37 || keyCode === 65) {
      direction = Direction.LEFT;
    } else if (key === 'arrowright' || code === 'KeyD' || key === 'd' || key === 'l' || code === 'ArrowRight' || keyCode === 39 || keyCode === 68) {
      direction = Direction.RIGHT;
    }

    if (direction) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      this.dispatchMove(direction);
    }
  }

  /**
   * Internal compositionend listener to capture IME committed letters (e.g. Chinese/Japanese IME).
   * @param {CompositionEvent|Object} e
   * @private
   */
  _handleCompositionEnd(e) {
    if (!this.enabled) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active && (active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

    const data = (e.data || '').toLowerCase();
    if (data === 'w') {
      this.dispatchMove(Direction.UP);
    } else if (data === 's') {
      this.dispatchMove(Direction.DOWN);
    } else if (data === 'a' || data === '啊') {
      this.dispatchMove(Direction.LEFT);
    } else if (data === 'd' || data === '的') {
      this.dispatchMove(Direction.RIGHT);
    }
  }

  /**
   * Internal touchstart listener.
   * @param {TouchEvent|Object} e
   * @private
   */
  _handleTouchStart(e) {
    if (!e.touches || e.touches.length !== 1) {
      this._touchState.tracking = false;
      return;
    }
    const touch = e.touches[0];
    this._touchState.tracking = true;
    this._touchState.startX = touch.clientX;
    this._touchState.startY = touch.clientY;
    this._touchState.startTime = Date.now();
    this._touchState.touchId = touch.identifier;
  }

  /**
   * Internal touchmove listener.
   * @param {TouchEvent|Object} e
   * @private
   */
  _handleTouchMove(e) {
    if (!this._touchState.tracking) return;
    if (e.cancelable && typeof e.preventDefault === 'function') {
      e.preventDefault(); // Stop viewport bounce / scroll while swiping
    }
  }

  /**
   * Internal touchend listener.
   * @param {TouchEvent|Object} e
   * @private
   */
  _handleTouchEnd(e) {
    if (!this._touchState.tracking) return;
    this._touchState.tracking = false;

    if (!e.changedTouches || e.changedTouches.length === 0) return;

    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this._touchState.touchId) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (!touch && e.changedTouches.length === 1) {
      touch = e.changedTouches[0];
    }
    if (!touch) return;

    const deltaX = touch.clientX - this._touchState.startX;
    const deltaY = touch.clientY - this._touchState.startY;
    const duration = Date.now() - this._touchState.startTime;

    if (duration > MAX_SWIPE_TIME_MS) return;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < this.swipeThreshold) return;

    let direction = null;
    if (absX >= absY) {
      direction = deltaX > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      direction = deltaY > 0 ? Direction.DOWN : Direction.UP;
    }

    if (direction) {
      this.dispatchMove(direction);
    }
  }

  /**
   * Internal touchcancel listener.
   * @private
   */
  _handleTouchCancel() {
    this._touchState.tracking = false;
  }

  /**
   * Internal mousedown listener for desktop mouse dragging on game container.
   * @param {MouseEvent} e
   * @private
   */
  _handleMouseDown(e) {
    if (e.button !== 0) return; // Left mouse button only
    this._mouseState.tracking = true;
    this._mouseState.startX = e.clientX;
    this._mouseState.startY = e.clientY;
    this._mouseState.startTime = Date.now();
  }

  /**
   * Internal mousemove listener.
   * @param {MouseEvent} e
   * @private
   */
  _handleMouseMove(e) {
    if (!this._mouseState.tracking) return;
    if (e.cancelable && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  }

  /**
   * Internal mouseup listener.
   * @param {MouseEvent} e
   * @private
   */
  _handleMouseUp(e) {
    if (!this._mouseState.tracking) return;
    this._mouseState.tracking = false;

    const deltaX = e.clientX - this._mouseState.startX;
    const deltaY = e.clientY - this._mouseState.startY;
    const duration = Date.now() - this._mouseState.startTime;

    if (duration > MAX_SWIPE_TIME_MS) return;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < this.swipeThreshold) return;

    let direction = null;
    if (absX >= absY) {
      direction = deltaX > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      direction = deltaY > 0 ? Direction.DOWN : Direction.UP;
    }

    if (direction) {
      this.dispatchMove(direction);
    }
  }

  /**
   * Attaches click handlers to virtual D-Pad and action buttons.
   * @private
   */
  _bindButtonListeners() {
    const doc = this.targetElement && this.targetElement.getElementById
      ? this.targetElement
      : (typeof document !== 'undefined' ? document : null);
    if (!doc) return;

    const bindClick = (id, handler) => {
      const el = doc.getElementById(id);
      if (el && typeof el.addEventListener === 'function') {
        el.addEventListener('click', (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof el.blur === 'function') el.blur();
          handler();
        });
      }
    };

    // Virtual On-Screen D-Pad
    bindClick('dpad-up', () => this.dispatchMove(Direction.UP));
    bindClick('dpad-down', () => this.dispatchMove(Direction.DOWN));
    bindClick('dpad-left', () => this.dispatchMove(Direction.LEFT));
    bindClick('dpad-right', () => this.dispatchMove(Direction.RIGHT));

    // Action buttons
    bindClick('btn-restart', () => this.dispatchRestart());
    bindClick('btn-try-again', () => this.dispatchRestart());
    bindClick('btn-win-restart', () => this.dispatchRestart());
    bindClick('btn-gameover-restart', () => this.dispatchRestart());
    bindClick('btn-undo', () => this.dispatchUndo());
    bindClick('btn-keep-going', () => this.dispatchKeepGoing());
    bindClick('btn-theme', () => {
      for (const fn of this._callbacks.themeToggle) fn();
    });
    bindClick('btn-audio', () => {
      for (const fn of this._callbacks.audioToggle) fn();
    });
    bindClick('btn-audio-toggle', () => {
      for (const fn of this._callbacks.audioToggle) fn();
    });

    // Volume slider control: dispatch changes & release focus on interaction end
    const volSlider = doc.getElementById('volume-slider');
    if (volSlider && typeof volSlider.addEventListener === 'function') {
      volSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          this.dispatchVolumeChange(val / 100);
        }
      });

      const releaseSliderFocus = () => {
        if (typeof volSlider.blur === 'function') {
          volSlider.blur();
        }
      };
      volSlider.addEventListener('change', releaseSliderFocus);
      volSlider.addEventListener('pointerup', releaseSliderFocus);
      volSlider.addEventListener('mouseup', releaseSliderFocus);
      volSlider.addEventListener('touchend', releaseSliderFocus);
    }

    // Theme selector: release focus after user changes theme
    const themeSelect = doc.getElementById('select-theme');
    if (themeSelect && typeof themeSelect.addEventListener === 'function') {
      themeSelect.addEventListener('change', () => {
        if (typeof themeSelect.blur === 'function') {
          themeSelect.blur();
        }
      });
    }
  }
}
