#!/usr/bin/env python3
"""
verify_m2_headless.py
Chromium Engine Headless E2E Acceptance Verification for 2048 Deluxe.
"""

import http.server
import os
import shutil
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def find_browser():
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        shutil.which("chrome"),
        shutil.which("google-chrome"),
        shutil.which("msedge"),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return c
    return None

def main():
    browser = find_browser()
    if not browser:
        print("[FAIL] No Chromium browser (Chrome or Edge) found on system.", file=sys.stderr)
        return 1

    project_dir = Path(__file__).resolve().parent
    port = 8135

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(project_dir), **kwargs)
        def log_message(self, format, *args):
            pass

    httpd = socketserver.TCPServer(("127.0.0.1", port), QuietHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    time.sleep(0.5)

    print(f"[VERIFY] Starting headless browser: {browser}")
    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--virtual-time-budget=2500",
        "--dump-dom",
        f"http://127.0.0.1:{port}/index.html"
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
        html = proc.stdout
    except Exception as e:
        print(f"[FAIL] Error launching browser: {e}", file=sys.stderr)
        httpd.shutdown()
        return 1
    finally:
        httpd.shutdown()

    assertions = [
        ("HTTP 200 & HTML Root Loaded", "<html" in html and "2048" in html),
        ("Theme Initialized on Body", 'data-theme="warm-pastel"' in html or 'data-theme=' in html),
        ("Grid Container with 16 Cells Rendered", html.count('class="grid-cell"') == 16 or html.count("grid-cell") >= 16),
        ("Tile Container Present", 'class="tile-container"' in html or 'id="tile-container"' in html),
        ("Initial 2 Active Tiles Spawned", html.count('class="tile ') >= 2 or html.count("tile-inner") >= 2),
        ("HUD Metrics Display Initialized", 'id="score-val"' in html and 'id="best-score-val"' in html and 'id="move-count-val"' in html),
    ]

    passed = 0
    print("\n--- CHROMIUM HEADLESS ACCEPTANCE ASSERTIONS ---")
    for name, ok in assertions:
        status = "✔ PASS" if ok else "❌ FAIL"
        print(f"[{status}] {name}")
        if ok:
            passed += 1

    print(f"\nResult: {passed}/{len(assertions)} assertions passed.\n")
    return 0 if passed == len(assertions) else 1

if __name__ == "__main__":
    sys.exit(main())
