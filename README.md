# 2048 Deluxe — Cyber & Retro Edition 🎮⚡

A premier, fully responsive, high-performance web implementation of the classic **2048** puzzle game, elevated with rich audiovisual feedback ("sensory juice"), multi-theme styling, procedural sound synthesis, 2D particle dynamics, and a robust deterministic core engine.

Built with **zero external dependencies** — 100% offline-ready, pure vanilla web standards (HTML5, CSS3, ES2022 JavaScript, Web Audio API, Canvas 2D), and fully verifiable via automated test suites.

---

## 🌟 Key Highlights & Features

### 1. Pure Headless Deterministic Core Engine (`src/engine/`)
- **Seeded Mulberry32 PRNG**: 32-bit pseudo-random number generator for deterministic 90%/10% spawns of 2s and 4s, enabling bit-for-bit replayability.
- **Single-Merge Physics**: Adheres strictly to the canonical 2048 compaction rule (e.g., `[2, 2, 2, 2]` slides into `[4, 4, 0, 0]` with left-precedence, never cascading in a single move).
- **Deep State Rollback (Undo Stack)**: Full multi-step undo restoring board matrices, scores, move counters, and PRNG states.
- **JSON Serialization & Invariant Guard**: Complete state import/export with strict validation (power-of-two matrix checks, bounds checks, schema invariants).

### 2. High-Performance Hardware-Accelerated UI (`src/ui/`)
- **CSS `translate3d` Transform Animations**: Smooth 120ms hardware-accelerated tile transitions without layout thrashing.
- **Dynamic Tile Typography**: Adaptive typography supporting numbers up to 65536 with automatic scaling.
- **Fluid & Responsive Layout**: Adapts seamlessly to ultra-wide desktop monitors, tablets, and mobile screens.
- **Accessible Multi-Input System**:
  - **Keyboard**: Arrow keys (`▲ ▼ ◀ ▶`) and `W / A / S / D`.
  - **Touch Gestures**: Vector-based swipe detection with minimum travel thresholds and duration clamping.
  - **On-Screen D-Pad**: High-contrast virtual directional pad for mobile or touch-friendly play.
  - **Quick Shortcuts**: `R` for New Game, `Ctrl + Z` for Undo, `M` for Sound Mute toggle.
- **Resilient Persistence**: Auto-saves active board sessions, all-time best scores, and theme preferences to `localStorage`, with transparent fallback to in-memory storage if storage is disabled or quota is exceeded.

### 3. Procedural Web Audio Engine (`src/audio/`)
- **Zero Audio Assets Required**: Pure procedural sound generation powered by Web Audio API synthesizers.
- **Harmonically Scaled Chimes**: Dynamic pitch synthesis based on merge tier ($f = 220 \times 2^{(k-1)/12}$).
- **Filtered Slide Whoosh**: Procedural white noise / soft bandpass sweep on tile translation.
- **Tactile Sound Effects**: Distinct low-frequency thud on blocked moves, and an arpeggiated fanfare on victory (2048).
- **Autoplay Compliance**: Lazy initialization on first user gesture with persistent mute state.

### 4. Visual "Sensory Juice" & Particle FX (`src/effects/`)
- **2D Canvas Particle Engine**: High-DPI canvas overlay producing energetic spark bursts on high-tier merges ($\ge 128$) with color-matched palette physics.
- **Victory Confetti Fountain**: Multicolored confetti explosion upon achieving the 2048 tile.
- **Screen Micro-Shake**: Three-tiered haptic screen impulse (light, medium, heavy) triggered by high-value merges.
- **Floating Combo Badges**: Dynamic combo multipliers (`+32`, `+64 COMBO x2!`) floating and fading with velocity damping.

### 5. Multi-Theme Switching
Select from four beautifully tuned visual aesthetics via the theme selector:
1. **Cyberpunk Neon**: High-contrast dark backdrop, electric cyan, vibrant magenta, and neon yellow accents.
2. **Retro CRT Amber**: Monochromatic phosphor amber on deep black with subtle scanline styling.
3. **Minimal OLED Dark**: Deep slate, neutral graphite, and clean modern minimalism.
4. **Pastel Warm**: Cozy cream background with warm terracotta, peach, and soft honey tones.

---

## 🕹️ Controls & Shortcuts

| Input Action | Primary Control | Secondary / Shortcut |
| :--- | :--- | :--- |
| **Slide Up** | `Arrow Up` (`▲`) | `W` / Swipe Up / D-pad `▲` |
| **Slide Down** | `Arrow Down` (`▼`) | `S` / Swipe Down / D-pad `▼` |
| **Slide Left** | `Arrow Left` (`◀`) | `A` / Swipe Left / D-pad `◀` |
| **Slide Right** | `Arrow Right` (`▶`) | `D` / Swipe Right / D-pad `▶` |
| **New Game** | "New Game" Button | Key `R` |
| **Undo Move** | "Undo" Button | `Ctrl + Z` |
| **Toggle Sound** | Sound Button (`🔊`/`🔇`) | Key `M` |
| **Cycle Theme** | Theme Dropdown | Key `T` |

---

## 📁 Architecture & Code Layout

The project follows a decoupled, discrete-event architecture:

