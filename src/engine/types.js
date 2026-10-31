/**
 * @file types.js
 * Core constants, enumerations, and validation helpers for 2048 Deluxe.
 */

/**
 * Movement directions supported by the grid.
 * @readonly
 * @enum {string}
 */
export const Direction = Object.freeze({
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT'
});

/**
 * FSM Game States.
 * @readonly
 * @enum {string}
 */
export const GameStatus = Object.freeze({
  PLAYING: 'PLAYING',
  WON: 'WON',
  GAMEOVER: 'GAMEOVER'
});

export const DEFAULT_GRID_SIZE = 4;
export const MIN_GRID_SIZE = 2;
export const MAX_GRID_SIZE = 8;
export const WINNING_TILE_VALUE = 2048;
export const SPAWN_PROBABILITY_4 = 0.1; // 10% chance for 4, 90% chance for 2

/**
 * Validates whether a given string is a valid Direction.
 * @param {*} dir
 * @returns {boolean}
 */
export function isValidDirection(dir) {
  return dir === Direction.UP ||
         dir === Direction.DOWN ||
         dir === Direction.LEFT ||
         dir === Direction.RIGHT;
}

/**
 * Checks if a value is a strictly positive integer power of two.
 * @param {*} val
 * @returns {boolean}
 */
export function isPowerOfTwo(val) {
  if (typeof val !== 'number' || !Number.isInteger(val) || val <= 0) {
    return false;
  }
  return (val & (val - 1)) === 0;
}

/**
 * Validates whether a value is a valid 2048 tile value (0 or positive power of 2).
 * @param {*} val
 * @returns {boolean}
 */
export function isValidTileValue(val) {
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
    return false;
  }
  if (val === 0) return true;
  return (val & (val - 1)) === 0;
}
