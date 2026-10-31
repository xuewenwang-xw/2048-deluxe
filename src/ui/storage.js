/**
 * @file storage.js
 * Safe LocalStorage persistence adapter for 2048 Deluxe.
 * Provides quota-safe, sandbox-safe storage with an automatic InMemory fallback.
 */

export const STORAGE_PREFIX = '2048_deluxe_';
export const STORAGE_KEY_BEST_SCORE = `${STORAGE_PREFIX}best_score`;
export const STORAGE_KEY_THEME = `${STORAGE_PREFIX}theme`;
export const STORAGE_KEY_ACTIVE_GAME = `${STORAGE_PREFIX}active_game`;
export const STORAGE_KEY_AUDIO_MUTED = `${STORAGE_PREFIX}audio_muted`;
export const STORAGE_KEY_AUDIO_VOLUME = `${STORAGE_PREFIX}audio_volume`;

/**
 * In-memory fallback for environments without localStorage (Node.js, sandboxed iframes).
 */
export class InMemoryStorage {
  constructor() {
    this._map = new Map();
  }

  getItem(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }

  setItem(key, value) {
    this._map.set(key, String(value));
  }

  removeItem(key) {
    this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }

  key(index) {
    return Array.from(this._map.keys())[index] || null;
  }

  get length() {
    return this._map.size;
  }
}

/**
 * Robust LocalStorage wrapper with transparent failover and error containment.
 */
export class StorageAdapter {
  /**
   * @param {Storage|Object} [customBackend] - Optional custom Storage implementation
   */
  constructor(customBackend) {
    this._backend = customBackend || this._resolveStorageBackend();
    this._isNativeStorage = !(this._backend instanceof InMemoryStorage);
  }

  /**
   * Safely probes and resolves a functional storage backend.
   * @private
   * @returns {Storage|InMemoryStorage}
   */
  _resolveStorageBackend() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return new InMemoryStorage();
    }
    try {
      const probeKey = `__probe_${Date.now()}__`;
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return window.localStorage;
    } catch {
      // SecurityError, QuotaExceededError, or blocked 3rd-party storage
      return new InMemoryStorage();
    }
  }

  /**
   * Checks if native browser localStorage is active (vs in-memory fallback).
   * @returns {boolean}
   */
  isNativeStorageActive() {
    return this._isNativeStorage;
  }

  /**
   * Safely retrieves a raw string value.
   * @param {string} key
   * @returns {string|null}
   */
  getItem(key) {
    try {
      return this._backend.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * Safely sets a raw string value.
   * @param {string} key
   * @param {string} value
   * @returns {boolean} true if successful, false on error/quota limit
   */
  setItem(key, value) {
    try {
      this._backend.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely removes a key.
   * @param {string} key
   * @returns {boolean}
   */
  removeItem(key) {
    try {
      this._backend.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  // --- High-Level Game Persistence Methods ---

  /**
   * Retrieves high score. Defaults to 0 on any invalid or missing entry.
   * @returns {number}
   */
  getBestScore() {
    const raw = this.getItem(STORAGE_KEY_BEST_SCORE);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  /**
   * Saves high score if valid integer and greater than existing record.
   * @param {number} score
   * @returns {boolean}
   */
  saveBestScore(score) {
    if (!Number.isInteger(score) || score < 0) return false;
    const current = this.getBestScore();
    if (score > current) {
      return this.setItem(STORAGE_KEY_BEST_SCORE, score.toString());
    }
    return true;
  }

  /**
   * Retrieves saved theme name.
   * @returns {string|null}
   */
  getTheme() {
    return this.getItem(STORAGE_KEY_THEME);
  }

  /**
   * Saves active theme preference.
   * @param {string} theme
   * @returns {boolean}
   */
  saveTheme(theme) {
    if (typeof theme !== 'string' || !theme.trim()) return false;
    return this.setItem(STORAGE_KEY_THEME, theme.trim());
  }

  /**
   * Retrieves saved active game session JSON string.
   * @returns {string|null}
   */
  getActiveGame() {
    return this.getItem(STORAGE_KEY_ACTIVE_GAME);
  }

  /**
   * Alias for getActiveGame to support test harness contracts.
   * @returns {string|null}
   */
  loadActiveGame() {
    return this.getActiveGame();
  }

  /**
   * Saves active game session JSON string.
   * @param {string} serializedJson
   * @returns {boolean}
   */
  saveActiveGame(serializedJson) {
    if (typeof serializedJson !== 'string' || serializedJson.length === 0) return false;
    return this.setItem(STORAGE_KEY_ACTIVE_GAME, serializedJson);
  }

  /**
   * Clears saved active game session (called on game over or fresh restart).
   * @returns {boolean}
   */
  clearActiveGame() {
    return this.removeItem(STORAGE_KEY_ACTIVE_GAME);
  }

  /**
   * Retrieves audio muted preference.
   * @returns {boolean}
   */
  getAudioMuted() {
    return this.getItem(STORAGE_KEY_AUDIO_MUTED) === 'true';
  }

  /**
   * Saves audio muted preference.
   * @param {boolean} muted
   * @returns {boolean}
   */
  saveAudioMuted(muted) {
    return this.setItem(STORAGE_KEY_AUDIO_MUTED, muted ? 'true' : 'false');
  }

  /**
   * Retrieves audio volume preference [0.0, 1.0]. Defaults to 0.85.
   * @returns {number}
   */
  getAudioVolume() {
    const raw = this.getItem(STORAGE_KEY_AUDIO_VOLUME);
    if (raw === null || raw === undefined) return 0.85;
    const parsed = parseFloat(raw);
    return (!isNaN(parsed) && parsed >= 0 && parsed <= 1) ? parsed : 0.85;
  }

  /**
   * Saves audio volume preference.
   * @param {number} vol - Range [0.0, 1.0]
   * @returns {boolean}
   */
  saveAudioVolume(vol) {
    const clamped = Math.max(0, Math.min(1, Number(vol) || 0));
    return this.setItem(STORAGE_KEY_AUDIO_VOLUME, String(clamped));
  }

  /**
   * Clears all 2048 Deluxe keys from storage without touching other domain keys.
   */
  clearGameData() {
    this.removeItem(STORAGE_KEY_BEST_SCORE);
    this.removeItem(STORAGE_KEY_THEME);
    this.removeItem(STORAGE_KEY_ACTIVE_GAME);
    this.removeItem(STORAGE_KEY_AUDIO_MUTED);
    this.removeItem(STORAGE_KEY_AUDIO_VOLUME);
  }
}