```
E:\Gemini\Project1\
├── index.html                   # HTML5 Entry point (Zero CDN, local assets only)
├── style.css                    # CSS3 Theme variables, responsive layout, animations
├── package.json                 # Project descriptor with test and start scripts
├── server.py                    # Local HTTP server (Python standard library)
├── test.py                      # Cross-platform automated test launcher
├── test.bat                     # Windows batch test launcher (Node.js fallback finder)
├── verify_m2_headless.py        # Automated headless Chrome acceptance verification
├── README.md                    # Project documentation & operational manual
├── src/
│   ├── app.js                   # Application bootstrap & event bus coordinator
│   ├── engine/                  # Headless Core State Machine (Zero DOM dependencies)
│   │   ├── types.js             # Constants, enums (Direction, GameStatus), validators
│   │   ├── prng.js              # Mulberry32 32-bit deterministic PRNG
│   │   ├── grid.js              # 2D Grid compaction, rotation & single-merge physics
│   │   └── game_engine.js       # Discrete-event FSM, history undo stack & JSON codec
│   ├── ui/                      # Presentation & Interaction Layer
│   │   ├── view.js              # DOM rendering, sliding tile positions, modal dialogs
│   │   ├── input.js             # Keyboard, swipe & D-pad gesture normalization
│   │   ├── theme.js             # Theme controller & CSS variable binding
│   │   └── storage.js           # LocalStorage persistence & in-memory fallback
│   ├── audio/                   # Audio Synthesis Engine
│   │   └── audio_engine.js      # Procedural Web Audio synthesizer (oscillator & noise)
│   └── effects/                 # Sensory Juice Subsystem
│       ├── particle_canvas.js   # 2D canvas spark & victory confetti physics
│       └── juice.js             # Screen micro-shake & floating combo badges
└── tests/                       # Automated Test Suites
    ├── test_engine_unit.js      # Core engine, PRNG & compaction tests (TC 1.1 - TC 8.1)
    ├── test_ui_unit.js          # View, DOM, theme, input & storage tests
    └── test_juice_unit.js       # Web Audio synth, particles & juice tests
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.8+** (for serving static assets and running verification launchers)
- **Node.js 18+** (for running the automated unit test suite via native `node --test`)
- **Google Chrome** or **Microsoft Edge** (for running headless browser acceptance tests)

*Note: No `npm install` or third-party packages are required. Everything runs natively.*

### Step 1: Start the Local HTTP Server
Run the built-in zero-dependency Python server:
```bash
python server.py
```
Or specify a custom port:
```bash
python server.py 8080
```
Then open your browser and navigate to:
```
http://127.0.0.1:8000
```

---

## 🧪 Verification & Automated Testing

The project includes an end-to-end automated testing regimen with 100% deterministic assertion coverage.

### 1. Execute the Automated Unit & Integration Suites
Run all 107 automated test cases across all subsystems:

**Using Python test launcher (cross-platform):**
```bash
python test.py
```

**Using Windows batch runner:**
```cmd
cmd /c test.bat
```

**Using npm:**
```bash
npm test
```

#### Test Suite Summary:
- **`tests/test_engine_unit.js`**:
  - Enums, directions, and power-of-two invariants
  - Mulberry32 PRNG seed repeatability and 90/10 probability distribution
  - 1D line compaction and single-merge non-cascading rule
  - 2D grid compaction in all 4 cardinal directions
  - Victory (2048), GameOver deadlock detection, and keep-going mode
  - Deep undo stack (grid, score, move counter, and PRNG restoration)
  - JSON serialization and malformed payload rejection
  - 50-move deterministic golden match bit-for-bit replay
- **`tests/test_ui_unit.js`**:
  - Grid background cell creation (16 cells) and DOM tile rendering
  - Typography dynamic scaling classes for large numbers (up to 65536)
  - Modal dialog overlays (win / game over)
  - Keyboard event normalization and form input isolation
  - Touch/swipe vector mathematics, duration clamping, and threshold rejection
  - Multi-theme switching and cycle ordering
  - Storage persistence and quota-exceeded fallback
- **`tests/test_juice_unit.js`**:
  - AudioEngine lazy initialization, procedural chimes, and headless fallback
  - Particle canvas spark physics and victory confetti fountain
  - Screen micro-shake intensity levels and floating combo badges
  - Single-source-of-truth input dispatch without duplicate listeners

### 2. Execute Headless Browser Acceptance Verification
Verify live DOM rendering, CSS grid layout, initial tile spawn, theme initialization, and ensure zero unhandled console errors in a real Chromium browser engine:
```bash
python verify_m2_headless.py
```

Expected output:
```
[RUNNER] Detected Browser: ...\chrome.exe
[RUNNER] Local HTTP server running at http://127.0.0.1:8124/
✔ Assertion 1: Browser exited cleanly (code 0).
✔ Assertion 2: All 10 core DOM element IDs present in document.
✔ Assertion 3: Exactly 16 background grid cells rendered.
✔ Assertion 4: Board initialized with 2 active tiles.
✔ Assertion 5: Theme system applied 'data-theme' to root element.
✔ Assertion 6: Zero uncaught JavaScript errors or exceptions in browser console.
==================================================================
🎉 ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY VIA HEADLESS CHROME
==================================================================
```

---

## 🔒 Offline & Self-Containment Attestation

- **Zero npm dependencies**: No node_modules, bundlers, Babel, or Webpack required.
- **Zero CDN dependencies**: No external font stylesheets (Google Fonts), external JavaScript libraries, or external CDNs.
- **Zero external asset downloads**: Favicon is served via inline SVG data URI; all sound effects are procedurally synthesized via Web Audio oscillators; all graphics and particles are rendered via pure HTML/CSS and Canvas 2D.
- **100% Offline-Ready**: Works flawlessly in completely air-gapped or offline network environments.

---

## 📄 License
MIT License. Created for the Teamwork Multi-Agent Demonstration Project.
