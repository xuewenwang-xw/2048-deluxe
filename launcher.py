#!/usr/bin/env python3
"""
launcher.py
One-click smart launcher for 2048 Deluxe.
- Selects an available local port (starting at 8124).
- Serves static files with auto-caching prevention and CORS support.
- Automatically opens the game in the user's default browser.
- Monitors heartbeat pings: automatically shuts down and exits when the webpage/browser is closed.
"""

import sys
import os
import time
import socket
import threading
import webbrowser
from pathlib import Path

# Ensure UTF-8 console output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import http.server
import socketserver
from server import DeluxeHTTPRequestHandler

def find_available_port(start_port=8124, max_attempts=20):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('223.5.5.5', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

class LauncherServer(socketserver.TCPServer):
    allow_reuse_address = True
    def __init__(self, server_address, RequestHandlerClass):
        super().__init__(server_address, RequestHandlerClass)
        self.last_heartbeat = time.time()
        self.has_connected = False
        self.is_leaving = False
        self.leave_time = 0.0

    def on_heartbeat(self, path):
        now = time.time()
        if path == '/api/leave':
            self.is_leaving = True
            self.leave_time = now
        else:
            self.has_connected = True
            self.is_leaving = False
            self.last_heartbeat = now

def monitor_loop(server, shutdown_event):
    start_time = time.time()
    while not shutdown_event.is_set():
        time.sleep(0.5)
        now = time.time()
        if server.has_connected:
            # If a leave beacon was received and no heartbeat followed within 2.5s (not an F5 refresh)
            if server.is_leaving and (now - server.leave_time >= 2.5):
                print("\n[退出通知] 检测到游戏标签页已关闭，正在自动退出程序...")
                server.shutdown()
                break
            # If heartbeat stopped for more than 4.5s
            if now - server.last_heartbeat >= 4.5:
                print("\n[退出通知] 检测到游戏网页已关闭，正在自动退出程序...")
                server.shutdown()
                break
        else:
            # Browser initial launch timeout (30 seconds)
            if now - start_time > 30.0:
                print("\n[超时提示] 30秒内未检测到网页连接，程序自动退出...")
                server.shutdown()
                break

def main():
    port = find_available_port(8124)
    server_address = ("0.0.0.0", port)
    game_url = f"http://localhost:{port}/"
    lan_ip = get_local_ip()
    lan_url = f"http://{lan_ip}:{port}/"

    try:
        httpd = LauncherServer(server_address, DeluxeHTTPRequestHandler)
    except OSError as err:
        print(f"[错误] 无法绑定到端口 {port}: {err}", file=sys.stderr)
        return 1

    shutdown_event = threading.Event()
    monitor_thread = threading.Thread(target=monitor_loop, args=(httpd, shutdown_event), daemon=True)
    monitor_thread.start()

    banner_width = 70
    print("=" * banner_width)
    print("           2048 豪华版 (2048 Deluxe) — 一键启动器")
    print("=" * banner_width)
    print(f" [电脑浏览器] {game_url}")
    print(f" [手机局域网] {lan_url}")
    print("              (手机与电脑连同一 Wi-Fi，打开此网址即可在手机上玩)")
    print(" [手机 PWA]   手机打开后点击菜单「添加到主屏幕 / 添加到桌面」，")
    print("              即可在手机桌面上生成独立黄金游戏图标，随时离线畅玩！")
    print(" [自动退出]   当所有网页窗口关闭后，本程序将自动退出并关闭窗口。")
    print("=" * banner_width)
    print("\n游戏运行中，祝您游戏愉快！(如需手动退出可按 Ctrl+C)\n")

    # Launch user's default browser
    try:
        webbrowser.open(game_url)
    except Exception as e:
        print(f"[提示] 自动唤起浏览器失败，请手动在浏览器打开: {game_url} ({e})")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[退出] 用户手动中止服务。")
    finally:
        shutdown_event.set()
        httpd.server_close()

    return 0

if __name__ == "__main__":
    sys.exit(main())
