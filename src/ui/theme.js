/**
 * @file theme.js
 * Theme controller and CSS Custom Property switcher for 2048 Deluxe.
 * Supports 4 themes: cyberpunk, retro, dark, and pastel.
 */

export const THEMES = Object.freeze({
  CYBERPUNK: 'cyberpunk',
  RETRO: 'retro',
  DARK: 'dark',
  PASTEL: 'pastel'
});

export const THEME_LIST = Object.freeze([
  THEMES.CYBERPUNK,
  THEMES.RETRO,
  THEMES.DARK,
  THEMES.PASTEL
]);

export const DEFAULT_THEME = THEMES.CYBERPUNK;

export class ThemeController {
  /**
   * @param {Object} [options={}]
   * @param {import('./storage.js').StorageAdapter} [options.storage]
   * @param {import('./storage.js').StorageAdapter} [options.storageAdapter]
   * @param {HTMLElement} [options.rootElement]
   * @param {string} [options.defaultTheme='cyberpunk']
   */
  constructor(options = {}) {
    this.storage = options.storage || options.storageAdapter || null;
    this.rootElement = options.rootElement || (typeof document !== 'undefined' ? document.documentElement : null);
    this.defaultTheme = options.defaultTheme || DEFAULT_THEME;
    this.currentTheme = this.defaultTheme;
    this._listeners = [];
  }

  /**
   * Returns list of supported theme identifiers.
   * @returns {string[]}
   */
  getAvailableThemes() {
    return [...THEME_LIST];
  }

  /**
   * Returns currently active theme identifier.
   * @returns {string}
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Validates if a theme name is supported.
   * @param {string} theme
   * @returns {boolean}
   */
  isValidTheme(theme) {
    return THEME_LIST.includes(theme);
  }

  /**
   * Initializes theme from storage, system preference, or defaultTheme, and sets root DOM attribute.
   * @returns {string} active theme
   */
  init() {
    let savedTheme = null;
    if (this.storage && typeof this.storage.getTheme === 'function') {
      savedTheme = this.storage.getTheme();
    }

    if (savedTheme && this.isValidTheme(savedTheme)) {
      this.setTheme(savedTheme, false);
    } else {
      // Check system preference
      if (typeof window !== 'undefined' && window.matchMedia) {
        try {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          this.setTheme(prefersDark ? THEMES.CYBERPUNK : THEMES.PASTEL, false);
        } catch {
          this.setTheme(this.defaultTheme, false);
        }
      } else {
        this.setTheme(this.defaultTheme, false);
      }
    }

    return this.currentTheme;
  }

  /**
   * Sets the active theme and updates DOM and storage.
   * @param {string} theme
   * @param {boolean} [persist=true]
   * @returns {boolean} success
   */
  setTheme(theme, persist = true) {
    if (!this.isValidTheme(theme)) {
      return false;
    }

    this.currentTheme = theme;

    // Apply data-theme to root element or documentElement
    if (this.rootElement && typeof this.rootElement.setAttribute === 'function') {
      this.rootElement.setAttribute('data-theme', theme);
    } else if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme);
    }

    if (persist && this.storage && typeof this.storage.saveTheme === 'function') {
      this.storage.saveTheme(theme);
    }

    // Notify registered listeners
    for (const listener of this._listeners) {
      try {
        listener(theme);
      } catch {
        // Suppress listener callback errors
      }
    }

    // Dispatch global window event if available
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
      } catch {
        // Fallback for mock environments
      }
    }

    return true;
  }

  /**
   * Cycles to the next available theme in order.
   * Order: cyberpunk -> retro -> dark -> pastel -> cyberpunk
   * @returns {string} new active theme
   */
  cycleTheme() {
    const currentIndex = THEME_LIST.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % THEME_LIST.length;
    const nextTheme = THEME_LIST[nextIndex];
    this.setTheme(nextTheme, true);
    return nextTheme;
  }

  /**
   * Subscribes to theme change notifications.
   * @param {(theme: string) => void} fn
   * @returns {() => void} unsubscribe function
   */
  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }
}
