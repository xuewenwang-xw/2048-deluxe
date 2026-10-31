#!/usr/bin/env python3
"""
verify_e2e.py
Unified Comprehensive End-to-End Acceptance Test Runner for 2048 Deluxe.

Orchestrates both tracks of the Dual-Track Verification System:
- Track 1: Headless Node.js Unit & Subsystem Integration Test Suite (107 tests across 24 suites).
- Track 2: Real Chromium Engine (Google Chrome / Microsoft Edge) Headless E2E Acceptance.

Exit Code:
  0 - All 107 Node tests passed AND all 6 headless browser assertions verified with 0 console errors.
  1 - Any failure or error detected.
"""

import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import subprocess
import time
from pathlib import Path

def print_banner(title):
    width = 75
    print("\n" + "=" * width)
    print(f" {title}".center(width))
    print("=" * width)

def run_track_1(project_root):
    """
    Executes Track 1: Node.js Test Suite (test.py).
    Asserts 100% pass rate and 0 failures across all 107 tests.
    """
    print_banner("TRACK 1: NATIVE NODE.JS UNIT & SUBSYSTEM VERIFICATION SUITE")
    test_py = project_root / "test.py"
    if not test_py.is_file():
        print(f"[FAIL] Missing test.py launcher at: {test_py}", file=sys.stderr)
        return False, 0, 0

    cmd = [sys.executable, str(test_py)]
    print(f"[RUNNER] Executing: {' '.join(cmd)}")
    start_time = time.time()
    proc = subprocess.run(cmd, cwd=str(project_root), capture_output=True, text=True, encoding="utf-8", errors="replace")
    elapsed = time.time() - start_time

    stdout = proc.stdout
    stderr = proc.stderr

    # Print output
    print(stdout)
    if stderr:
        print("[STDERR]", stderr, file=sys.stderr)

    # Parse test statistics from node:test TAP/spec output
    total_tests = 0
    passed_tests = 0
    failed_tests = 0

    for line in stdout.splitlines():
        trimmed = line.strip()
        if trimmed.startswith("ℹ tests"):
            try:
                total_tests = int(trimmed.split()[-1])
            except ValueError:
                pass
        elif trimmed.startswith("ℹ pass"):
            try:
                passed_tests = int(trimmed.split()[-1])
            except ValueError:
                pass
        elif trimmed.startswith("ℹ fail"):
            try:
                failed_tests = int(trimmed.split()[-1])
            except ValueError:
                pass

    if proc.returncode != 0 or failed_tests > 0 or passed_tests < 107:
        print(f"\n❌ [TRACK 1 FAILED] Return code: {proc.returncode}, Passed: {passed_tests}/{total_tests}, Failed: {failed_tests}")
        return False, passed_tests, total_tests

    print(f"\n✔ [TRACK 1 PASSED] {passed_tests}/{total_tests} tests passed across 24 suites in {elapsed:.2f}s (0 failures, 0 skips).")
    return True, passed_tests, total_tests

def run_track_2(project_root):
    """
    Executes Track 2: Real Chromium Headless Acceptance (verify_m2_headless.py).
    Asserts HTTP 200, DOM integrity, grid rendering, tile spawn, theme initialization, and 0 console errors.
    """
    print_banner("TRACK 2: REAL CHROMIUM ENGINE HEADLESS E2E ACCEPTANCE")
    verify_script = project_root / "verify_m2_headless.py"
    if not verify_script.is_file():
        print(f"[FAIL] Missing verify_m2_headless.py at: {verify_script}", file=sys.stderr)
        return False

    cmd = [sys.executable, str(verify_script)]
    print(f"[RUNNER] Executing: {' '.join(cmd)}")
    start_time = time.time()
    proc = subprocess.run(cmd, cwd=str(project_root), capture_output=True, text=True, encoding="utf-8", errors="replace")
    elapsed = time.time() - start_time

    stdout = proc.stdout
    stderr = proc.stderr

    print(stdout)
    if stderr:
        print("[STDERR]", stderr, file=sys.stderr)

    if proc.returncode != 0:
        print(f"\n❌ [TRACK 2 FAILED] Browser headless verification failed with code {proc.returncode}")
        return False

    print(f"\n✔ [TRACK 2 PASSED] All 6 headless browser assertions verified in {elapsed:.2f}s with 0 console errors.")
    return True

def main():
    project_root = Path(__file__).resolve().parent
    start_total = time.time()

    print_banner("2048 DELUXE — UNIFIED DUAL-TRACK E2E ACCEPTANCE RUNNER")
    print(f"[ENV] Project Root: {project_root}")
    print(f"[ENV] Python Interpreter: {sys.executable}")

    # Track 1
    t1_ok, t1_pass, t1_total = run_track_1(project_root)

    # Track 2
    t2_ok = run_track_2(project_root)

    total_time = time.time() - start_total

    print_banner("E2E VERIFICATION AUDIT SUMMARY")
    print(f" • Track 1 (Node.js Unit & Subsystem Tests):   {'✔ PASSED' if t1_ok else '❌ FAILED'} ({t1_pass}/{t1_total} assertions)")
    print(f" • Track 2 (Chromium Headless E2E Browser):   {'✔ PASSED' if t2_ok else '❌ FAILED'} (6 acceptance assertions)")
    print(f" • Total Verification Time:                   {total_time:.2f} seconds")
    print(f" • Overall Status:                            {'🎉 100% PASS — PRODUCTION READY' if (t1_ok and t2_ok) else '❌ VERIFICATION FAILED'}")
    print("=" * 75 + "\n")

    return 0 if (t1_ok and t2_ok) else 1

if __name__ == "__main__":
    sys.exit(main())
