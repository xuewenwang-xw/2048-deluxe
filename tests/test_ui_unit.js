/**
 * @file test_ui_unit.js
 * Comprehensive Milestone 2 UI & Interaction Verification Suite for 2048 Deluxe.
 * Pure Node.js execution via native node:test and node:assert/strict.
 */

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Direction, GameStatus } from '../src/engine/types.js';
import { GameEngine } from '../src/engine/game_engine.js';

// Subsystems under test
import { GameView, calculateMoveTransitions } from '../src/ui/view.js';
import { InputController, SWIPE_THRESHOLD_PX } from '../src/ui/input.js';
import { ThemeController, THEMES, DEFAULT_THEME, THEME_LIST } from '../src/ui/theme.js';
import { StorageAdapter, InMemoryStorage, STORAGE_KEY_BEST_SCORE, STORAGE_KEY_THEME } from '../src/ui/storage.js';

// =========================================================================
// W3C Lightweight DOM Emulator for Headless Node.js Unit Testing
// =========================================================================

export class MockClassList {
  constructor(el) {
    this._el = el;
    this._classes = new Set();
  }
  add(...names) {
    names.forEach(n => {
      if (n) this._classes.add(n);
    });
    this._sync();
  }
  remove(...names) {
    names.forEach(n => this._classes.delete(n));
    this._sync();
  }
  toggle(name) {
    const res = this._classes.has(name) ? (this._classes.delete(name), false) : (this._classes.add(name), true);
    this._sync();
    return res;
  }
  contains(name) {
    return this._classes.has(name);
  }
  toString() {
    return Array.from(this._classes).join(' ');
  }
  _sync() {
    if (this._el) {
      this._el._className = this.toString();
    }
  }
}

export class MockStyle {
  constructor() {
    this.properties = {};
  }
  setProperty(key, val) {
    this.properties[key] = String(val);
  }
  getPropertyValue(key) {
    return this.properties[key] || '';
  }
}

export class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this._attributes = new Map();
    this._listeners = new Map();
    this.style = new MockStyle();
    this.dataset = {};
    this._className = '';
    this.classList = new MockClassList(this);
    this.textContent = '';
    this.id = '';
    this.disabled = false;
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = val || '';
    this.classList._classes = new Set(this._className.split(/\s+/).filter(Boolean));
  }

  setAttribute(k, v) {
    this._attributes.set(k, String(v));
    if (k.startsWith('data-')) {
      const prop = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[prop] = String(v);
    }
  }

  getAttribute(k) {
    return this._attributes.get(k) ?? null;
  }

  hasAttribute(k) {
    return this._attributes.has(k);
  }

  removeAttribute(k) {
    this._attributes.delete(k);
    if (k.startsWith('data-')) {
      const prop = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[prop];
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      child.parentNode = null;
      this.children.splice(idx, 1);
      return child;
    }
    throw new Error('NotFoundError: child node not found');
  }

  set innerHTML(val) {
    if (val === '') {
      this.children.forEach(c => { c.parentNode = null; });
      this.children = [];
    }
  }

  querySelector(sel) {
    for (const ch of this.children) {
      if (sel.startsWith('.') && ch.classList.contains(sel.slice(1))) return ch;
      if (sel.startsWith('#') && ch.id === sel.slice(1)) return ch;
      if (ch.tagName.toLowerCase() === sel.toLowerCase()) return ch;
      const sub = ch.querySelector(sel);
      if (sub) return sub;
    }
    return null;
  }

  querySelectorAll(sel) {
    const res = [];
    const traverse = (el) => {
      for (const ch of el.children) {
        if (sel.startsWith('.') && ch.classList.contains(sel.slice(1))) res.push(ch);
        else if (sel.startsWith('#') && ch.id === sel.slice(1)) res.push(ch);
        else if (ch.tagName.toLowerCase() === sel.toLowerCase()) res.push(ch);
        traverse(ch);
      }
    };
    traverse(this);
    return res;
  }

  addEventListener(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(fn);
  }

  removeEventListener(event, fn) {
    if (!this._listeners.has(event)) return;
    this._listeners.set(event, this._listeners.get(event).filter(f => f !== fn));
  }

  dispatchEvent(evt) {
    evt.target = this;
    evt.currentTarget = this;
    const fns = this._listeners.get(evt.type) || [];
    for (const fn of fns) fn(evt);
    return !evt.defaultPrevented;
  }
}

