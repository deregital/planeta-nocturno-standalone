#!/usr/bin/env bash
# Levanta el stack simulado: la app multi-tenant real (next build + start) con
# Postgres en Docker y Neon, Mercado Pago, S3 y Resend simulados.
# Nada sale a servicios reales.
#
#   tests/stack/up.sh            # build (si hace falta), servicios y seed
#   tests/stack/up.sh --rebuild  # fuerza `next build`
#   tests/stack/up.sh --reseed   # borra las bases y vuelve a sembrar
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK="$ROOT/tests/stack"
RUN="$STACK/.run"
mkdir -p "$RUN/logs" "$RUN/pids"
cd "$ROOT"

REBUILD=0
RESEED=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --reseed) RESEED=1 ;;
  esac
done

secret() { openssl rand -hex 24; }

if [[ ! -f "$RUN/env.sh" ]]; then
  PG_PASSWORD="$(secret)"
  cat > "$RUN/env.sh" <<EOF
# Generado por up.sh. Sólo para el entorno local de prueba.
export STACK_RUN_DIR="$RUN"
export STACK_NEXT_PORT=3100
export STACK_MOCKS_PORT=55801
export STACK_MOCKS_URL=http://127.0.0.1:55801
export STACK_HTTPS_PORT=443
export STACK_PG_PORT=55800
export PG_BASE=postgres://postgres:$PG_PASSWORD@127.0.0.1:55800
export PG_PASSWORD=$PG_PASSWORD
export CONTROL_DATABASE_URL=postgres://postgres:$PG_PASSWORD@127.0.0.1:55800/control
export ROOT_DOMAIN=pn.test
export NEON_API_KEY=neon-stack-fake
export NEON_PROJECT_NAME=pn-stack
export CONTROL_BOOTSTRAP_USERNAME=control
export CONTROL_BOOTSTRAP_EMAIL=control@pn.test
export CONTROL_BOOTSTRAP_PASSWORD=$(secret)
export TENANT_SYSTEM_ADMIN_USERNAME=sistema
export TENANT_SYSTEM_ADMIN_EMAIL=sistema@pn.test
export TENANT_SYSTEM_ADMIN_PASSWORD=$(secret)
export STACK_USER_PASSWORD=$(openssl rand -hex 6)
export MULTI_TENANT_CONTACT_EMAIL=contacto@pn.test
export MULTI_TENANT_LANDING_NAME="PN Stack"
export MULTI_TENANT_LANDING_DESCRIPTION="Entorno de prueba del stack simulado"
export MULTI_TENANT_LANDING_COLOR="#7c3aed"
export AUTH_SECRET=$(secret)
export AUTH_TRUST_HOST=true
export BARCODE_SECRET=$(secret)
export CREDENTIALS_SIGNING_SECRET=$(secret)
export GUIDE_URL=https://guia.mock.test
export PLUTO_URL=https://pluto.mock.test
export RESEND_API_KEY=re_stack_fake
export RESEND_DOMAIN=pn.test
export RESEND_BASE_URL=http://127.0.0.1:55801/resend
export AWS_ACCESS_KEY_ID=stack-fake
export AWS_SECRET_ACCESS_KEY=stack-fake
export AWS_REGION=us-east-1
export NEXT_PUBLIC_S3_BUCKET_URL=https://planeta-nocturno.s3.us-east-1.amazonaws.com
export NEXT_TELEMETRY_DISABLED=1
EOF
  chmod 600 "$RUN/env.sh"
fi
# shellcheck disable=SC1091
source "$RUN/env.sh"

if [[ ! -f "$RUN/tls.crt" ]]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=pn.test" \
    -keyout "$RUN/tls.key" -out "$RUN/tls.crt" \
    -addext "subjectAltName=DNS:pn.test,DNS:*.pn.test,DNS:*.mock.test,DNS:planeta-nocturno.s3.us-east-1.amazonaws.com" \
    >/dev/null 2>&1
  chmod 600 "$RUN/tls.key"
fi

# ── Postgres ─────────────────────────────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -qx pn-stack-pg; then
  # Parado por un reinicio de Docker o de la Mac: se retoma con sus datos.
  docker start pn-stack-pg >/dev/null
else
  docker run -d --name pn-stack-pg -e POSTGRES_PASSWORD="$PG_PASSWORD" \
    -p 127.0.0.1:"$STACK_PG_PORT":5432 postgres:17-alpine \
    -c max_connections=400 -c shared_buffers=256MB >/dev/null
  RESEED=1
fi
until docker exec pn-stack-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done
sleep 1

psql_admin() { docker exec -i pn-stack-pg psql -U postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

if [[ "$RESEED" == 1 ]]; then
  for db in $(psql_admin -c "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1')"); do
    psql_admin -c "DROP DATABASE \"$db\" WITH (FORCE)"
  done
  rm -rf "$RUN/mails" "$RUN/mp" "$RUN/s3" "$RUN/qr" "$RUN/seed.json"
fi
if [[ -z "$(psql_admin -c "SELECT 1 FROM pg_database WHERE datname='control'")" ]]; then
  psql_admin -c "CREATE DATABASE control"
  npx drizzle-kit migrate --config=drizzle.control.config.ts >"$RUN/logs/control-migrate.log" 2>&1
  RESEED=1
fi

# ── Build ────────────────────────────────────────────────────────────────────
if [[ "$REBUILD" == 1 || ! -f "$ROOT/.next/BUILD_ID" ]]; then
  echo "next build (log en $RUN/logs/build.log)…"
  npx next build >"$RUN/logs/build.log" 2>&1
fi

# ── Procesos ─────────────────────────────────────────────────────────────────
stop_pid() {
  pkill -f "${2:-__none__}" 2>/dev/null || true
  local file="$RUN/pids/$1"
  if [[ -f "$file" ]]; then
    kill "$(cat "$file")" 2>/dev/null || true
    rm -f "$file"
  fi
}
wait_http() {
  local url="$1" tries=120
  until curl -sk -o /dev/null "$url"; do
    tries=$((tries - 1))
    [[ "$tries" == 0 ]] && { echo "no responde: $url" >&2; return 1; }
    sleep 0.5
  done
}

stop_pid mocks "$STACK/mocks.mjs"
nohup node "$STACK/mocks.mjs" >>"$RUN/logs/mocks.out" 2>&1 &
echo $! >"$RUN/pids/mocks"

stop_pid next "next start -p $STACK_NEXT_PORT"
NODE_OPTIONS="--import $STACK/preload.mjs --disable-warning=ExperimentalWarning" nohup node_modules/.bin/next start -p "$STACK_NEXT_PORT" \
  >>"$RUN/logs/next.log" 2>&1 &
echo $! >"$RUN/pids/next"

wait_http "http://127.0.0.1:$STACK_MOCKS_PORT/"
wait_http "http://127.0.0.1:$STACK_NEXT_PORT/"

if [[ "$RESEED" == 1 || ! -f "$RUN/seed.json" ]]; then
  echo "seed…"
  node --import tsx --import ./tests/load/register-phone-metadata.mjs "$STACK/seed.ts" \
    >"$RUN/logs/seed.log" 2>&1 || { tail -40 "$RUN/logs/seed.log"; exit 1; }
fi

echo "listo:"
echo "  plataforma principal  https://prueba.pn.test"
echo "  segunda plataforma    https://otra.pn.test"
echo "  panel de control      https://admin.pn.test"
echo "  mails                 https://mail.mock.test"
echo "  credenciales          $RUN/seed.json"
