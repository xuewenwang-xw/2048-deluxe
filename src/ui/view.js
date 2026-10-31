/**
 * @file view.js
 * Presentation Layer for 2048 Deluxe.
 * Handles DOM rendering, 3D CSS transforms, motion physics, and modal overlays.
 * Completely decoupled from game business logic.
 */

import { Direction, GameStatus } from '../engine/types.js';
import { getVectorCoordinate } from '../engine/grid.js';

/**
 * Calculates tile sliding transitions given previous grid and move direction.
 * @param {number[][]} prevGrid - N x N matrix of numbers
 * @param {string} direction - UP | DOWN | LEFT | RIGHT
 * @returns {{
 *   slides: Array<{ from: { r: number, c: number }, to: { r: number, c: number }, value: number }>,
 *   merges: Array<{ to: { r: number, c: number }, value: number }>
 * }}
 */
export function calculateMoveTransitions(prevGrid, direction) {
  const size = prevGrid.length;
  const slides = [];
  const merges = [];

  for (let k = 0; k < size; k++) {
    // 1. Extract non-zero tiles along vector
    const nonZeros = [];
    for (let i = 0; i < size; i++) {
      const coord = getVectorCoordinate(direction, k, i, size);
      const val = prevGrid[coord.r][coord.c];
      if (val !== 0) {
        nonZeros.push({ index: i, coord, value: val });
      }
    }

    // 2. Simulate 2048 single-merge compaction with destination tracking
    let destIdx = 0;
    let i = 0;
    while (i < nonZeros.length) {
      const current = nonZeros[i];
      const destCoord = getVectorCoordinate(direction, k, destIdx, size);

      if (i + 1 < nonZeros.length && current.value === nonZeros[i + 1].value) {
        const next = nonZeros[i + 1];
        // Both current and next slide to destCoord
        slides.push({ from: current.coord, to: destCoord, value: current.value });
        slides.push({ from: next.coord, to: destCoord, value: next.value });

        const mergedValue = current.value * 2;
        merges.push({ to: destCoord, value: mergedValue });

        destIdx += 1;
        i += 2; // enforce single merge rule
      } else {
        slides.push({ from: current.coord, to: destCoord, value: current.value });
        destIdx += 1;
        i += 1;
      }
    }
  }

  return { slides, merges };
}

/**
 * Decoupled Presentation Controller for 2048 Deluxe.
 */
export class GameView {
  /**
   * @param {Object} [options={}]
   */
  constructor(options = {}) {
    const resolveEl = (opt, defaultId, defaultSelector) => {
      if (typeof opt === 'string') {
        return typeof document !== 'undefined' ? document.querySelector(opt) : null;
      }
      if (opt) return opt;
      if (typeof document !== 'undefined') {
        if (defaultId) {
          const byId = document.getElementById(defaultId);
          if (byId) return byId;
        }
        if (defaultSelector) {
          return document.querySelector(defaultSelector);
        }
      }
      return null;
    };

    this.container = resolveEl(options.container, null, '.game-container');
    this.gridContainer = resolveEl(options.gridContainer, 'grid-container', '.grid-container');
    this.tileContainer = resolveEl(options.tileContainer, 'tile-container', '.tile-container');
    this.scoreVal = resolveEl(options.scoreVal, 'score-val', '#score-val');
    this.bestScoreVal = resolveEl(options.bestScoreVal, 'best-score-val', '#best-score-val');
    this.moveCountVal = resolveEl(options.moveCountVal, 'move-count-val', '#move-count-val');
    this.undoBtn = resolveEl(options.undoBtn, 'btn-undo', '#btn-undo');
    this.modalOverlay = resolveEl(options.modalOverlay, 'modal-overlay', '#modal-overlay');
    this.modalWin = resolveEl(options.modalWin, 'modal-win', '#modal-win');
    this.modalGameOver = resolveEl(options.modalGameOver, 'modal-gameover', '#modal-gameover');
    this.scoreAddition = resolveEl(options.scoreAddition, 'score-addition', '#score-addition');

    this.size = options.size || 4;
    this.slideDuration = options.slideDuration !== undefined ? options.slideDuration : 120;
    this.animationTimer = null;
  }

