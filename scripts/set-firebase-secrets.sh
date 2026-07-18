#!/usr/bin/env bash
# Ejecutar en tu máquina después de: gh auth login
# Requiere permisos de admin en el repositorio.

set -euo pipefail

REPO="${1:-lasucursaldelcafe-droid/-black-coffee}"

: "${FIREBASE_API_KEY:?Define FIREBASE_API_KEY}"
: "${FIREBASE_AUTH_DOMAIN:?Define FIREBASE_AUTH_DOMAIN}"
: "${FIREBASE_PROJECT_ID:?Define FIREBASE_PROJECT_ID}"
: "${FIREBASE_STORAGE_BUCKET:?Define FIREBASE_STORAGE_BUCKET}"
: "${FIREBASE_MESSAGING_SENDER_ID:?Define FIREBASE_MESSAGING_SENDER_ID}"
: "${FIREBASE_APP_ID:?Define FIREBASE_APP_ID}"

gh secret set FIREBASE_API_KEY --repo "$REPO" --body "$FIREBASE_API_KEY"
gh secret set FIREBASE_AUTH_DOMAIN --repo "$REPO" --body "$FIREBASE_AUTH_DOMAIN"
gh secret set FIREBASE_PROJECT_ID --repo "$REPO" --body "$FIREBASE_PROJECT_ID"
gh secret set FIREBASE_STORAGE_BUCKET --repo "$REPO" --body "$FIREBASE_STORAGE_BUCKET"
gh secret set FIREBASE_MESSAGING_SENDER_ID --repo "$REPO" --body "$FIREBASE_MESSAGING_SENDER_ID"
gh secret set FIREBASE_APP_ID --repo "$REPO" --body "$FIREBASE_APP_ID"

echo "Listo. Verifica con: gh secret list --repo $REPO"
