/**
 * @file prng.js
 * High-performance, deterministic 32-bit Mulberry32 PRNG for 2048 Deluxe.
 */

export class PRNG {
  /**
   * @param {number|string} [seed=123456789] - Initial seed value.
   */
  constructor(seed = 123456789) {
    this.seed = this._normalizeSeed(seed);
    this.state = this.seed;
  }

  /**
   * Coerces any seed input (number, string) to a 32-bit unsigned integer.
   * @private
   * @param {*} seed
   * @returns {number} 32-bit uint [0, 4294967295]
   */
  _normalizeSeed(seed) {
    if (seed === undefined || seed === null) {
      return 123456789;
    }
    if (typeof seed === 'number') {
      return (seed >>> 0);
    }
    // String hashing via 32-bit FNV-1a
    const str = String(seed);
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  /**
   * Generates a pseudo-random floating point number in [0, 1).
   * @returns {number}
   */
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a pseudo-random integer.
   * Supports both signatures:
   * - nextInt(max): integer in [0, max - 1]
   * - nextInt(min, max): integer in [min, max - 1]
   *
   * @param {number} minOrMax
   * @param {number} [maybeMax]
   * @returns {number}
   */
  nextInt(minOrMax, maybeMax) {
    if (maybeMax === undefined) {
      const max = minOrMax;
      if (typeof max !== 'number' || max <= 0) return 0;
      return Math.floor(this.next() * max);
    }
    const min = minOrMax;
    const max = maybeMax;
    if (min >= max) return min;
    return min + Math.floor(this.next() * (max - min));
  }

  /**
   * Picks a random element from an array.
   * @template T
   * @param {T[]} array
   * @returns {T|null}
   */
  choice(array) {
    if (!array || !Array.isArray(array) || array.length === 0) {
      return null;
    }
    return array[this.nextInt(array.length)];
  }

  /**
   * Returns current internal 32-bit state for snapshot capture.
   * @returns {number}
   */
  getState() {
    return this.state >>> 0;
  }

  /**
   * Restores generator internal state from a previously saved snapshot.
   * @param {number} savedState
   */
  setState(savedState) {
    this.state = (savedState >>> 0);
  }

  /**
   * Returns the original seed value.
   * @returns {number}
   */
  getSeed() {
    return this.seed;
  }

  /**
   * Reinitializes generator with a new seed.
   * @param {number|string} seed
   */
  setSeed(seed) {
    this.seed = this._normalizeSeed(seed);
    this.state = this.seed;
  }

  /**
   * Creates an independent clone of this PRNG with identical state.
   * @returns {PRNG}
   */
  clone() {
    const copy = new PRNG(this.seed);
    copy.setState(this.state);
    return copy;
  }
}
