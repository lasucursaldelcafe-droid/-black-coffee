#!/usr/bin/env python3
"""Servidor HTTP local para probar HTML/CSS/JavaScript antes de desplegar."""

from __future__ import annotations

import http.server
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> None:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"BCA local → http://localhost:{PORT}/")
        print(f"Login      → http://localhost:{PORT}/index.html")
        print(f"App        → http://localhost:{PORT}/app.html")
        print("Ctrl+C para detener\n")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
