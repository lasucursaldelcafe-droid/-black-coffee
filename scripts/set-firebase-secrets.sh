#!/usr/bin/env bash
# Ejecutar en tu máquina con: gh auth login
# Requiere permisos de admin en el repo para gestionar secrets.

set -euo pipefail

REPO="${1:-lasucursaldelcafe-droid/-black-coffee}"

gh secret set FIREBASE_API_KEY --repo "$REPO" --body "AIzaSyCWh3Yf-ZkvZ-ey8Rm_sXSDUA6EC02C9GU"
gh secret set FIREBASE_AUTH_DOMAIN --repo "$REPO" --body "black-coffee-15ccc.firebaseapp.com"
gh secret set FIREBASE_PROJECT_ID --repo "$REPO" --body "black-coffee-15ccc"
gh secret set FIREBASE_STORAGE_BUCKET --repo "$REPO" --body "black-coffee-15ccc.firebasestorage.app"
gh secret set FIREBASE_MESSAGING_SENDER_ID --repo "$REPO" --body "1091720202058"
gh secret set FIREBASE_APP_ID --repo "$REPO" --body "1:1091720202058:web:3dacbf4df3b787c34c23b3"

echo "Secrets configurados. Verifica con: gh secret list --repo $REPO"
