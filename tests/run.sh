#!/usr/bin/env bash
# Corre las pruebas por nivel (detalle en tests/README.md):
#
#   tests/run.sh rapido    # sin nada levantado (~30 s): lint, tipos y unitarias
#   tests/run.sh stack     # lo que necesita el stack simulado (~2 min); lo levanta si hace falta
#   tests/run.sh pr        # rapido + stack: lo que corre GitHub en cada PR
#   tests/run.sh release   # pr + recorrido de desbordes en celular (~7 min más)
#
# Sigue aunque falle un paso y al final lista los que fallaron (sale con 1).
# STACK_RESEED=1 vuelve a sembrar el stack antes (por ejemplo, si se acabaron
# los códigos de invitación que usa el golden path).
# Sin `set -u`: el bash de macOS (3.2) da por no definida una lista vacía.
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LEVEL="${1:-rapido}"
FAILED=()

step() {
  local name="$1"
  shift
  local start=$SECONDS
  echo
  echo "▶ $name"
  if "$@"; then
    echo "✓ $name ($((SECONDS - start)) s)"
  else
    echo "✗ $name ($((SECONDS - start)) s)"
    FAILED+=("$name")
  fi
}

rapido() {
  step "lint" npx eslint .
  step "tipos" npx tsc --noEmit
  step "reglas de ESLint propias" npm run -s test:eslint-rule
  step "resolución de plataforma" npm run -s test:instance-resolution
  step "variables de entorno" npm run -s test:environment
  step "videos de ayuda" npm run -s test:guide-videos
  step "importación de usuarios" npm run -s test:user-import
  step "cuenta regresiva de la reserva" npm run -s test:hold-countdown
}

levantar_stack() {
  if [[ "${STACK_RESEED:-0}" == 1 ]]; then
    tests/stack/up.sh --reseed
  else
    tests/stack/up.sh
  fi
}

stack() {
  step "levantar el stack" levantar_stack
  if [[ " ${FAILED[*]} " == *" levantar el stack "* ]]; then
    echo "El stack no levantó: revisá tests/stack/.run/logs/"
    return
  fi
  # shellcheck disable=SC1091
  source tests/stack/.run/env.sh
  step "scanner (servidor y motor del celular)" \
    env LOAD_ADMIN_DATABASE_URL="$PG_BASE/postgres" npm run -s test:scanner
  step "regresiones del enjambre" npm run -s test:regressions
  step "golden path (e2e)" npm run -s test:e2e
  step "aislamiento entre productoras" aislamiento
}

# test:isolation levanta su propio `next dev`, que escribe en .next y rompería la
# compilación del stack: mientras corre, la del stack queda aparte y después vuelve.
aislamiento() {
  local guardada="$ROOT/.next-stack-guardada"
  rm -rf "$guardada"
  [[ -d "$ROOT/.next" ]] && mv "$ROOT/.next" "$guardada"
  restaurar() {
    if [[ -d "$guardada" ]]; then
      rm -rf "$ROOT/.next"
      mv "$guardada" "$ROOT/.next"
    fi
  }
  trap restaurar EXIT INT TERM
  env NODE_OPTIONS="--import $ROOT/tests/stack/preload.mjs" npm run -s test:isolation
  local code=$?
  restaurar
  trap - EXIT INT TERM
  return $code
}

case "$LEVEL" in
  rapido) rapido ;;
  stack) stack ;;
  pr)
    rapido
    stack
    ;;
  release)
    rapido
    stack
    step "desbordes en celular" npm run -s test:mobile
    ;;
  *)
    echo "Nivel desconocido: $LEVEL (rapido, stack, pr o release)"
    exit 2
    ;;
esac

echo
if ((${#FAILED[@]})); then
  echo "Fallaron: ${FAILED[*]}"
  exit 1
fi
echo "Todo bien ($LEVEL, $SECONDS s)"
