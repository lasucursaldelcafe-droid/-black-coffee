#!/usr/bin/env bash
# Publica firestore.rules en el proyecto black-coffee-15ccc.
# Uso: FIREBASE_TOKEN="$(npx firebase login:ci)" ./scripts/deploy-firestore-rules.sh

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${FIREBASE_PROJECT_ID:-black-coffee-15ccc}"
TOKEN="${FIREBASE_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: Falta FIREBASE_TOKEN."
  echo ""
  echo "  1. npx firebase login:ci"
  echo "  2. export FIREBASE_TOKEN=\"el_token_copiado\""
  echo "  3. ./scripts/deploy-firestore-rules.sh"
  exit 1
fi

echo "Desplegando reglas Firestore en $PROJECT..."
npx firebase-tools deploy --only firestore:rules --project "$PROJECT" --token "$TOKEN"

echo ""
echo "Verificando acceso (auth anónima + lectura/escritura)..."
npm install firebase@11 --no-save --silent 2>/dev/null || true
node scripts/test-firestore-access.mjs

echo ""
echo "Listo. Recargue la app (Ctrl+Shift+R) y use Configuración → Forzar sincronización."
