#!/usr/bin/env python3
"""
package_electron.py
Automated Native Windows Standalone Packaging for 2048 Deluxe.
Builds a production-grade, standalone portable desktop release:
  dist/2048 Deluxe-win32-x64/2048 Deluxe.exe
"""

import sys
import os
import shutil
import subprocess
from pathlib import Path

# Ensure UTF-8 console output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

PROJECT_ROOT = Path(__file__).resolve().parent
ELECTRON_DIST = PROJECT_ROOT / "node_modules" / "electron" / "dist"
DIST_DIR = PROJECT_ROOT / "dist"
OUT_DIR = DIST_DIR / "2048 Deluxe-win32-x64"
RCEDIT_EXE = PROJECT_ROOT / "node_modules" / "rcedit" / "bin" / "rcedit-x64.exe"
ICON_ICO = PROJECT_ROOT / "assets" / "icon.ico"

def main():
    print("=" * 68)
    print("      🚀 2048 Deluxe — 正在构建原生独立桌面客户端 (Electron)")
    print("=" * 68)

    if not ELECTRON_DIST.is_dir():
        print(f"[错误] 未找到 Electron 二进制目录: {ELECTRON_DIST}", file=sys.stderr)
        return 1

    # 1. Prepare output directory
    print(f"[1/5] 清理并准备输出目录: {OUT_DIR}")
    if OUT_DIR.exists():
        try:
            shutil.rmtree(OUT_DIR)
            OUT_DIR.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            print("      [提示] 目标程序当前正在运行中，将仅就地更新资源...")
    else:
        OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 2. Copy Electron distribution binaries
    print("[2/5] 同步 Electron 桌面运行时核心组件...")
    for item in ELECTRON_DIST.iterdir():
        dest = OUT_DIR / item.name
        if not dest.exists():
            if item.is_dir():
                shutil.copytree(item, dest)
            else:
                shutil.copy2(item, dest)

    # 3. Rename executable
    old_exe = OUT_DIR / "electron.exe"
    target_exe = OUT_DIR / "2048 Deluxe.exe"
    if old_exe.exists() and not target_exe.exists():
        print(f"[3/5] 重命名主程序二进制 -> {target_exe.name}")
        old_exe.rename(target_exe)
    else:
        print("[3/5] 主程序二进制已就绪。")

    # 4. Package application source into resources/app
    print("[4/5] 打包游戏业务逻辑、音效引擎、主题与页面资源...")
    resources_dir = OUT_DIR / "resources"
    default_app = resources_dir / "default_app.asar"
    if default_app.exists():
        default_app.unlink()

    app_dir = resources_dir / "app"
    app_dir.mkdir(parents=True, exist_ok=True)

    # Copy frontend assets
    shutil.copy2(PROJECT_ROOT / "index.html", app_dir / "index.html")
    shutil.copy2(PROJECT_ROOT / "manifest.json", app_dir / "manifest.json")
    shutil.copy2(PROJECT_ROOT / "sw.js", app_dir / "sw.js")
    shutil.copy2(PROJECT_ROOT / "style.css", app_dir / "style.css")
    shutil.copy2(PROJECT_ROOT / "main.cjs", app_dir / "main.cjs")
    shutil.copy2(PROJECT_ROOT / "package.json", app_dir / "package.json")
    shutil.copytree(PROJECT_ROOT / "src", app_dir / "src", dirs_exist_ok=True)
    shutil.copytree(PROJECT_ROOT / "assets", app_dir / "assets", dirs_exist_ok=True)

    # 5. Inject game icon & Windows PE metadata
    if RCEDIT_EXE.is_file() and ICON_ICO.is_file():
        print("[5/5] 注入游戏黄金方块图标及 Windows PE 元数据...")
        rcedit_cmd = [
            str(RCEDIT_EXE),
            str(target_exe),
            "--set-icon", str(ICON_ICO),
            "--set-version-string", "ProductName", "2048 Deluxe",
            "--set-version-string", "FileDescription", "2048 Deluxe — Cyber & Retro Edition",
            "--set-version-string", "CompanyName", "Antigravity",
            "--set-version-string", "OriginalFilename", "2048 Deluxe.exe",
            "--set-file-version", "1.0.0",
            "--set-product-version", "1.0.0"
        ]
        res = subprocess.run(rcedit_cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print("      ✔ 专属游戏图标与元数据注入成功！")
        else:
            print(f"      ⚠ 注入元数据提示: {res.stderr.strip()}")
    else:
        print("[5/5] 跳过图标注入 (缺少 rcedit 或 icon.ico)")

    print("\n" + "=" * 68)
    print(" 🎉 打包大功告成！独立桌面应用程序已生成：")
    print(f" 📂 目录: {OUT_DIR}")
    print(f" 🎮 可执行文件: {target_exe}")
    print("=" * 68)
    print(" 说明: 您可以将整个 '2048 Deluxe-win32-x64' 文件夹直接移动到任何电脑，")
    print("       无需 Python，无需 Node.js，无需配置任何环境，双击 '2048 Deluxe.exe' 即可开玩！\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
