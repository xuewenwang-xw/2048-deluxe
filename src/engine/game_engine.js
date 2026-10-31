/**
 * @file game_engine.js
 * Discrete-event Finite State Machine, Seeded Spawner, Multi-Level Undo Stack,
 * and JSON State Persistence for 2048 Deluxe.
 * Pure mathematical logic with zero DOM or browser dependencies.
 */

import { Direction, GameStatus, DEFAULT_GRID_SIZE, isValidDirection, isValidTileValue } from './types.js';
import { PRNG } from './prng.js';
import { Grid } from './grid.js';

export class GameEngine {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.size=4] - Board dimension N (default 4)
   * @param {number|string} [options.seed] - Seed for Mulberry32 PRNG
   * @param {number} [options.maxUndo=100] - Maximum undo history capacity
   * @param {number} [options.targetValue=2048] - Tile value that triggers victory
   */
  constructor(options = {}) {
    this.init(options);
  }

  /**
   * Initializes or re-initializes engine state.
   * @param {Object} [options={}]
   */
  init(options = {}) {
    this.size = typeof options.size === 'number' && options.size >= 2 ? options.size : DEFAULT_GRID_SIZE;
    this.targetValue = typeof options.targetValue === 'number' ? options.targetValue : 2048;
    this.maxUndoDepth = typeof options.maxUndo === 'number' ? options.maxUndo : 100;

    const seed = options.seed !== undefined ? options.seed : 123456789;
    this.prng = new PRNG(seed);

    this.grid = new Grid(this.size);
    this.score = 0;
    this.highScore = 0;
    this.moveCount = 0;
    this.status = GameStatus.PLAYING;
    this.wonAcknowledged = false;
    this.combos = 0;
    this.nextTileId = 0;
    this.history = [];

    // Spawn 2 initial tiles
    this.spawnTile();
    this.spawnTile();
  }

  /**
   * Resets the game to initial state. Preserves all-time high score.
   * @param {number|string} [seed] - Optional new PRNG seed
   */
  restart(seed) {
    if (seed !== undefined) {
      this.prng = new PRNG(seed);
    } else {
      this.prng = new PRNG(this.prng.getSeed());
    }

    this.grid = new Grid(this.size);
    this.score = 0;
    this.moveCount = 0;
    this.status = GameStatus.PLAYING;
    this.wonAcknowledged = false;
    this.combos = 0;
    this.nextTileId = 0;
    this.history = [];

    this.spawnTile();
    this.spawnTile();
  }

  /**
   * Spawns a new tile into a random empty grid cell.
   * 90% chance of 2, 10% chance of 4.
   *
   * @returns {{ r: number, c: number, value: number, id: number } | null}
   */
  spawnTile() {
    const emptyCells = this.grid.getEmptyCells();
    if (emptyCells.length === 0) {
      return null;
    }

    // Draw 1: Pick empty cell coordinate
    const cellIndex = Math.floor(this.prng.next() * emptyCells.length);
    const cell = emptyCells[cellIndex];

    // Draw 2: Pick tile value (90% chance of 2, 10% chance of 4)
    const value = this.prng.next() < 0.9 ? 2 : 4;

    const tileId = ++this.nextTileId;
    this.grid.set(cell.r, cell.c, value);

    return {
      r: cell.r,
      c: cell.c,
      value,
      id: tileId
    };
  }

  /**
   * Internal helper to create an empty move result.
   * @private
   * @param {string} status
   * @returns {Object}
   */
  _emptyMoveResult(status) {
    return {
      moved: false,
      scoreGained: 0,
      highestMerge: 0,
      combos: this.combos,
      spawnedTile: null,
      status,
      isFirstWin: false
    };
  }

  /**
   * Executes a move in the specified direction.
   *
   * @param {string} direction - UP | DOWN | LEFT | RIGHT
   * @returns {{
   *   moved: boolean,
   *   scoreGained: number,
   *   highestMerge: number,
   *   combos: number,
   *   spawnedTile: { r: number, c: number, value: number, id: number } | null,
   *   status: string,
   *   isFirstWin: boolean
   * }}
   */
  move(direction) {
    if (!isValidDirection(direction)) {
      return this._emptyMoveResult(this.status);
    }

    // Guard 1: Terminal GAMEOVER state
    if (this.status === GameStatus.GAMEOVER) {
      return this._emptyMoveResult(GameStatus.GAMEOVER);
    }

    // Guard 2: Deadlock check before move
    if (!this.grid.hasEmptyCells() && !this.grid.hasAvailableMoves()) {
      this.status = GameStatus.GAMEOVER;
      return this._emptyMoveResult(GameStatus.GAMEOVER);
    }

    // Guard 3: Unacknowledged WON state input blocking
    if (this.status === GameStatus.WON && !this.wonAcknowledged) {
      return this._emptyMoveResult(GameStatus.WON);
    }

    // Guard 4: Movement feasibility in target direction
    if (!this.grid.canMove(direction)) {
      return this._emptyMoveResult(this.status);
    }

    // STEP 1: Save state snapshot BEFORE mutating state
    this._pushHistorySnapshot();

    // STEP 2: Execute grid compaction & sliding
    const slideResult = this.grid.move(direction);
    if (!slideResult.moved) {
      // Failsafe: if grid reported moved=false, discard snapshot
      this.history.pop();
      return this._emptyMoveResult(this.status);
    }

    // STEP 3: Accumulate score & update combo streak
    this.score += slideResult.scoreGained;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.moveCount++;
    if (slideResult.combos > 0) {
      this.combos += slideResult.combos;
    } else {
      this.combos = 0;
    }

    // STEP 4: Check victory condition
    let isFirstWin = false;
    if (!this.wonAcknowledged && (slideResult.highestMerge >= this.targetValue || this.grid.getMaxTile() >= this.targetValue)) {
      this.status = GameStatus.WON;
      isFirstWin = true;
    }

    // STEP 5: Spawn new tile
    const spawnedTile = this.spawnTile();

    // STEP 6: Check for Game Over condition
    if (!this.grid.hasEmptyCells() && !this.grid.hasAvailableMoves()) {
      this.status = GameStatus.GAMEOVER;
    }

    return {
      moved: true,
      scoreGained: slideResult.scoreGained,
      highestMerge: slideResult.highestMerge,
      combos: this.combos,
      spawnedTile,
      status: this.status,
      isFirstWin
    };
  }

  /**
   * Tests whether moving in direction would change state.
   * @param {string} direction
   * @returns {boolean}
   */
  canMove(direction) {
    if (this.status === GameStatus.GAMEOVER) return false;
    if (this.status === GameStatus.WON && !this.wonAcknowledged) return false;
    return this.grid.canMove(direction);
  }

  /**
   * Pushes a deep-cloned snapshot of current engine state.
   * @private
   */
  _pushHistorySnapshot() {
    const snapshot = {
      grid: this.grid.cloneCells(),
      score: this.score,
      status: this.status,
      wonAcknowledged: this.wonAcknowledged,
      moveCount: this.moveCount,
      combos: this.combos,
      prngState: this.prng.getState(),
      nextTileId: this.nextTileId
    };

    if (this.history.length >= this.maxUndoDepth) {
      this.history.shift();
    }
    this.history.push(snapshot);
  }

  /**
   * Reverts the most recent move, restoring grid, score, combos, and PRNG.
   * High score is preserved.
   * @returns {boolean} true if undo succeeded; false if undo stack was empty.
   */
  undo() {
    if (this.history.length === 0) {
      return false;
    }

    const snapshot = this.history.pop();
    this.grid.load(snapshot.grid);
    this.score = snapshot.score;
    this.status = snapshot.status;
    this.wonAcknowledged = snapshot.wonAcknowledged;
    this.moveCount = snapshot.moveCount;
    this.combos = snapshot.combos;
    this.prng.setState(snapshot.prngState);
    this.nextTileId = snapshot.nextTileId;

    return true;
  }

  /**
   * Checks whether an undo operation is currently available.
   * @returns {boolean}
   */
  canUndo() {
    return this.history.length > 0;
  }

  /**
   * Acknowledges victory and permits gameplay continuation past 2048.
   */
  keepGoing() {
    if (this.status === GameStatus.WON) {
      this.status = GameStatus.PLAYING;
      this.wonAcknowledged = true;
    }
  }

  /**
   * Returns a complete, read-only snapshot of active state.
   * @returns {Object}
   */
  getState() {
    return {
      size: this.grid.size,
      grid: this.grid.toArray(),
      score: this.score,
      highScore: this.highScore,
      moveCount: this.moveCount,
      combos: this.combos,
      status: this.status,
      wonAcknowledged: this.wonAcknowledged,
      canUndo: this.canUndo()
    };
  }

  /**
   * Returns grid matrix representation.
   * @returns {number[][]}
   */
  getGrid() {
    return this.grid.toArray();
  }

  /**
   * Returns current score.
   * @returns {number}
   */
  getScore() {
    return this.score;
  }

  /**
   * Returns high score.
   * @returns {number}
   */
  getHighScore() {
    return this.highScore;
  }

  /**
   * Returns active status.
   * @returns {string}
   */
  getStatus() {
    return this.status;
  }

  /**
   * Returns move count.
   * @returns {number}
   */
  getMoveCount() {
    return this.moveCount;
  }

  /**
   * Checks if status is WON.
   * @returns {boolean}
   */
  isWon() {
    return this.status === GameStatus.WON;
  }

  /**
   * Checks if status is GAMEOVER.
   * @returns {boolean}
   */
  isGameOver() {
    return this.status === GameStatus.GAMEOVER;
  }

  /**
   * Returns initial PRNG seed.
   * @returns {number}
   */
  getSeed() {
    return this.prng.getSeed();
  }

  /**
   * Injects a preset grid and score for testing scenarios.
   * @param {number[][]} matrix
   * @param {number} [score=0]
   */
  injectPreset(matrix, score = 0) {
    this.grid.load(matrix);
    this.score = score;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    if (!this.grid.hasEmptyCells() && !this.grid.hasAvailableMoves()) {
      this.status = GameStatus.GAMEOVER;
    }
  }

  /**
   * Serializes complete engine state to a JSON string.
   * @returns {string}
   */
  serialize() {
    const payload = {
      version: '1.0.0',
      size: this.grid.size,
      targetValue: this.targetValue,
      score: this.score,
      highScore: this.highScore,
      moveCount: this.moveCount,
      status: this.status,
      wonAcknowledged: this.wonAcknowledged,
      combos: this.combos,
      prngSeed: this.prng.getSeed(),
      prngState: this.prng.getState(),
      nextTileId: this.nextTileId,
      grid: this.grid.toArray(),
      history: this.history.map(s => ({
        grid: s.grid.map(row => [...row]),
        score: s.score,
        status: s.status,
        wonAcknowledged: s.wonAcknowledged,
        moveCount: s.moveCount,
        combos: s.combos,
        prngState: s.prngState,
        nextTileId: s.nextTileId
      }))
    };
    return JSON.stringify(payload);
  }

  /**
   * Validates and restores engine state from a JSON string.
   * Atomic: if validation fails, active state is completely unmodified.
   *
   * @param {string} jsonString
   * @returns {boolean} true if deserialization succeeded, false otherwise.
   */
  deserialize(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch {
      return false;
    }

    // Schema & Invariant Validation
    if (!data || typeof data !== 'object') return false;
    if (data.version !== '1.0.0') return false;

    const size = data.size;
    if (!Number.isInteger(size) || size < 2 || size > 8) return false;

    if (!Number.isInteger(data.score) || data.score < 0) return false;
    if (!Number.isInteger(data.highScore) || data.highScore < data.score) return false;
    if (!Number.isInteger(data.moveCount) || data.moveCount < 0) return false;
    if (![GameStatus.PLAYING, GameStatus.WON, GameStatus.GAMEOVER].includes(data.status)) return false;
    if (typeof data.wonAcknowledged !== 'boolean') return false;
    if (typeof data.prngState !== 'number' || data.prngState < 0 || data.prngState > 0xFFFFFFFF) return false;

    // Grid Validation: power-of-two invariants
    const isValidMatrix = (grid) => {
      if (!Array.isArray(grid) || grid.length !== size) return false;
      for (let r = 0; r < size; r++) {
        const row = grid[r];
        if (!Array.isArray(row) || row.length !== size) return false;
        for (let c = 0; c < size; c++) {
          const val = row[c];
          if (!isValidTileValue(val)) return false;
        }
      }
      return true;
    };

    if (!isValidMatrix(data.grid)) return false;

    // History Validation
    if (data.history !== undefined && !Array.isArray(data.history)) return false;
    if (Array.isArray(data.history)) {
      for (const snap of data.history) {
        if (!snap || typeof snap !== 'object') return false;
        if (!isValidMatrix(snap.grid)) return false;
        if (typeof snap.score !== 'number' || snap.score < 0) return false;
        if (typeof snap.prngState !== 'number') return false;
      }
    }

    // Atomically apply validated state
    this.size = size;
    this.grid = new Grid(size);
    this.grid.load(data.grid);
    this.targetValue = data.targetValue || 2048;
    this.score = data.score;
    this.highScore = data.highScore;
    this.moveCount = data.moveCount;
    this.status = data.status;
    this.wonAcknowledged = data.wonAcknowledged;
    this.combos = data.combos || 0;
    this.nextTileId = data.nextTileId || 1000;

    this.prng = new PRNG(data.prngSeed || 123456789);
    this.prng.setState(data.prngState);

    this.history = (data.history || []).map(snap => ({
      grid: snap.grid.map(row => [...row]),
      score: snap.score,
      status: snap.status,
      wonAcknowledged: snap.wonAcknowledged,
      moveCount: snap.moveCount,
      combos: snap.combos || 0,
      prngState: snap.prngState,
      nextTileId: snap.nextTileId || 0
    }));

    return true;
  }
}
