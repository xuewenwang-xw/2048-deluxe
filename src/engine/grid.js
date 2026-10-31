/**
 * @file grid.js
 * Headless 2D Grid Matrix and 1D Compaction Engine for 2048 Deluxe.
 * Pure mathematical logic with zero DOM or browser dependencies.
 */

import { Direction, DEFAULT_GRID_SIZE, isValidDirection, isValidTileValue } from './types.js';

/**
 * Pure 1D Compaction Kernel.
 * Compacts an array of numbers towards index 0 using 2048 single-merge rules.
 *
 * @param {number[]} line - Array of tile numbers of length N
 * @returns {{
 *   line: number[],
 *   result: number[],
 *   score: number,
 *   scoreGain: number,
 *   highestMerge: number,
 *   combos: number,
 *   merges: number,
 *   hasChanged: boolean
 * }}
 */
export function compactLine(line) {
  const size = line.length;
  const nonZeros = [];

  for (let i = 0; i < size; i++) {
    if (line[i] !== 0) {
      nonZeros.push(line[i]);
    }
  }

  const merged = [];
  let score = 0;
  let highestMerge = 0;
  let combos = 0;

  let i = 0;
  while (i < nonZeros.length) {
    if (i + 1 < nonZeros.length && nonZeros[i] === nonZeros[i + 1]) {
      const mergedVal = nonZeros[i] * 2;
      merged.push(mergedVal);
      score += mergedVal;
      combos += 1;
      if (mergedVal > highestMerge) {
        highestMerge = mergedVal;
      }
      i += 2; // Enforce single-merge: skip both tiles
    } else {
      merged.push(nonZeros[i]);
      i += 1;
    }
  }

  while (merged.length < size) {
    merged.push(0);
  }

  let hasChanged = false;
  for (let j = 0; j < size; j++) {
    if (line[j] !== merged[j]) {
      hasChanged = true;
      break;
    }
  }

  return {
    line: merged,
    result: merged,       // Alias for test catalog compatibility
    score,
    scoreGain: score,     // Alias for test catalog compatibility
    highestMerge,
    combos,
    merges: combos,       // Alias for test catalog compatibility
    hasChanged
  };
}

/**
 * Maps a (lineIndex, cellIndex) in a given direction to (row, col) coordinates.
 *
 * @param {string} direction - UP | DOWN | LEFT | RIGHT
 * @param {number} k - Line index (0 to size - 1)
 * @param {number} i - Cell index along the line (0 to size - 1), where 0 is target edge
 * @param {number} size - Grid dimension N
 * @returns {{ r: number, c: number }}
 */
export function getVectorCoordinate(direction, k, i, size) {
  switch (direction) {
    case Direction.LEFT:
      return { r: k, c: i };
    case Direction.RIGHT:
      return { r: k, c: size - 1 - i };
    case Direction.UP:
      return { r: i, c: k };
    case Direction.DOWN:
      return { r: size - 1 - i, c: k };
    default:
      throw new TypeError(`Invalid direction: ${direction}`);
  }
}

/**
 * Grid matrix representing an N x N 2048 game board.
 */
export class Grid {
  /**
   * @param {number} [size=4] - Board dimension N
   */
  constructor(size = DEFAULT_GRID_SIZE) {
    if (typeof size !== 'number' || size < 2 || !Number.isInteger(size)) {
      throw new RangeError(`Grid size must be an integer >= 2, got: ${size}`);
    }
    this.size = size;
    this.cells = this._createMatrix(size);
  }

  /**
   * Internal helper to allocate an empty N x N zero-filled matrix.
   * @private
   * @param {number} size
   * @returns {number[][]}
   */
  _createMatrix(size) {
    const matrix = [];
    for (let r = 0; r < size; r++) {
      matrix.push(new Array(size).fill(0));
    }
    return matrix;
  }

  /**
   * Returns cell value at (r, c).
   * @param {number} r - Row index
   * @param {number} c - Column index
   * @returns {number}
   */
  get(r, c) {
    if (!this.isWithinBounds(r, c)) return 0;
    return this.cells[r][c];
  }

  /**
   * Sets cell value at (r, c).
   * @param {number} r - Row index
   * @param {number} c - Column index
   * @param {number} val - Tile value (0 or positive power of 2)
   */
  set(r, c, val) {
    if (!this.isWithinBounds(r, c)) {
      throw new RangeError(`Coordinates out of bounds: (${r}, ${c}) for size ${this.size}`);
    }
    if (!isValidTileValue(val)) {
      throw new TypeError(`Invalid tile value: ${val}`);
    }
    this.cells[r][c] = val;
  }

