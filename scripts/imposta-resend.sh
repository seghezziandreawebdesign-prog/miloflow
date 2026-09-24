#!/bin/sh
# Imposta i segreti di Resend per le Edge Functions senza mostrarli a schermo.
set -e
cd "$(dirname "$0")/.."
PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"

printf "Incolla la API key di Resend (non verrà mostrata) e premi Invio: "
stty -echo
read -r KEY
stty echo
echo
if [ -z "$KEY" ]; then echo "Nessuna chiave inserita."; exit 1; fi

echo "Mittente delle email, per esempio: Milo Flow <avvisi@tuodominio.it>"
echo "(lascia vuoto se non hai ancora un dominio verificato: userò onboarding@resend.dev)"
printf "Mittente: "
read -r FROM
if [ -z "$FROM" ]; then FROM="Milo Flow <onboarding@resend.dev>"; fi

npx supabase secrets set RESEND_API_KEY="$KEY" RESEND_FROM="$FROM" >/dev/null
echo "Fatto: chiave (${#KEY} caratteri) e mittente salvati nei segreti delle Edge Functions."
