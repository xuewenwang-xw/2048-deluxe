/**
 * @file app.js
 * Application bootstrap and coordinator for 2048 Deluxe.
 * Orchestrates GameEngine, GameView, InputController, ThemeController, StorageAdapter,
 * AudioEngine, ParticleCanvas, and JuiceSystem.
 */

import { GameEngine } from './engine/game_engine.js';
import { GameView, calculateMoveTransitions } from './ui/view.js';
import { InputController } from './ui/input.js?v=2.3';
import { ThemeController } from './ui/theme.js';
import { StorageAdapter } from './ui/storage.js';
import { AudioEngine } from './audio/audio_engine.js';
import { ParticleCanvas, TILE_PARTICLE_COLORS } from './effects/particle_canvas.js';
import { JuiceSystem } from './effects/juice.js';

export function initApp() {
  // 1. Initialize Storage Adapter
  const storage = new StorageAdapter();

  // 2. Initialize Theme Controller
  const theme = new ThemeController({ storageAdapter: storage });
  theme.init();

  // 3. Initialize Audio Engine with stored mute & volume preferences
  const isMuted = storage.getAudioMuted();
  const storedVolume = storage.getAudioVolume ? storage.getAudioVolume() : 0.85;
  const audio = new AudioEngine({ muted: isMuted, volume: storedVolume });

  // 4. Initialize Particle Canvas Engine
  const particleCanvas = new ParticleCanvas();
  if (typeof document !== 'undefined') {
    const canvasEl = document.getElementById('particle-canvas');
    if (canvasEl) {
      particleCanvas.init(canvasEl);
    }
  }

  // 5. Initialize Tactical Juice System
  const juice = new JuiceSystem();
  if (typeof document !== 'undefined') {
    juice.init({
      container: document.getElementById('game-container'),
      floatingContainer: document.getElementById('floating-juice-container')
    });
  }

  // 6. Initialize Game Engine with persisted session / best score
  const bestScore = storage.getBestScore();
  const savedGame = storage.getActiveGame();

  const engine = new GameEngine();
  let restored = false;
  if (savedGame) {
    restored = engine.deserialize(savedGame);
  }
  if (!restored) {
    engine.restart();
  }
  if (bestScore > engine.highScore) {
    engine.highScore = bestScore;
  }

  // 7. Initialize Game View
  const view = new GameView({
    slideDuration: 120
  });
  view.init(engine.grid.size);
  view.render(engine.getState());

  // 8. Initialize Input Controller
  const input = new InputController();

  // Single Source of Truth: Wire directional movement with Sensory Juice
  input.onMove((direction) => {
    // Lazy AudioContext unlocking on gesture
    audio.init();

    const prevState = engine.grid.toArray();
    const result = engine.move(direction);

    if (result.moved) {
      input.lock(200);
      try {
        view.renderMove(prevState, direction, result, engine.getState());

        // Persist High Score and Active Session
        if (engine.highScore > storage.getBestScore()) {
          storage.saveBestScore(engine.highScore);
        }
        storage.saveActiveGame(engine.serialize());

        // 8.1 Web Audio Feedback
        if (result.isFirstWin) {
          audio.playWin();
        } else if (result.highestMerge > 0) {
          audio.playMerge(result.highestMerge);
        } else {
          audio.playMove();
        }

        // 8.2 Visual Juice & Particle Sparks
        const { merges } = calculateMoveTransitions(prevState, direction);

        // Merge sparks for high tiers (>= 128)
        for (const merge of merges) {
          if (merge.value >= 128) {
            const coords = juice.getCellCoordinates(merge.to.r, merge.to.c, engine.grid.size);
            const color = TILE_PARTICLE_COLORS[merge.value] || '#edc22e';
            const count = merge.value >= 2048 ? 25 : merge.value >= 1024 ? 22 : merge.value >= 512 ? 20 : merge.value >= 256 ? 18 : 15;
            particleCanvas.emitMergeSparks(coords.x, coords.y, color, count);
          }
        }

        // Victory Confetti Fountain upon reaching 2048
        if (result.isFirstWin) {
          particleCanvas.emitVictoryConfetti();
        }

        // Screen Micro-Shake
        if (result.isFirstWin || result.highestMerge >= 2048) {
          juice.triggerScreenShake(3); // Heavy
        } else if (result.highestMerge >= 1024) {
          juice.triggerScreenShake(2); // Medium
        } else if (result.highestMerge >= 512) {
          juice.triggerScreenShake(1); // Light
        }

        // Floating Combo Badges
        if (result.combos >= 2 && merges.length > 0) {
          const leadMerge = merges[0];
          const coords = juice.getCellCoordinates(leadMerge.to.r, leadMerge.to.c, engine.grid.size);
          const text = `+${result.scoreGained} COMBO x${result.combos}!`;
          juice.spawnFloatingScore(coords.x, coords.y, text, {
            tier: result.combos >= 3 ? 'mega' : 'combo'
          });
        } else if (result.scoreGained >= 128 && merges.length > 0) {
          const leadMerge = merges[0];
          const coords = juice.getCellCoordinates(leadMerge.to.r, leadMerge.to.c, engine.grid.size);
          juice.spawnFloatingScore(coords.x, coords.y, `+${result.scoreGained}`, {
            tier: 'normal'
          });
        }
      } catch (err) {
        console.warn('Move render error:', err);
      } finally {
        setTimeout(() => {
          input.unlock();
        }, 120);
      }
    } else {
      // Blocked move auditory feedback
      audio.playBlocked();
    }
  });

  // Single Source of Truth: Wire Action Callbacks (ZERO duplicate listeners)
  input.onUndo(() => {
    audio.init();
    if (engine.undo()) {
      view.render(engine.getState());
      particleCanvas.clear();
      juice.destroy();
      storage.saveActiveGame(engine.serialize());
    }
  });

  input.onRestart(() => {
    audio.init();
    engine.restart();
    view.render(engine.getState());
    particleCanvas.clear();
    juice.destroy();
    storage.saveActiveGame(engine.serialize());
  });

  input.onKeepGoing(() => {
    audio.init();
    engine.keepGoing();
    view.hideAllModals();
    storage.saveActiveGame(engine.serialize());
  });

  input.onThemeToggle(() => {
    const nextTheme = theme.cycleTheme();
    const selectTheme = typeof document !== 'undefined' ? document.getElementById('select-theme') : null;
    if (selectTheme) {
      selectTheme.value = nextTheme;
    }
  });

  // Audio UI & Volume Synchronization
  const audioIcon = typeof document !== 'undefined' ? document.getElementById('audio-icon') : null;
  const volumeSlider = typeof document !== 'undefined' ? document.getElementById('volume-slider') : null;
  const volumeValDisplay = typeof document !== 'undefined' ? document.getElementById('volume-val-display') : null;

  const updateVolumeUI = (vol, muted) => {
    const pct = Math.round(vol * 100);
    if (volumeSlider) {
      volumeSlider.value = pct;
    }
    if (volumeValDisplay) {
      volumeValDisplay.textContent = `${pct}%`;
    }
    if (audioIcon) {
      if (muted || vol === 0) {
        audioIcon.textContent = '🔇';
      } else if (vol < 0.4) {
        audioIcon.textContent = '🔉';
      } else {
        audioIcon.textContent = '🔊';
      }
    }
  };

  updateVolumeUI(storedVolume, isMuted);

  input.onAudioToggle(() => {
    audio.init();
    const nextMuted = !audio.isMuted();
    audio.setMuted(nextMuted);
    storage.saveAudioMuted(nextMuted);
    updateVolumeUI(audio.getVolume(), nextMuted);
    if (!nextMuted) {
      audio.playChime();
    }
  });

  input.onVolumeChange((vol) => {
    audio.init();
    if (audio.isMuted()) {
      audio.setMuted(false);
      storage.saveAudioMuted(false);
    }
    audio.setVolume(vol);
    if (storage.saveAudioVolume) {
      storage.saveAudioVolume(vol);
    }
    updateVolumeUI(vol, false);
    audio.playMove();
  });

  // Wire Theme selector dropdown
  if (typeof document !== 'undefined') {
    const selectTheme = document.getElementById('select-theme');
    if (selectTheme) {
      selectTheme.value = theme.getCurrentTheme();
      selectTheme.addEventListener('change', (e) => {
        theme.setTheme(e.target.value);
      });
      theme.onChange((t) => {
        selectTheme.value = t;
      });
    }

    // Window resize binding for Particle Canvas High-DPI sync
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        particleCanvas.resize();
      });
    }
  }

  // Bind input listeners to document
  input.bind(typeof document !== 'undefined' ? document : null);

  // 12. Local Launcher Heartbeat (auto-shutdown server when tab/window closes)
  if (typeof window !== 'undefined' && typeof fetch === 'function' && window.location.protocol.startsWith('http')) {
    const sendHeartbeat = () => {
      fetch('/api/heartbeat', { method: 'POST', keepalive: true }).catch(() => {});
    };
    sendHeartbeat();
    setInterval(sendHeartbeat, 1500);

    window.addEventListener('beforeunload', () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/leave');
        } else {
          fetch('/api/leave', { method: 'POST', keepalive: true }).catch(() => {});
        }
      } catch {}
    });
  }

  const app = { engine, view, input, theme, storage, audio, particleCanvas, juice };
  if (typeof window !== 'undefined') {
    window.__app = app;
  }
  return app;
}

// Auto-start when document is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
