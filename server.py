#!/usr/bin/env python3
"""
server.py
Local HTTP static server for 2048 Deluxe.
Serves current workspace directory on http://127.0.0.1:8000 with proper MIME types.
"""
import sys
import http.server
import socketserver
from pathlib import Path

class DeluxeHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parent), **kwargs)

    def end_headers(self):
        # Enable CORS and disable caching for local development and testing
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_POST(self):
        if self.path in ('/api/heartbeat', '/api/leave'):
            if hasattr(self.server, 'on_heartbeat'):
                self.server.on_heartbeat(self.path)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return
        self.send_error(404, "Not Found")

    def do_GET(self):
        if self.path in ('/api/heartbeat', '/api/leave'):
            if hasattr(self.server, 'on_heartbeat'):
                self.server.on_heartbeat(self.path)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return
        super().do_GET()

DeluxeHTTPRequestHandler.extensions_map.update({
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
})

def run_server(port=8000, host="0.0.0.0"):
    socketserver.TCPServer.allow_reuse_address = True
    server_address = (host, port)
    try:
        with socketserver.TCPServer(server_address, DeluxeHTTPRequestHandler) as httpd:
            print(f"[SERVER] 2048 Deluxe local server started at http://{host}:{port}/")
            print(f"[SERVER] Serving directory: {Path(__file__).resolve().parent}")
            print("[SERVER] Press Ctrl+C to stop the server.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER] Server stopped by user.")
    except OSError as err:
        print(f"[SERVER ERROR] Failed to bind to {host}:{port}: {err}", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    sys.exit(run_server(port))
