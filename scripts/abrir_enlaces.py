#!/usr/bin/env python3
"""Abre en el navegador todas las rutas verificadas de Black Coffee Administration."""

from __future__ import annotations

import sys
import time
import webbrowser
from pathlib import Path

ENLACES: list[tuple[str, str]] = [
    ("App — Login", "https://lasucursaldelcafe-droid.github.io/-black-coffee/"),
    ("App — Plataforma", "https://lasucursaldelcafe-droid.github.io/-black-coffee/app.html"),
    ("GitHub — Repositorio", "https://github.com/lasucursaldelcafe-droid/-black-coffee"),
    ("GitHub — Instalar secretos", "https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/instalar-secretos.yml"),
    ("GitHub — Desplegar Firebase", "https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/desplegar-firebase.yml"),
    ("GitHub — Todas las Actions", "https://github.com/lasucursaldelcafe-droid/-black-coffee/actions"),
    ("Firebase — Consola", "https://console.firebase.google.com/project/black-coffee-15ccc"),
    ("Firebase — Activar Blaze", "https://console.firebase.google.com/project/black-coffee-15ccc/usage/details"),
    ("Firebase — Firestore", "https://console.firebase.google.com/project/black-coffee-15ccc/firestore"),
    ("Firebase — Auth anónima", "https://console.firebase.google.com/project/black-coffee-15ccc/authentication/providers"),
    ("Resend — API keys", "https://resend.com/api-keys"),
]


def main() -> int:
    raiz = Path(__file__).resolve().parent.parent
    print("")
    print("=" * 50)
    print("  BLACK COFFEE — Abriendo enlaces")
    print("=" * 50)
    print(f"Carpeta del proyecto: {raiz}")
    print("")

    for i, (nombre, url) in enumerate(ENLACES, start=1):
        print(f"  [{i:02d}] {nombre}")
        print(f"       {url}")
        webbrowser.open(url)
        if i < len(ENLACES):
            time.sleep(0.8)

    print("")
    print("Listo. Revisa las pestañas del navegador.")
    print("Correo de prueba: ghostspecialtycoffee@gmail.com")
    print("")
    return 0


if __name__ == "__main__":
    sys.exit(main())
