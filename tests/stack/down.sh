#!/usr/bin/env bash
# Frena el stack simulado. Con --purge también borra el contenedor de Postgres
# y el estado (.run): la próxima vez up.sh siembra desde cero.
set -uo pipefail

STACK="$(cd "$(dirname "$0")" && pwd)"
RUN="$STACK/.run"

for name in next mocks; do
  if [[ -f "$RUN/pids/$name" ]]; then
    kill "$(cat "$RUN/pids/$name")" 2>/dev/null
    rm -f "$RUN/pids/$name"
  fi
done
pkill -f "next start -p ${STACK_NEXT_PORT:-3100}" 2>/dev/null
pkill -f "$STACK/mocks.mjs" 2>/dev/null
pkill -f "$STACK/browser.mjs daemon" 2>/dev/null
pkill -f "$STACK/browser.mjs chromium-server" 2>/dev/null
rm -rf "$RUN/browser/chromium.ws" "$RUN/browser/chromium.lock"

if [[ "${1:-}" == "--purge" ]]; then
  docker rm -f pn-stack-pg >/dev/null 2>&1
  rm -rf "$RUN"
fi
echo "stack frenado"
