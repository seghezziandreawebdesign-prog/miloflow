#!/bin/sh
# Chiede la service role key senza mostrarla a schermo e la scrive in .env.local.
set -e
cd "$(dirname "$0")/.."
printf "Incolla la service_role key (non verrà mostrata) e premi Invio: "
stty -echo
read -r KEY
stty echo
echo
if [ -z "$KEY" ]; then echo "Nessuna chiave inserita."; exit 1; fi
grep -v '^SUPABASE_SERVICE_ROLE_KEY=' .env.local > .env.local.tmp || true
printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$KEY" >> .env.local.tmp
mv .env.local.tmp .env.local
echo "Fatto: chiave salvata in .env.local (${#KEY} caratteri)."
