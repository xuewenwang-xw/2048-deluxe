/**
 * @file test_engine_unit.js
 * Comprehensive Milestone 1 Engine Verification Suite for 2048 Deluxe.
 * Uses native node:test and node:assert/strict with zero external dependencies.
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Direction, GameStatus, DEFAULT_GRID_SIZE, isValidDirection, isValidTileValue, isPowerOfTwo } from '../src/engine/types.js';
import { PRNG } from '../src/engine/prng.js';
import { Grid, compactLine, getVectorCoordinate } from '../src/engine/grid.js';
import { GameEngine } from '../src/engine/game_engine.js';

describe('Milestone 1: 2048 Deluxe Core Engine Verification Suite', () => {

  // =========================================================================
  // SUITE 1: Types & Invariants
  // =========================================================================
  describe('Suite 1: Types, Enums and Invariant Validators', () => {
    it('TC1.1: Direction enum is frozen and defines 4 cardinal directions', () => {
      assert.equal(Direction.UP, 'UP');
      assert.equal(Direction.DOWN, 'DOWN');
      assert.equal(Direction.LEFT, 'LEFT');
      assert.equal(Direction.RIGHT, 'RIGHT');
      assert.ok(Object.isFrozen(Direction));
      assert.equal(isValidDirection('UP'), true);
      assert.equal(isValidDirection('DOWN'), true);
      assert.equal(isValidDirection('LEFT'), true);
      assert.equal(isValidDirection('RIGHT'), true);
      assert.equal(isValidDirection('NORTH'), false);
      assert.equal(isValidDirection(null), false);
      assert.equal(isValidDirection(undefined), false);
      assert.equal(isValidDirection(123), false);
    });

    it('TC1.2: GameStatus enum is frozen and defines 3 game states', () => {
      assert.equal(GameStatus.PLAYING, 'PLAYING');
      assert.equal(GameStatus.WON, 'WON');
      assert.equal(GameStatus.GAMEOVER, 'GAMEOVER');
      assert.ok(Object.isFrozen(GameStatus));
    });

    it('TC1.3: Power-of-two and tile value validators function strictly', () => {
      assert.equal(isPowerOfTwo(1), true);
      assert.equal(isPowerOfTwo(2), true);
      assert.equal(isPowerOfTwo(4), true);
      assert.equal(isPowerOfTwo(1024), true);
      assert.equal(isPowerOfTwo(2048), true);
      assert.equal(isPowerOfTwo(0), false);
      assert.equal(isPowerOfTwo(3), false);
      assert.equal(isPowerOfTwo(-4), false);
      assert.equal(isPowerOfTwo(2.5), false);
      assert.equal(isPowerOfTwo('4'), false);

      assert.equal(isValidTileValue(0), true);
      assert.equal(isValidTileValue(2), true);
      assert.equal(isValidTileValue(4), true);
      assert.equal(isValidTileValue(2048), true);
      assert.equal(isValidTileValue(3), false);
      assert.equal(isValidTileValue(-2), false);
      assert.equal(isValidTileValue(null), false);
    });
  });

  // =========================================================================
  // SUITE 2: Mulberry32 PRNG Determinism & Spawner Distribution
  // =========================================================================
  describe('Suite 2: Mulberry32 PRNG Determinism & Distribution', () => {
    it('TC2.1: Identical seeds produce bit-for-bit identical sequences', () => {
      const p1 = new PRNG(42);
      const p2 = new PRNG(42);
      for (let i = 0; i < 100; i++) {
        assert.equal(p1.next(), p2.next(), `PRNG sequence mismatch at step ${i}`);
      }
    });

    it('TC2.2: Negative and non-integer seed normalization via unsigned 32-bit cast', () => {
      const p1 = new PRNG(-1);
      assert.equal(p1.getSeed(), 4294967295);

      const p2 = new PRNG('deluxe_seed');
      assert.ok(Number.isInteger(p2.getSeed()));
      assert.ok(p2.getSeed() >= 0 && p2.getSeed() <= 4294967295);
    });

    it('TC2.3: Generates floats strictly within [0, 1)', () => {
      const p = new PRNG(99999);
      for (let i = 0; i < 1000; i++) {
        const val = p.next();
        assert.ok(val >= 0 && val < 1, `Value ${val} out of bounds [0, 1)`);
      }
    });

    it('TC2.4: nextInt produces uniform integer ranges', () => {
      const p = new PRNG(55555);
      const counts = new Array(16).fill(0);
      for (let i = 0; i < 3200; i++) {
        const val = p.nextInt(16);
        assert.ok(Number.isInteger(val));
        assert.ok(val >= 0 && val < 16);
        counts[val]++;
      }
      for (let i = 0; i < 16; i++) {
        assert.ok(counts[i] > 100, `Bin ${i} starvation with count ${counts[i]}`);
      }

      // 2-argument signature
      for (let i = 0; i < 50; i++) {
        const v = p.nextInt(10, 20);
        assert.ok(v >= 10 && v < 20);
      }
    });

    it('TC2.5: PRNG state capture and restoration guarantees perfect stream rewind', () => {
      const p = new PRNG(12345);
      for (let i = 0; i < 10; i++) p.next(); // advance 10 steps

      const snapshot = p.getState();
      const seq1 = [p.next(), p.next(), p.next(), p.next(), p.next()];

      p.setState(snapshot);
      const seq2 = [p.next(), p.next(), p.next(), p.next(), p.next()];

      assert.deepEqual(seq1, seq2, 'Restored state must generate identical sequence');
    });

    it('TC2.6: 90/10 tile value distribution holds over large sample', () => {
      const p = new PRNG(777);
      let count2 = 0;
      let count4 = 0;
      const N = 2000;
      for (let i = 0; i < N; i++) {
        const val = p.next() < 0.9 ? 2 : 4;
        if (val === 2) count2++;
        else count4++;
      }
      const ratio2 = count2 / N;
      assert.ok(ratio2 >= 0.87 && ratio2 <= 0.93, `Ratio of 2s was ${ratio2}, expected ~0.90`);
    });
  });

  // =========================================================================
  // SUITE 3: 1D Line Compaction & Single-Merge Physics
  // =========================================================================
  describe('Suite 3: 1D Line Compaction & Single-Merge Physics', () => {
    it('TC3.1: Empty row results in no movement and zero score', () => {
      const res = compactLine([0, 0, 0, 0]);
      assert.deepEqual(res.line, [0, 0, 0, 0]);
      assert.deepEqual(res.result, [0, 0, 0, 0]);
      assert.equal(res.score, 0);
      assert.equal(res.scoreGain, 0);
      assert.equal(res.hasChanged, false);
      assert.equal(res.highestMerge, 0);
      assert.equal(res.combos, 0);
    });

    it('TC3.2: Single tile compaction removes leading gaps without score', () => {
      const res = compactLine([0, 2, 0, 0]);
      assert.deepEqual(res.line, [2, 0, 0, 0]);
      assert.equal(res.score, 0);
      assert.equal(res.hasChanged, true);
    });

    it('TC3.3: Complex split compaction [2, 0, 2, 4] -> [4, 4, 0, 0]', () => {
      const res = compactLine([2, 0, 2, 4]);
      assert.deepEqual(res.line, [4, 4, 0, 0]);
      assert.equal(res.score, 4);
      assert.equal(res.highestMerge, 4);
      assert.equal(res.hasChanged, true);
    });

    it('TC3.4: Trailing split compaction [4, 2, 2, 0] -> [4, 4, 0, 0]', () => {
      const res = compactLine([4, 2, 2, 0]);
      assert.deepEqual(res.line, [4, 4, 0, 0]);
      assert.equal(res.score, 4);
      assert.equal(res.highestMerge, 4);
      assert.equal(res.hasChanged, true);
    });

    it('TC3.5: Single-merge rule: [2, 2, 2, 2] -> [4, 4, 0, 0] (no cascade)', () => {
      const res = compactLine([2, 2, 2, 2]);
      assert.deepEqual(res.line, [4, 4, 0, 0]);
      assert.equal(res.score, 8);
      assert.equal(res.highestMerge, 4);
      assert.equal(res.combos, 2);
      assert.equal(res.hasChanged, true);
    });

    it('TC3.6: Single-merge rule: [4, 4, 4, 4] -> [8, 8, 0, 0]', () => {
      const res = compactLine([4, 4, 4, 4]);
      assert.deepEqual(res.line, [8, 8, 0, 0]);
      assert.equal(res.score, 16);
      assert.equal(res.highestMerge, 8);
      assert.equal(res.combos, 2);
    });

    it('TC3.7: Left-precedence on 3 equal tiles: [2, 2, 2, 0] -> [4, 2, 0, 0]', () => {
      const res = compactLine([2, 2, 2, 0]);
      assert.deepEqual(res.line, [4, 2, 0, 0]);
      assert.equal(res.score, 4);
      assert.equal(res.combos, 1);
    });

    it('TC3.8: Dual pair merge: [2, 2, 4, 4] -> [4, 8, 0, 0]', () => {
      const res = compactLine([2, 2, 4, 4]);
      assert.deepEqual(res.line, [4, 8, 0, 0]);
      assert.equal(res.score, 12);
      assert.equal(res.highestMerge, 8);
      assert.equal(res.combos, 2);
    });

    it('TC3.9: Edge separated pair merge: [2, 0, 0, 2] -> [4, 0, 0, 0]', () => {
      const res = compactLine([2, 0, 0, 2]);
      assert.deepEqual(res.line, [4, 0, 0, 0]);
      assert.equal(res.score, 4);
      assert.equal(res.hasChanged, true);
    });

    it('TC3.10: Non-merging full row is unchanged', () => {
      const res = compactLine([2, 4, 8, 16]);
      assert.deepEqual(res.line, [2, 4, 8, 16]);
      assert.equal(res.score, 0);
      assert.equal(res.hasChanged, false);
    });

    it('TC3.11: Large exponent merge: [1024, 1024, 2048, 2048] -> [2048, 4096, 0, 0]', () => {
      const res = compactLine([1024, 1024, 2048, 2048]);
      assert.deepEqual(res.line, [2048, 4096, 0, 0]);
      assert.equal(res.score, 6144);
      assert.equal(res.highestMerge, 4096);
      assert.equal(res.combos, 2);
    });

    it('TC3.12: Static Grid.compactLine works identically to standalone compactLine', () => {
      const r1 = compactLine([2, 2, 0, 0]);
      const r2 = Grid.compactLine([2, 2, 0, 0]);
      assert.deepEqual(r1, r2);
    });
  });

  // =========================================================================
  // SUITE 4: 2D Grid Directional Compaction
  // =========================================================================
  describe('Suite 4: 2D Grid Directional Compaction (All 4 Directions)', () => {
    const makeReferenceBoard = () => [
      [2, 0, 0, 2],
      [4, 4, 0, 0],
      [2, 2, 2, 2],
      [0, 8, 8, 0]
    ];

    it('TC4.1: Slide LEFT correctly transforms all rows', () => {
      const grid = new Grid(4);
      grid.load(makeReferenceBoard());

      const res = grid.slide(Direction.LEFT);
      assert.equal(res.moved, true);
      assert.equal(res.scoreGained, 36); // 4 + 8 + 8 + 16 = 36
      assert.equal(res.highestMerge, 16);
      assert.equal(res.combos, 5);
      assert.deepEqual(grid.toArray(), [
        [4, 0, 0, 0],
        [8, 0, 0, 0],
        [4, 4, 0, 0],
        [16, 0, 0, 0]
      ]);
    });

    it('TC4.2: Slide RIGHT correctly transforms all rows to right edge', () => {
      const grid = new Grid(4);
      grid.load(makeReferenceBoard());

      const res = grid.slide(Direction.RIGHT);
      assert.equal(res.moved, true);
      assert.equal(res.scoreGained, 36);
      assert.equal(res.highestMerge, 16);
      assert.deepEqual(grid.toArray(), [
        [0, 0, 0, 4],
        [0, 0, 0, 8],
        [0, 0, 4, 4],
        [0, 0, 0, 16]
      ]);
    });

    it('TC4.3: Slide UP correctly transforms columns upwards', () => {
      const grid = new Grid(4);
      grid.load(makeReferenceBoard());

      const res = grid.slide(Direction.UP);
      assert.equal(res.moved, true);
      assert.equal(res.scoreGained, 4); // col 3: 2 + 2 = 4
      assert.equal(res.highestMerge, 4);
      assert.deepEqual(grid.toArray(), [
        [2, 4, 2, 4],
        [4, 2, 8, 0],
        [2, 8, 0, 0],
        [0, 0, 0, 0]
      ]);
    });

    it('TC4.4: Slide DOWN correctly transforms columns downwards', () => {
      const grid = new Grid(4);
      grid.load(makeReferenceBoard());

      const res = grid.slide(Direction.DOWN);
      assert.equal(res.moved, true);
      assert.equal(res.scoreGained, 4); // col 3: 2 + 2 = 4
      assert.deepEqual(grid.toArray(), [
        [0, 0, 0, 0],
        [2, 4, 0, 0],
        [4, 2, 2, 0],
        [2, 8, 8, 4]
      ]);
    });

    it('TC4.5: Board invariant validation correctly catches inconsistencies', () => {
      const grid = new Grid(4);
      const valid = grid.validateInvariants();
      assert.equal(valid.valid, true);
      assert.equal(valid.errors.length, 0);

      // Mutate cells array with invalid tile value
      grid.cells[0][0] = 7;
      const invalid = grid.validateInvariants();
      assert.equal(invalid.valid, false);
      assert.ok(invalid.errors.some(e => e.includes('invalid tile value')));
    });

    it('TC4.6: Flexible grid sizes (3x3, 5x5) work smoothly', () => {
      const grid3 = new Grid(3);
      grid3.set(0, 0, 2);
      grid3.set(0, 1, 2);
      grid3.slide(Direction.LEFT);
      assert.equal(grid3.get(0, 0), 4);
      assert.equal(grid3.get(0, 1), 0);

      const grid5 = new Grid(5);
      grid5.set(0, 0, 2);
      grid5.set(0, 4, 2);
      grid5.slide(Direction.LEFT);
      assert.equal(grid5.get(0, 0), 4);
    });
  });

  // =========================================================================
  // SUITE 5: Boundary Scenarios & FSM Transitions
  // =========================================================================
  describe('Suite 5: Boundary Scenarios & FSM Transitions', () => {
    it('TC5.1: Deadlock detection triggers GAMEOVER', () => {
      const engine = new GameEngine({ size: 4 });
      engine.grid.load([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2]
      ]);
      assert.equal(engine.grid.hasAvailableMoves(), false);
      assert.equal(engine.grid.isFull(), true);

      const res = engine.move(Direction.LEFT);
      assert.equal(res.moved, false);
      assert.equal(engine.getState().status, GameStatus.GAMEOVER);
      assert.equal(engine.isGameOver(), true);
    });

    it('TC5.2: Full grid with single available merge can move and spawn', () => {
      const engine = new GameEngine({ size: 4, seed: 100 });
      engine.grid.load([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 8, 8, 2] // row 3 cols 1&2 (8, 8) can merge horizontally only
      ]);
      assert.equal(engine.grid.canMove(Direction.LEFT), true);
      assert.equal(engine.grid.canMove(Direction.RIGHT), true);
      assert.equal(engine.grid.canMove(Direction.UP), false);
      assert.equal(engine.grid.canMove(Direction.DOWN), false);

      const moveRes = engine.move(Direction.LEFT);
      assert.equal(moveRes.moved, true);
      assert.equal(moveRes.scoreGained, 16);
      assert.ok(moveRes.spawnedTile !== null);
      assert.equal(engine.getState().status, GameStatus.PLAYING);
    });

    it('TC5.3: Victory detection triggers WON state on 2048 tile merge', () => {
      const engine = new GameEngine({ size: 4 });
      engine.grid.load([
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]);
      const res = engine.move(Direction.LEFT);
      assert.equal(res.moved, true);
      assert.equal(res.highestMerge, 2048);
      assert.equal(engine.getState().status, GameStatus.WON);
      assert.equal(res.isFirstWin, true);
      assert.equal(engine.isWon(), true);
    });

    it('TC5.4: keepGoing allows continued play past 2048', () => {
      const engine = new GameEngine({ size: 4 });
      engine.grid.load([
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]);
      engine.move(Direction.LEFT);
      assert.equal(engine.getState().status, GameStatus.WON);

      engine.keepGoing();
      assert.equal(engine.getState().status, GameStatus.PLAYING);

      // Subsequent 2048 merge should NOT revert status back to WON
      engine.grid.load([
        [2048, 2048, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]);
      const res = engine.move(Direction.LEFT);
      assert.equal(res.moved, true);
      assert.equal(engine.getState().status, GameStatus.PLAYING);
      assert.equal(res.isFirstWin, false);
    });

    it('TC5.5: Move invariant guard: blocked move causes zero mutation', () => {
      const engine = new GameEngine({ size: 4 });
      engine.grid.load([
        [2, 4, 8, 16],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]);
      const initialScore = engine.getScore();
      const initialMoves = engine.getMoveCount();

      // Moving LEFT on an already compact top row with empty other rows is blocked
      assert.equal(engine.canMove(Direction.LEFT), false);
      const res = engine.move(Direction.LEFT);
      assert.equal(res.moved, false);
      assert.equal(engine.getScore(), initialScore);
      assert.equal(engine.getMoveCount(), initialMoves);
      assert.equal(engine.canUndo(), false);
    });
  });

  // =========================================================================
  // SUITE 6: Undo Stack & Deep State Rollback
  // =========================================================================
  describe('Suite 6: Undo Stack & Deep State Rollback', () => {
    it('TC6.1: canUndo returns false initially, undo returns false on empty stack', () => {
      const engine = new GameEngine({ size: 4 });
      assert.equal(engine.canUndo(), false);
      assert.equal(engine.undo(), false);
    });

    it('TC6.2: Undo cleanly rolls back grid, score, and move count', () => {
      const engine = new GameEngine({ size: 4, seed: 42 });
      const initialGrid = engine.getState().grid.map(row => [...row]);
      const initialScore = engine.getState().score;
      const initialMoves = engine.getState().moveCount;

      const moveRes = engine.move(Direction.UP);
      assert.equal(moveRes.moved, true);
      assert.equal(engine.canUndo(), true);

      const undoRes = engine.undo();
      assert.equal(undoRes, true);
      assert.deepEqual(engine.getState().grid, initialGrid);
      assert.equal(engine.getState().score, initialScore);
      assert.equal(engine.getState().moveCount, initialMoves);
    });

    it('TC6.3: Undo restores PRNG state for bit-for-bit replay repeatability', () => {
      const engine = new GameEngine({ size: 4, seed: 12345 });
      const moveRes1 = engine.move(Direction.UP);
      assert.equal(moveRes1.moved, true);
      const spawned1 = { ...moveRes1.spawnedTile };

      // Undo the move
      assert.equal(engine.undo(), true);

      // Repeat identical move
      const moveRes2 = engine.move(Direction.UP);
      assert.equal(moveRes2.moved, true);
      const spawned2 = { ...moveRes2.spawnedTile };

      assert.deepEqual(spawned1, spawned2, 'Spawned tile after undo must match original tile exactly');
    });

    it('TC6.4: Undo restores active state from GAMEOVER', () => {
      const engine = new GameEngine({ size: 4, seed: 99 });
      engine.grid.load([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 2, 4]
      ]);

      const moveRes = engine.move(Direction.LEFT);
      assert.equal(moveRes.moved, true);
      assert.equal(engine.canUndo(), true);

      const undoRes = engine.undo();
      assert.equal(undoRes, true);
      assert.equal(engine.getState().status, GameStatus.PLAYING);
    });

    it('TC6.5: Undo after victory reverts status from WON to PLAYING', () => {
      const engine = new GameEngine({ size: 4 });
      engine.grid.load([
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]);
      engine.move(Direction.LEFT);
      assert.equal(engine.getState().status, GameStatus.WON);

      assert.equal(engine.undo(), true);
      assert.equal(engine.getState().status, GameStatus.PLAYING);
      assert.equal(engine.grid.get(0, 0), 1024);
      assert.equal(engine.grid.get(0, 1), 1024);
    });

    it('TC6.6: Consecutive undos respect move count and capacity clamping', () => {
      const engine = new GameEngine({ size: 4, seed: 111, maxUndo: 3 });
      engine.grid.load([
        [2, 0, 2, 0],
        [0, 4, 0, 4],
        [8, 0, 8, 0],
        [0, 16, 0, 16]
      ]);

      // Execute 4 moves
      engine.move(Direction.LEFT);
      engine.move(Direction.RIGHT);
      engine.move(Direction.LEFT);
      engine.move(Direction.RIGHT);

      // Max undo is clamped at 3
      assert.equal(engine.undo(), true);
      assert.equal(engine.undo(), true);
      assert.equal(engine.undo(), true);
      assert.equal(engine.undo(), false);
    });
  });

  // =========================================================================
  // SUITE 7: JSON State Serialization & Deserialization
  // =========================================================================
  describe('Suite 7: JSON State Serialization & Deserialization', () => {
    it('TC7.1: Lossless roundtrip preserves full match state and undo history', () => {
      const engine = new GameEngine({ size: 4, seed: 888 });
      engine.move(Direction.LEFT);
      engine.move(Direction.UP);

      const serialized = engine.serialize();
      assert.equal(typeof serialized, 'string');

      const engine2 = new GameEngine({ size: 4 });
      const success = engine2.deserialize(serialized);
      assert.equal(success, true);

      assert.deepEqual(engine2.getState().grid, engine.getState().grid);
      assert.equal(engine2.getState().score, engine.getState().score);
      assert.equal(engine2.getState().highScore, engine.getState().highScore);
      assert.equal(engine2.getState().moveCount, engine.getState().moveCount);
      assert.equal(engine2.getState().status, engine.getState().status);
      assert.equal(engine2.canUndo(), true);

      // Verify undo works on deserialized instance
      assert.equal(engine2.undo(), true);
      assert.equal(engine.undo(), true);
      assert.deepEqual(engine2.getState().grid, engine.getState().grid);
    });

    it('TC7.2: Deserialization safely rejects malformed or corrupted JSON', () => {
      const engine = new GameEngine({ size: 4 });
      assert.equal(engine.deserialize('invalid json string'), false);
      assert.equal(engine.deserialize('{}'), false);
      assert.equal(engine.deserialize(JSON.stringify({ size: 4, grid: 'not an array' })), false);
    });

    it('TC7.3: Deserialization rejects non-power-of-two tile values', () => {
      const engine = new GameEngine({ size: 4 });
      const corrupted = {
        version: '1.0.0',
        size: 4,
        score: 0,
        highScore: 0,
        moveCount: 0,
        status: 'PLAYING',
        wonAcknowledged: false,
        prngState: 12345,
        grid: [
          [2, 3, 0, 0], // 3 is not a power of 2
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]
      };
      assert.equal(engine.deserialize(JSON.stringify(corrupted)), false);
    });

    it('TC7.4: Deserialization rejects dimension mismatches', () => {
      const engine = new GameEngine({ size: 4 });
      const corrupted = {
        version: '1.0.0',
        size: 4,
        score: 0,
        highScore: 0,
        moveCount: 0,
        status: 'PLAYING',
        wonAcknowledged: false,
        prngState: 12345,
        grid: [
          [2, 0, 0], // 3 elements instead of 4
          [0, 0, 0],
          [0, 0, 0]
        ]
      };
      assert.equal(engine.deserialize(JSON.stringify(corrupted)), false);
    });

    it('TC7.5: Failed deserialization leaves active state completely intact', () => {
      const engine = new GameEngine({ size: 4, seed: 777 });
      const originalState = engine.getState();

      const failed = engine.deserialize('{"version": "invalid"}');
      assert.equal(failed, false);
      assert.deepEqual(engine.getState(), originalState);
    });
  });

  // =========================================================================
  // SUITE 8: 50-Move Deterministic Golden Replay
  // =========================================================================
  describe('Suite 8: 50-Move Deterministic Golden Match Replay', () => {
    it('TC8.1: 50-move seeded game produces bit-for-bit identical final state', () => {
      const runMatch = (seed) => {
        const engine = new GameEngine({ size: 4, seed });
        const directions = [
          Direction.UP, Direction.LEFT, Direction.DOWN, Direction.RIGHT,
          Direction.UP, Direction.LEFT, Direction.DOWN, Direction.RIGHT,
          Direction.UP, Direction.LEFT, Direction.UP, Direction.LEFT,
          Direction.DOWN, Direction.RIGHT, Direction.DOWN, Direction.RIGHT,
          Direction.UP, Direction.LEFT, Direction.DOWN, Direction.RIGHT,
          Direction.UP, Direction.UP, Direction.LEFT, Direction.LEFT,
          Direction.DOWN, Direction.DOWN, Direction.RIGHT, Direction.RIGHT,
          Direction.UP, Direction.LEFT, Direction.DOWN, Direction.RIGHT,
          Direction.UP, Direction.RIGHT, Direction.DOWN, Direction.LEFT,
          Direction.UP, Direction.RIGHT, Direction.DOWN, Direction.LEFT,
          Direction.UP, Direction.LEFT, Direction.DOWN, Direction.RIGHT,
          Direction.UP, Direction.LEFT, Direction.DOWN, Direction.RIGHT,
          Direction.UP, Direction.LEFT
        ];

        for (const dir of directions) {
          if (engine.isGameOver()) break;
          engine.move(dir);
        }

        return {
          grid: engine.getGrid(),
          score: engine.getScore(),
          moveCount: engine.getMoveCount()
        };
      };

      const match1 = runMatch(2048);
      const match2 = runMatch(2048);

      assert.deepEqual(match1, match2, 'Two matches with identical seed must yield identical final state');
      assert.ok(match1.score > 0, 'Match must have accumulated score');
      assert.ok(match1.moveCount > 10, 'Match must have executed moves');
    });
  });
});