// Ensure global document environment for Node.js
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => new MockElement(tag),
    documentElement: new MockElement('html'),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    activeElement: null
  };
} else {
  if (!globalThis.document.createElement) {
    globalThis.document.createElement = (tag) => new MockElement(tag);
  }
  if (!globalThis.document.documentElement) {
    globalThis.document.documentElement = new MockElement('html');
  }
}

function setupMockEnvironment() {
  const gameContainer = new MockElement('div');
  const gridContainer = new MockElement('div');
  const tileContainer = new MockElement('div');
  const scoreVal = new MockElement('span');
  const bestScoreVal = new MockElement('span');
  const moveCountVal = new MockElement('span');
  const undoBtn = new MockElement('button');
  const modalOverlay = new MockElement('div');
  const modalWin = new MockElement('div');
  const modalGameOver = new MockElement('div');
  const scoreAddition = new MockElement('div');

  modalOverlay.classList.add('hidden');
  modalWin.classList.add('hidden');
  modalGameOver.classList.add('hidden');

  gameContainer.appendChild(gridContainer);
  gameContainer.appendChild(tileContainer);
  gameContainer.appendChild(modalOverlay);
  modalOverlay.appendChild(modalWin);
  modalOverlay.appendChild(modalGameOver);

  return {
    gameContainer,
    gridContainer,
    tileContainer,
    scoreVal,
    bestScoreVal,
    moveCountVal,
    undoBtn,
    modalOverlay,
    modalWin,
    modalGameOver,
    scoreAddition
  };
}