  /**
   * Initializes the board background cells and clears tiles.
   * @param {number} [size=4]
   */
  init(size = 4) {
    this.size = size;

    if (this.container && this.container.style && typeof this.container.style.setProperty === 'function') {
      this.container.style.setProperty('--grid-size', size);
    }

    if (this.gridContainer) {
      this.gridContainer.innerHTML = '';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = document.createElement('div');
          cell.className = 'grid-cell';
          cell.setAttribute('data-row', r);
          cell.setAttribute('data-col', c);
          this.gridContainer.appendChild(cell);
        }
      }
    }

    if (this.tileContainer) {
      this.tileContainer.innerHTML = '';
    }

    this.hideAllModals();
  }

  /**
   * Helper to create a single DOM tile element.
   * @param {number} r
   * @param {number} c
   * @param {number} value
   * @param {boolean} [isNew=false]
   * @param {boolean} [isMerged=false]
   * @returns {HTMLElement}
   */
  createTileElement(r, c, value, isNew = false, isMerged = false) {
    const tile = document.createElement('div');
    tile.className = `tile tile-${value} tile-pos-${r}-${c}`;
    if (isNew) tile.classList.add('tile-new');
    if (isMerged) tile.classList.add('tile-merged');

    if (tile.style && typeof tile.style.setProperty === 'function') {
      tile.style.setProperty('--r', r);
      tile.style.setProperty('--c', c);
    }
    tile.setAttribute('data-row', r);
    tile.setAttribute('data-col', c);
    tile.setAttribute('data-value', value);
    tile.setAttribute('data-length', String(value).length);

    const inner = document.createElement('div');
    inner.className = 'tile-inner';
    inner.textContent = String(value);
    tile.appendChild(inner);

    return tile;
  }

  /**
   * Updates an existing DOM tile element to a new grid position.
   * @param {HTMLElement} tile
   * @param {number} newR
   * @param {number} newC
   */
  moveTileElement(tile, newR, newC) {
    const oldR = tile.getAttribute('data-row');
    const oldC = tile.getAttribute('data-col');
    if (oldR !== null && oldC !== null) {
      tile.classList.remove(`tile-pos-${oldR}-${oldC}`);
    }

    tile.classList.add(`tile-pos-${newR}-${newC}`);
    if (tile.style && typeof tile.style.setProperty === 'function') {
      tile.style.setProperty('--r', newR);
      tile.style.setProperty('--c', newC);
    }
    tile.setAttribute('data-row', newR);
    tile.setAttribute('data-col', newC);
  }

  /**
   * Complete Snapshot Render: synchronizes HUD and DOM tiles instantly without slide animation.
   * Used for initial load, restart, undo, or session restore.
   * @param {Object} state - Readonly GameState snapshot from GameEngine.getState()
   */
  render(state) {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }

    this.updateHUD(state);

    if (this.tileContainer) {
      this.tileContainer.innerHTML = '';
      const grid = state.grid;
      const size = grid.length;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const val = grid[r][c];
          if (val > 0) {
            const tile = this.createTileElement(r, c, val, false, false);
            this.tileContainer.appendChild(tile);
          }
        }
      }
    }

    this.updateModals(state);
  }

  /**
   * Animated Move Render: executes hardware-accelerated slide and merge animations.
   * @param {number[][]} prevGrid - Grid matrix before move
   * @param {string} direction - UP | DOWN | LEFT | RIGHT
   * @param {Object} moveResult - Result from engine.move(direction)
   * @param {Object} state - Current engine state after move
   */
  renderMove(prevGrid, direction, moveResult, state) {
    if (!moveResult.moved) {
      return;
    }

    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }

    // Step 1: Calculate slide trajectories and merges
    const { slides, merges } = calculateMoveTransitions(prevGrid, direction);

    // Step 2: Animate existing DOM tiles
    if (this.tileContainer) {
      const existingTiles = Array.from(this.tileContainer.children);
      const usedElements = new Set();

      for (const slide of slides) {
        const el = existingTiles.find(tile =>
          !usedElements.has(tile) &&
          Number(tile.getAttribute('data-row')) === slide.from.r &&
          Number(tile.getAttribute('data-col')) === slide.from.c &&
          Number(tile.getAttribute('data-value')) === slide.value
        );

        if (el) {
          usedElements.add(el);
          this.moveTileElement(el, slide.to.r, slide.to.c);
        }
      }
    }

    // Step 3: Trigger score addition badge if score increased
    if (moveResult.scoreGained > 0) {
      this.showScoreAddition(moveResult.scoreGained);
    }

    // Step 4: Finalize grid with merges & spawn
    const finalizeGrid = () => {
      if (this.tileContainer) {
        this.tileContainer.innerHTML = '';
        const grid = state.grid;
        const size = grid.length;

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const val = grid[r][c];
            if (val > 0) {
              const isSpawned = moveResult.spawnedTile &&
                moveResult.spawnedTile.r === r &&
                moveResult.spawnedTile.c === c;

              const isMerged = merges.some(m => m.to.r === r && m.to.c === c && m.value === val);

              const tile = this.createTileElement(r, c, val, isSpawned, isMerged);
              this.tileContainer.appendChild(tile);
            }
          }
        }
      }

      this.updateHUD(state);
      this.updateModals(state);
    };

    if (this.slideDuration === 0) {
      finalizeGrid();
    } else {
      this.animationTimer = setTimeout(() => {
        this.animationTimer = null;
        finalizeGrid();
      }, this.slideDuration);
    }
  }

  /**
   * Updates HUD statistics (Score, Best, Moves, Undo button state).
   * @param {Object} state
   */
  updateHUD(state) {
    if (this.scoreVal) {
      this.scoreVal.textContent = String(state.score !== undefined ? state.score : 0);
    }
    if (this.bestScoreVal) {
      this.bestScoreVal.textContent = String(state.highScore !== undefined ? state.highScore : 0);
    }
    if (this.moveCountVal) {
      this.moveCountVal.textContent = String(state.moveCount !== undefined ? state.moveCount : 0);
    }
    if (this.undoBtn) {
      this.undoBtn.disabled = !state.canUndo;
    }
  }

  /**
   * Updates modal overlay visibility based on game status.
   * @param {Object} state
   */
  updateModals(state) {
    if (state.status === GameStatus.WON && !state.wonAcknowledged) {
      this.showWinModal();
    } else if (state.status === GameStatus.GAMEOVER) {
      this.showGameOverModal();
    } else {
      this.hideAllModals();
    }
  }

  /**
   * Displays the Victory modal dialog.
   */
  showWinModal() {
    if (this.modalOverlay) this.modalOverlay.classList.remove('hidden');
    if (this.modalWin) this.modalWin.classList.remove('hidden');
    if (this.modalGameOver) this.modalGameOver.classList.add('hidden');
  }

  /**
   * Displays the Game Over modal dialog.
   */
  showGameOverModal() {
    if (this.modalOverlay) this.modalOverlay.classList.remove('hidden');
    if (this.modalGameOver) this.modalGameOver.classList.remove('hidden');
    if (this.modalWin) this.modalWin.classList.add('hidden');
  }

  /**
   * Closes all modal dialogs.
   */
  hideAllModals() {
    if (this.modalOverlay) this.modalOverlay.classList.add('hidden');
    if (this.modalWin) this.modalWin.classList.add('hidden');
    if (this.modalGameOver) this.modalGameOver.classList.add('hidden');
  }

  /**
   * Spawns an animated floating `+points` badge.
   * @param {number} points
   */
  showScoreAddition(points) {
    if (!this.scoreAddition) return;

    const item = document.createElement('div');
    item.className = 'score-addition-item';
    item.textContent = `+${points}`;

    this.scoreAddition.appendChild(item);

    setTimeout(() => {
      if (item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }, 600);
  }
}
