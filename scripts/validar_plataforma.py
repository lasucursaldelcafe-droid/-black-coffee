#!/usr/bin/env python3
"""Valida HTML, CSS, JavaScript y assets de Black Coffee Administration."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_CSS = [
    "css/variables.css",
    "css/base.css",
    "css/components.css",
    "css/layout.css",
    "css/mobile.css",
]

REQUIRED_HTML = ["index.html", "app.html"]

REQUIRED_JS_FROM_APP = [
    "js/storage.js",
    "js/sync-shared.js",
    "js/gas-config.js",
    "js/cloud-sync-config.js",
    "js/firebase-http-config.js",
    "js/firebase-config.js",
    "js/gas-sync.js",
    "js/firebase-http-sync.js",
    "js/firebase-sync.js",
    "js/cloud-sync.js",
    "js/sync-hub.js",
    "js/auth.js",
    "js/auth-biometric.js",
    "js/audit.js",
    "js/data.js",
    "js/setupWizard.js",
    "js/backup.js",
    "js/costs.js",
    "js/coffees.js",
    "js/clients.js",
    "js/suppliers.js",
    "js/inventory.js",
    "js/sales.js",
    "js/ghostCatalog.js",
    "js/import.js",
    "js/quotations.js",
    "js/reports.js",
    "js/pdf.js",
    "js/notifications.js",
    "js/email.js",
    "js/costEngine.js",
    "js/glossary.js",
    "js/workflow.js",
    "js/adminConfig.js",
    "js/pwa.js",
    "js/app.js",
]


def ok(message: str) -> None:
    print(f"  ✓ {message}")


def fail(message: str) -> None:
    print(f"  ✗ {message}", file=sys.stderr)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def extract_script_srcs(html: str) -> list[str]:
    return re.findall(r'<script[^>]+src="([^"?]+)', html)


def extract_stylesheets(html: str) -> list[str]:
    return re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"?]+)', html)


def validate_files_exist(relative_paths: list[str], label: str) -> list[str]:
    errors: list[str] = []
    for rel in relative_paths:
        path = ROOT / rel
        if path.is_file():
            ok(f"{label}: {rel}")
        else:
            errors.append(f"Falta {label}: {rel}")
            fail(f"{label}: {rel}")
    return errors


def validate_html_css() -> list[str]:
    errors: list[str] = []
    for page in REQUIRED_HTML:
        path = ROOT / page
        if not path.is_file():
            errors.append(f"Falta HTML: {page}")
            fail(f"HTML: {page}")
            continue
        html = read_text(path)
        linked_css = extract_stylesheets(html)
        for css in REQUIRED_CSS:
            if css not in linked_css:
                errors.append(f"{page} no enlaza {css}")
                fail(f"{page} → falta CSS {css}")
            else:
                ok(f"{page} enlaza {css}")
    return errors


def validate_app_scripts() -> list[str]:
    errors: list[str] = []
    app_path = ROOT / "app.html"
    if not app_path.is_file():
        return ["Falta app.html"]
    html = read_text(app_path)
    scripts = extract_script_srcs(html)
    for js in REQUIRED_JS_FROM_APP:
        if js not in scripts:
            errors.append(f"app.html no carga {js}")
            fail(f"app.html → falta JS {js}")
        elif not (ROOT / js).is_file():
            errors.append(f"Script referenciado pero no existe: {js}")
            fail(f"JS inexistente: {js}")
        else:
            ok(f"app.html carga {js}")
    return errors


def validate_sw_precache() -> list[str]:
    errors: list[str] = []
    sw_path = ROOT / "sw.js"
    if not sw_path.is_file():
        return ["Falta sw.js"]
    sw = read_text(sw_path)
    for css in REQUIRED_CSS:
        if css.replace("css/", "./css/") not in sw and f"'{css}'" not in sw and f"'./{css}'" not in sw:
            if f"./{css}" not in sw:
                errors.append(f"sw.js no precachea {css}")
                fail(f"sw.js → falta precache {css}")
            else:
                ok(f"sw.js precachea {css}")
        else:
            ok(f"sw.js precachea {css}")
    return errors


def validate_ghost_catalog_java() -> list[str]:
    errors: list[str] = []
    catalog_path = ROOT / "test-data/ghost-catalog.json"
    if not catalog_path.is_file():
        errors.append("Falta test-data/ghost-catalog.json")
        fail("Catálogo Ghost")
        return errors
    data = json.loads(read_text(catalog_path))
    java_entries = [e for e in data if str(e.get("name", "")).lower() == "java"]
    if java_entries:
        ok(f"Catálogo Ghost incluye café Java ({len(java_entries)} entrada(s))")
    else:
        errors.append("Catálogo Ghost sin entrada Java")
        fail("Catálogo Ghost sin café Java")
    return errors


def main() -> int:
    print("\n=== Validación BCA — HTML · CSS · JavaScript · Python ===\n")
    print(f"Raíz: {ROOT}\n")

    all_errors: list[str] = []
    all_errors.extend(validate_files_exist(REQUIRED_CSS, "CSS"))
    all_errors.extend(validate_html_css())
    all_errors.extend(validate_app_scripts())
    all_errors.extend(validate_files_exist(REQUIRED_JS_FROM_APP, "JS"))
    all_errors.extend(validate_sw_precache())
    all_errors.extend(validate_ghost_catalog_java())

    print("")
    if all_errors:
        print(f"Resultado: {len(all_errors)} error(es)\n")
        return 1

    print("Resultado: plataforma OK (HTML, CSS, JavaScript, catálogo)\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