describe('Milestone 2: 2048 Deluxe Graphic UI & Interaction Verification Suite', () => {

  // =========================================================================
  // SUITE 1: Board Presentation & Grid Layout (`GameView`)
  // =========================================================================
  describe('Suite 1: Board Presentation & Grid Layout (`GameView`)', () => {
    let mockDOM, view;

    beforeEach(() => {
      mockDOM = setupMockEnvironment();
      view = new GameView({
        container: mockDOM.gameContainer,
        gridContainer: mockDOM.gridContainer,
        tileContainer: mockDOM.tileContainer,
        scoreVal: mockDOM.scoreVal,
        bestScoreVal: mockDOM.bestScoreVal,
        moveCountVal: mockDOM.moveCountVal,
        undoBtn: mockDOM.undoBtn,
        modalOverlay: mockDOM.modalOverlay,
        modalWin: mockDOM.modalWin,
        modalGameOver: mockDOM.modalGameOver,
        scoreAddition: mockDOM.scoreAddition,
        slideDuration: 0
      });
    });

    it('TC1.1: init(4) creates exactly 16 grid-cell elements with correct row/col attributes', () => {
      view.init(4);
      assert.equal(mockDOM.gridContainer.children.length, 16);
      assert.equal(mockDOM.tileContainer.children.length, 0);

      const cell00 = mockDOM.gridContainer.children[0];
      assert.equal(cell00.className, 'grid-cell');
      assert.equal(cell00.getAttribute('data-row'), '0');
      assert.equal(cell00.getAttribute('data-col'), '0');

      const cell33 = mockDOM.gridContainer.children[15];
      assert.equal(cell33.getAttribute('data-row'), '3');
      assert.equal(cell33.getAttribute('data-col'), '3');
    });

    it('TC1.2: render(initialState) renders exactly 2 initial tiles on the board', () => {
      view.init(4);
      const engine = new GameEngine({ seed: 100 });
      view.render(engine.getState());

      assert.equal(mockDOM.tileContainer.children.length, 2);
      assert.equal(mockDOM.scoreVal.textContent, '0');
      assert.equal(mockDOM.moveCountVal.textContent, '0');
      assert.equal(mockDOM.undoBtn.disabled, true);
    });

    it('TC1.3: HUD metrics dynamically reflect score, highScore, and moveCount', () => {
      view.init(4);
      const customState = {
        size: 4,
        grid: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        score: 1024,
        highScore: 4096,
        moveCount: 42,
        canUndo: true,
        status: GameStatus.PLAYING
      };
      view.render(customState);

      assert.equal(mockDOM.scoreVal.textContent, '1024');
      assert.equal(mockDOM.bestScoreVal.textContent, '4096');
      assert.equal(mockDOM.moveCountVal.textContent, '42');
      assert.equal(mockDOM.undoBtn.disabled, false);
    });

    it('TC1.4: renderMove sliding animation moves existing tiles and updates DOM', () => {
      view.init(4);
      const prevGrid = [
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ];
      // Seed initial tiles
      const tile1 = view.createTileElement(0, 0, 2);
      const tile2 = view.createTileElement(1, 0, 2);
      mockDOM.tileContainer.appendChild(tile1);
      mockDOM.tileContainer.appendChild(tile2);

      const moveResult = {
        moved: true,
        scoreGained: 4,
        highestMerge: 4,
        combos: 1,
        spawnedTile: { r: 3, c: 3, value: 2 },
        status: GameStatus.PLAYING,
        isFirstWin: false
      };

      const postState = {
        size: 4,
        grid: [
          [4, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 2]
        ],
        score: 4,
        highScore: 4,
        moveCount: 1,
        canUndo: true,
        status: GameStatus.PLAYING
      };

      view.renderMove(prevGrid, Direction.UP, moveResult, postState);
      assert.equal(mockDOM.tileContainer.children.length, 2);
      assert.equal(mockDOM.scoreVal.textContent, '4');
    });
  });

  // =========================================================================
  // SUITE 2: Tile Typography, Classes & Positioning (`GameView`)
  // =========================================================================
  describe('Suite 2: Tile Typography, CSS Classes & Transforms', () => {
    let mockDOM, view;

    beforeEach(() => {
      mockDOM = setupMockEnvironment();
      view = new GameView({
        container: mockDOM.gameContainer,
        gridContainer: mockDOM.gridContainer,
        tileContainer: mockDOM.tileContainer,
        scoreVal: mockDOM.scoreVal,
        bestScoreVal: mockDOM.bestScoreVal,
        moveCountVal: mockDOM.moveCountVal,
        undoBtn: mockDOM.undoBtn,
        modalOverlay: mockDOM.modalOverlay,
        modalWin: mockDOM.modalWin,
        modalGameOver: mockDOM.modalGameOver
      });
    });

    it('TC2.1: createTileElement assigns correct CSS classes, data attributes, and innerText', () => {
      const tile = view.createTileElement(1, 2, 2048, true, false);
      assert.ok(tile.classList.contains('tile'));
      assert.ok(tile.classList.contains('tile-2048'));
      assert.ok(tile.classList.contains('tile-pos-1-2'));
      assert.ok(tile.classList.contains('tile-new'));
      assert.equal(tile.getAttribute('data-row'), '1');
      assert.equal(tile.getAttribute('data-col'), '2');
      assert.equal(tile.getAttribute('data-value'), '2048');
      assert.equal(tile.getAttribute('data-length'), '4');

      assert.equal(tile.children.length, 1);
      assert.equal(tile.children[0].className, 'tile-inner');
      assert.equal(tile.children[0].textContent, '2048');
    });

    it('TC2.2: Large tile values (up to 65536) receive correct length attribute for font scaling', () => {
      const tile4 = view.createTileElement(0, 0, 4, false, false);
      assert.equal(tile4.getAttribute('data-length'), '1');

      const tile128 = view.createTileElement(0, 0, 128, false, false);
      assert.equal(tile128.getAttribute('data-length'), '3');

      const tile65536 = view.createTileElement(0, 0, 65536, false, false);
      assert.equal(tile65536.getAttribute('data-length'), '5');
    });

    it('TC2.3: moveTileElement updates position class and CSS custom properties', () => {
      const tile = view.createTileElement(0, 0, 2);
      view.moveTileElement(tile, 2, 3);

      assert.equal(tile.classList.contains('tile-pos-0-0'), false);
      assert.ok(tile.classList.contains('tile-pos-2-3'));
      assert.equal(tile.getAttribute('data-row'), '2');
      assert.equal(tile.getAttribute('data-col'), '3');
      assert.equal(tile.style.getPropertyValue('--r'), '2');
      assert.equal(tile.style.getPropertyValue('--c'), '3');
    });
  });

  // =========================================================================
  // SUITE 3: Modal Dialog Overlays & Invariants (`GameView`)
  // =========================================================================
  describe('Suite 3: Modal Dialog Overlays & Invariants', () => {
    let mockDOM, view;

    beforeEach(() => {
      mockDOM = setupMockEnvironment();
      view = new GameView({
        container: mockDOM.gameContainer,
        gridContainer: mockDOM.gridContainer,
        tileContainer: mockDOM.tileContainer,
        scoreVal: mockDOM.scoreVal,
        bestScoreVal: mockDOM.bestScoreVal,
        moveCountVal: mockDOM.moveCountVal,
        undoBtn: mockDOM.undoBtn,
        modalOverlay: mockDOM.modalOverlay,
        modalWin: mockDOM.modalWin,
        modalGameOver: mockDOM.modalGameOver
      });
      view.init(4);
    });

    it('TC3.1: showWinModal unhides overlay and win modal while keeping game over hidden', () => {
      view.showWinModal();
      assert.equal(mockDOM.modalOverlay.classList.contains('hidden'), false);
      assert.equal(mockDOM.modalWin.classList.contains('hidden'), false);
      assert.equal(mockDOM.modalGameOver.classList.contains('hidden'), true);
    });

    it('TC3.2: showGameOverModal unhides overlay and game over modal while keeping win hidden', () => {
      view.showGameOverModal();
      assert.equal(mockDOM.modalOverlay.classList.contains('hidden'), false);
      assert.equal(mockDOM.modalGameOver.classList.contains('hidden'), false);
      assert.equal(mockDOM.modalWin.classList.contains('hidden'), true);
    });

    it('TC3.3: hideAllModals conceals all modals and backdrop', () => {
      view.showWinModal();
      view.hideAllModals();
      assert.ok(mockDOM.modalOverlay.classList.contains('hidden'));
      assert.ok(mockDOM.modalWin.classList.contains('hidden'));
      assert.ok(mockDOM.modalGameOver.classList.contains('hidden'));
    });
  });

  // =========================================================================
  // SUITE 4: Input Controller Keyboard Normalization (`InputController`)
  // =========================================================================
  describe('Suite 4: Input Controller Keyboard Normalization & Controls', () => {
    let input;

    beforeEach(() => {
      input = new InputController();
    });

    it('TC4.1: Arrow keys map to respective Direction enums and invoke preventDefault', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      const dispatchKey = (key, code) => {
        let prevented = false;
        input._handleKeyDown({
          key,
          code,
          preventDefault: () => { prevented = true; },
          target: { tagName: 'DIV' }
        });
        return prevented;
      };

      assert.equal(dispatchKey('ArrowUp', 'ArrowUp'), true);
      assert.equal(dispatchKey('ArrowDown', 'ArrowDown'), true);
      assert.equal(dispatchKey('ArrowLeft', 'ArrowLeft'), true);
      assert.equal(dispatchKey('ArrowRight', 'ArrowRight'), true);

      assert.deepEqual(moves, [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]);
    });

    it('TC4.2: WASD keys map case-insensitively to respective Direction enums', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      input._handleKeyDown({ key: 'w', code: 'KeyW', preventDefault: () => {}, target: { tagName: 'DIV' } });
      input._handleKeyDown({ key: 'S', code: 'KeyS', preventDefault: () => {}, target: { tagName: 'DIV' } });
      input._handleKeyDown({ key: 'a', code: 'KeyA', preventDefault: () => {}, target: { tagName: 'DIV' } });
      input._handleKeyDown({ key: 'D', code: 'KeyD', preventDefault: () => {}, target: { tagName: 'DIV' } });

      assert.deepEqual(moves, [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]);
    });

    it('TC4.3: Action shortcuts trigger undo, restart, and keepGoing callbacks', () => {
      let undone = false, restarted = false, keptGoing = false;
      input.onUndo(() => { undone = true; });
      input.onRestart(() => { restarted = true; });
      input.onKeepGoing(() => { keptGoing = true; });

      input._handleKeyDown({ key: 'u', code: 'KeyU', preventDefault: () => {}, target: { tagName: 'DIV' } });
      assert.equal(undone, true);

      input._handleKeyDown({ key: 'r', code: 'KeyR', preventDefault: () => {}, target: { tagName: 'DIV' } });
      assert.equal(restarted, true);

      input._handleKeyDown({ key: 'Escape', code: 'Escape', preventDefault: () => {}, target: { tagName: 'DIV' } });
      assert.equal(keptGoing, true);
    });

    it('TC4.4: Inputs are blocked while controller is locked during animation', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      input.lock();
      assert.equal(input.isLocked(), true);

      input._handleKeyDown({ key: 'ArrowUp', code: 'ArrowUp', preventDefault: () => {}, target: { tagName: 'DIV' } });
      assert.equal(moves.length, 0);

      input.unlock();
      assert.equal(input.isLocked(), false);

      input._handleKeyDown({ key: 'ArrowUp', code: 'ArrowUp', preventDefault: () => {}, target: { tagName: 'DIV' } });
      assert.deepEqual(moves, [Direction.UP]);
    });

    it('TC4.5: Unmapped keys do not invoke preventDefault and do not dispatch moves', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));
      let prevented = false;

      input._handleKeyDown({
        key: 'q',
        code: 'KeyQ',
        preventDefault: () => { prevented = true; },
        target: { tagName: 'DIV' }
      });

      assert.equal(prevented, false);
      assert.equal(moves.length, 0);
    });

    it('TC4.6: Inputs originating inside form elements are safely ignored', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      input._handleKeyDown({
        key: 'ArrowUp',
        code: 'ArrowUp',
        preventDefault: () => {},
        target: { tagName: 'INPUT' }
      });

      assert.equal(moves.length, 0);
    });

    it('TC4.7: WASD operates cleanly when volume slider or select has focus without trapping input', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      let blurred = false;
      const mockSlider = {
        tagName: 'INPUT',
        type: 'range',
        blur: () => { blurred = true; }
      };

      input._handleKeyDown({
        key: 'w',
        code: 'KeyW',
        preventDefault: () => {},
        target: mockSlider
      });

      assert.equal(moves.length, 1);
      assert.equal(moves[0], Direction.UP);
    });

    it('TC4.8: WASD operates cleanly when Chinese IME or Process key is active', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      input._handleKeyDown({
        key: 'Process',
        code: 'KeyW',
        keyCode: 229,
        preventDefault: () => {},
        target: { tagName: 'DIV' }
      });

      input._handleKeyDown({
        key: 'Process',
        code: 'KeyA',
        keyCode: 229,
        preventDefault: () => {},
        target: { tagName: 'DIV' }
      });

      assert.deepEqual(moves, [Direction.UP, Direction.LEFT]);
    });
  });

  // =========================================================================
  // SUITE 5: Touch & Swipe Gesture Vector Mathematics (`InputController`)
  // =========================================================================
  describe('Suite 5: Touch & Swipe Vector Mathematics & Thresholding', () => {
    let input;

    beforeEach(() => {
      input = new InputController({ swipeThreshold: 30 });
    });

    const simulateSwipe = (startX, startY, endX, endY, durationMs = 150) => {
      const touchId = 1;
      input._handleTouchStart({
        touches: [{ clientX: startX, clientY: startY, identifier: touchId }]
      });

      const originalDateNow = Date.now;
      Date.now = () => originalDateNow() + durationMs;
      try {
        input._handleTouchEnd({
          changedTouches: [{ clientX: endX, clientY: endY, identifier: touchId }]
        });
      } finally {
        Date.now = originalDateNow;
      }
    };

    it('TC5.1: Dominant horizontal swipe to right triggers Direction.RIGHT', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      simulateSwipe(100, 100, 200, 115);
      assert.deepEqual(moves, [Direction.RIGHT]);
    });

    it('TC5.2: Dominant horizontal swipe to left triggers Direction.LEFT', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      simulateSwipe(200, 100, 80, 100);
      assert.deepEqual(moves, [Direction.LEFT]);
    });

    it('TC5.3: Dominant vertical swipe upwards triggers Direction.UP', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      simulateSwipe(100, 200, 105, 110);
      assert.deepEqual(moves, [Direction.UP]);
    });

    it('TC5.4: Dominant vertical swipe downwards triggers Direction.DOWN', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      simulateSwipe(100, 100, 100, 250);
      assert.deepEqual(moves, [Direction.DOWN]);
    });

    it('TC5.5: Micro-movements below threshold (25px < 30px) are rejected', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      simulateSwipe(100, 100, 125, 105);
      assert.equal(moves.length, 0);
    });

    it('TC5.6: Gestures exceeding maximum swipe duration (1200ms > 1000ms) are discarded', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      simulateSwipe(100, 100, 300, 100, 1200);
      assert.equal(moves.length, 0);
    });

    it('TC5.7: Multi-touch gestures (e.g. pinch) do not trigger swipe moves', () => {
      const moves = [];
      input.onMove(dir => moves.push(dir));

      input._handleTouchStart({
        touches: [
          { clientX: 100, clientY: 100, identifier: 1 },
          { clientX: 200, clientY: 200, identifier: 2 }
        ]
      });

      input._handleTouchEnd({
        changedTouches: [{ clientX: 300, clientY: 100, identifier: 1 }]
      });

      assert.equal(moves.length, 0);
    });
  });

  // =========================================================================
  // SUITE 6: Multi-Theme Switcher & Attribute Reflection (`ThemeController`)
  // =========================================================================
  describe('Suite 6: Multi-Theme Controller & Persistence', () => {
    let mockRoot, storage, theme;

    beforeEach(() => {
      mockRoot = new MockElement('html');
      storage = new StorageAdapter(new InMemoryStorage());
      theme = new ThemeController({
        rootElement: mockRoot,
        storageAdapter: storage,
        defaultTheme: 'cyberpunk'
      });
    });

    it('TC6.1: Initializes with defaultTheme and applies data-theme attribute', () => {
      theme.init();
      assert.equal(mockRoot.getAttribute('data-theme'), 'cyberpunk');
      assert.equal(theme.getCurrentTheme(), 'cyberpunk');
    });

    it('TC6.2: cycleTheme iterates through all 4 themes in designated order', () => {
      theme.init(); // starts at cyberpunk
      assert.equal(theme.cycleTheme(), 'retro');
      assert.equal(mockRoot.getAttribute('data-theme'), 'retro');

      assert.equal(theme.cycleTheme(), 'dark');
      assert.equal(mockRoot.getAttribute('data-theme'), 'dark');

      assert.equal(theme.cycleTheme(), 'pastel');
      assert.equal(mockRoot.getAttribute('data-theme'), 'pastel');

      assert.equal(theme.cycleTheme(), 'cyberpunk');
      assert.equal(mockRoot.getAttribute('data-theme'), 'cyberpunk');
    });

    it('TC6.3: setTheme persists selection and ignores invalid theme names', () => {
      theme.init();
      const ok = theme.setTheme('dark');
      assert.equal(ok, true);
      assert.equal(storage.getTheme(), 'dark');

      const bad = theme.setTheme('invalid_neon');
      assert.equal(bad, false);
      assert.equal(theme.getCurrentTheme(), 'dark');
    });

    it('TC6.4: getAvailableThemes returns all 4 supported themes', () => {
      const themes = theme.getAvailableThemes();
      assert.deepEqual(themes, ['cyberpunk', 'retro', 'dark', 'pastel']);
    });
  });

  // =========================================================================
  // SUITE 7: Storage Adapter & Quota Resilience (`StorageAdapter`)
  // =========================================================================
  describe('Suite 7: Storage Adapter & Fallback Resilience', () => {
    it('TC7.1: Best score roundtrip preserves high scores and ignores lesser scores', () => {
      const storage = new StorageAdapter(new InMemoryStorage());
      assert.equal(storage.getBestScore(), 0);

      assert.equal(storage.saveBestScore(2048), true);
      assert.equal(storage.getBestScore(), 2048);

      storage.saveBestScore(512);
      assert.equal(storage.getBestScore(), 2048);
    });

    it('TC7.2: Active session JSON serialization roundtrip survives reload', () => {
      const storage = new StorageAdapter(new InMemoryStorage());
      const engine = new GameEngine({ seed: 777 });
      engine.move(Direction.LEFT);

      const serialized = engine.serialize();
      storage.saveActiveGame(serialized);

      const loaded = storage.loadActiveGame();
      assert.equal(loaded, serialized);

      const restoredEngine = new GameEngine();
      assert.equal(restoredEngine.deserialize(loaded), true);
      assert.equal(restoredEngine.score, engine.score);
    });

    it('TC7.3: Gracefully falls back to InMemoryStorage when localStorage throws QuotaExceededError', () => {
      const faultyStorage = {
        getItem: () => null,
        setItem: () => {
          const err = new Error('The quota has been exceeded.');
          err.name = 'QuotaExceededError';
          throw err;
        },
        removeItem: () => {}
      };

      const adapter = new StorageAdapter(faultyStorage);
      const res = adapter.saveBestScore(9999);
      assert.equal(res, false);
      assert.equal(adapter.getBestScore(), 0);
    });

    it('TC7.4: Audio muted preference persists correctly', () => {
      const storage = new StorageAdapter(new InMemoryStorage());
      assert.equal(storage.getAudioMuted(), false);

      storage.saveAudioMuted(true);
      assert.equal(storage.getAudioMuted(), true);

      storage.saveAudioMuted(false);
      assert.equal(storage.getAudioMuted(), false);
    });

    it('TC7.5: Corrupted or negative best score defaults safely to 0', () => {
      const storage = new StorageAdapter(new InMemoryStorage());
      storage.setItem(STORAGE_KEY_BEST_SCORE, 'corrupted_string');
      assert.equal(storage.getBestScore(), 0);

      storage.setItem(STORAGE_KEY_BEST_SCORE, '-50');
      assert.equal(storage.getBestScore(), 0);
    });

    it('TC7.6: Audio volume preference persists and clamps correctly', () => {
      const storage = new StorageAdapter(new InMemoryStorage());
      assert.equal(storage.getAudioVolume(), 0.85);

      storage.saveAudioVolume(0.42);
      assert.equal(storage.getAudioVolume(), 0.42);

      storage.saveAudioVolume(1.5);
      assert.equal(storage.getAudioVolume(), 1.0);

      storage.saveAudioVolume(-0.2);
      assert.equal(storage.getAudioVolume(), 0.0);
    });
  });
});