  /**
   * Alias for set(r, c, val)
   * @param {number} r
   * @param {number} c
   * @param {number} val
   */
  setTile(r, c, val) {
    this.set(r, c, val);
  }

  /**
   * Checks if coordinate is within grid bounds.
   * @param {number} r
   * @param {number} c
   * @returns {boolean}
   */
  isWithinBounds(r, c) {
    return r >= 0 && r < this.size && c >= 0 && c < this.size;
  }

  /**
   * Checks if cell at (r, c) is empty (0).
   * @param {number} r
   * @param {number} c
   * @returns {boolean}
   */
  isEmpty(r, c) {
    return this.get(r, c) === 0;
  }

  /**
   * Returns all empty cell coordinates.
   * @returns {Array<{ r: number, c: number }>}
   */
  getEmptyCells() {
    const empty = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.cells[r][c] === 0) {
          empty.push({ r, c });
        }
      }
    }
    return empty;
  }

  /**
   * Checks if there is at least one empty cell.
   * @returns {boolean}
   */
  hasEmptyCells() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.cells[r][c] === 0) return true;
      }
    }
    return false;
  }

  /**
   * Checks if the grid is full (0 empty cells).
   * @returns {boolean}
   */
  isFull() {
    return !this.hasEmptyCells();
  }

  /**
   * Returns the maximum tile value currently on the board.
   * @returns {number}
   */
  getMaxTile() {
    let max = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.cells[r][c] > max) {
          max = this.cells[r][c];
        }
      }
    }
    return max;
  }

  /**
   * Checks if any cell on the board has a value >= targetVal.
   * @param {number} targetVal
   * @returns {boolean}
   */
  hasTile(targetVal) {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.cells[r][c] >= targetVal) return true;
      }
    }
    return false;
  }

  /**
   * Performs a deep clone of the grid instance.
   * @returns {Grid}
   */
  clone() {
    const copy = new Grid(this.size);
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        copy.cells[r][c] = this.cells[r][c];
      }
    }
    return copy;
  }

  /**
   * Returns a deep clone of the raw 2D cells array.
   * @returns {number[][]}
   */
  cloneCells() {
    return this.cells.map(row => [...row]);
  }

  /**
   * Checks if two grids or a grid and matrix have identical cell values.
   * @param {Grid|number[][]} other
   * @returns {boolean}
   */
  equals(other) {
    if (!other) return false;
    const matrix = other instanceof Grid ? other.cells : other;
    if (!Array.isArray(matrix) || matrix.length !== this.size) return false;
    for (let r = 0; r < this.size; r++) {
      if (!Array.isArray(matrix[r]) || matrix[r].length !== this.size) return false;
      for (let c = 0; c < this.size; c++) {
        if (this.cells[r][c] !== matrix[r][c]) return false;
      }
    }
    return true;
  }

  /**
   * Exports grid as a raw 2D number array.
   * @returns {number[][]}
   */
  toArray() {
    return this.cells.map(row => [...row]);
  }

  /**
   * Alias for toArray()
   * @returns {number[][]}
   */
  serialize() {
    return this.toArray();
  }

  /**
   * Sets grid contents from a 2D number array.
   * @param {number[][]} matrix
   */
  load(matrix) {
    if (!Array.isArray(matrix) || matrix.length !== this.size) {
      throw new TypeError(`Matrix must be an array of length ${this.size}`);
    }
    for (let r = 0; r < this.size; r++) {
      if (!Array.isArray(matrix[r]) || matrix[r].length !== this.size) {
        throw new TypeError(`Matrix row ${r} must have length ${this.size}`);
      }
      for (let c = 0; c < this.size; c++) {
        const val = matrix[r][c];
        if (!isValidTileValue(val)) {
          throw new TypeError(`Invalid tile value at (${r}, ${c}): ${val}`);
        }
        this.cells[r][c] = val;
      }
    }
  }

  /**
   * Alias for load(matrix)
   * @param {number[][]} matrix
   */
  setCells(matrix) {
    this.load(matrix);
  }

  /**
   * Factory creating a Grid from a 2D number array.
   * @param {number[][]} matrix
   * @returns {Grid}
   */
  static fromArray(matrix) {
    if (!Array.isArray(matrix) || matrix.length < 2) {
      throw new TypeError('Invalid matrix input');
    }
    const size = matrix.length;
    const grid = new Grid(size);
    grid.load(matrix);
    return grid;
  }

  /**
   * Tests whether moving in direction would change the grid state.
   * Pure query; does NOT mutate grid.
   *
   * @param {string} direction - UP | DOWN | LEFT | RIGHT
   * @returns {boolean}
   */
  canMove(direction) {
    if (!isValidDirection(direction)) return false;

    const line = new Array(this.size);
    for (let k = 0; k < this.size; k++) {
      for (let i = 0; i < this.size; i++) {
        const { r, c } = getVectorCoordinate(direction, k, i, this.size);
        line[i] = this.cells[r][c];
      }
      const result = compactLine(line);
      if (result.hasChanged) {
        return true; // Fast exit
      }
    }
    return false;
  }

  /**
   * Determines whether any legal moves exist across all 4 directions.
   * Implements the optimal O(N^2) neighbor-equality check.
   *
   * @returns {boolean}
   */
  hasAvailableMoves() {
    // 1. If any cell is empty, a move is always possible
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.cells[r][c] === 0) return true;
      }
    }

    // 2. Check adjacent horizontal pairs
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size - 1; c++) {
        if (this.cells[r][c] === this.cells[r][c + 1]) return true;
      }
    }

    // 3. Check adjacent vertical pairs
    for (let c = 0; c < this.size; c++) {
      for (let r = 0; r < this.size - 1; r++) {
        if (this.cells[r][c] === this.cells[r + 1][c]) return true;
      }
    }

    return false;
  }

  /**
   * Executes compaction in the specified direction.
   * Mutates `this.cells` in-place and returns detailed move metrics.
   *
   * @param {string} direction - UP | DOWN | LEFT | RIGHT
   * @returns {{
   *   moved: boolean,
   *   hasChanged: boolean,
   *   scoreGained: number,
   *   score: number,
   *   highestMerge: number,
   *   combos: number,
   *   merges: number
   * }}
   */
  move(direction) {
    if (!isValidDirection(direction)) {
      throw new TypeError(`Invalid move direction: ${direction}`);
    }

    let moved = false;
    let scoreGained = 0;
    let highestMerge = 0;
    let combos = 0;

    const line = new Array(this.size);

    for (let k = 0; k < this.size; k++) {
      // 1. Extract 1D line along projection vector
      for (let i = 0; i < this.size; i++) {
        const { r, c } = getVectorCoordinate(direction, k, i, this.size);
        line[i] = this.cells[r][c];
      }

      // 2. Compact 1D line
      const res = compactLine(line);

      if (res.hasChanged) {
        moved = true;
        scoreGained += res.score;
        combos += res.combos;
        if (res.highestMerge > highestMerge) {
          highestMerge = res.highestMerge;
        }

        // 3. Write compacted line back to grid
        for (let i = 0; i < this.size; i++) {
          const { r, c } = getVectorCoordinate(direction, k, i, this.size);
          this.cells[r][c] = res.line[i];
        }
      }
    }

    return {
      moved,
      hasChanged: moved,     // Alias for test catalog compatibility
      scoreGained,
      score: scoreGained,    // Alias
      highestMerge,
      combos,
      merges: combos         // Alias
    };
  }

  /**
   * Alias for move(direction)
   * @param {string} direction
   */
  slide(direction) {
    return this.move(direction);
  }

  /**
   * Validates all mathematical invariants of current board state.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateInvariants() {
    const errors = [];
    if (!Array.isArray(this.cells) || this.cells.length !== this.size) {
      errors.push(`Grid outer array length mismatch: expected ${this.size}`);
      return { valid: false, errors };
    }

    let emptyCount = 0;
    let occupiedCount = 0;

    for (let r = 0; r < this.size; r++) {
      if (!Array.isArray(this.cells[r]) || this.cells[r].length !== this.size) {
        errors.push(`Row ${r} length mismatch: expected ${this.size}`);
        continue;
      }
      for (let c = 0; c < this.size; c++) {
        const val = this.cells[r][c];
        if (!isValidTileValue(val)) {
          errors.push(`Cell (${r}, ${c}) has invalid tile value: ${val}`);
        }
        if (val === 0) {
          emptyCount++;
        } else {
          occupiedCount++;
        }
      }
    }

    if (emptyCount + occupiedCount !== this.size * this.size) {
      errors.push(`Conservation invariant violated: empty(${emptyCount}) + occupied(${occupiedCount}) !== ${this.size * this.size}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Attach static method for compatibility
Grid.compactLine = compactLine;
