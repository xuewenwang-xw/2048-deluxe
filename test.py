#!/usr/bin/env python3
"""
Cross-platform test launcher for 2048 Deluxe test suites.
Discovers Node.js in PATH or known fallback locations and executes native node:test suites.
"""
import sys
import shutil
import subprocess
from pathlib import Path

KNOWN_NODE_PATHS = [
    r"E:\codex\node.js\node.exe",
    r"C:\Users\24726\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe",
    r"C:\Program Files\nodejs\node.exe",
]

def find_node():
    node_in_path = shutil.which("node")
    if node_in_path:
        return node_in_path
    for candidate in KNOWN_NODE_PATHS:
        if Path(candidate).is_file():
            return candidate
    return None

def main():
    node_exe = find_node()
    if not node_exe:
        print("[ERROR] Node.js executable not found in PATH or candidate paths.", file=sys.stderr)
        return 1

    project_root = Path(__file__).resolve().parent
    default_test_files = [
        project_root / "tests" / "test_engine_unit.js",
        project_root / "tests" / "test_ui_unit.js",
        project_root / "tests" / "test_juice_unit.js"
    ]

    cmd = [node_exe, "--test"]
    if len(sys.argv) > 1:
        cmd.extend(sys.argv[1:])
    else:
        for tf in default_test_files:
            if not tf.is_file():
                print(f"[ERROR] Test file not found: {tf}", file=sys.stderr)
                return 1
            cmd.append(str(tf))

    print(f"[RUNNER] Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(project_root))
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())
