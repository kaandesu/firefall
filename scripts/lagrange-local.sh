#!/usr/bin/env bash
# A local Lagrange server without Docker: its own small Postgres plus `lagrange serve`.
#   scripts/lagrange-local.sh up       start both, mint an API key, save it in web/.env.local
#   scripts/lagrange-local.sh down     stop both (data stays)
#   scripts/lagrange-local.sh status   what is running
#   scripts/lagrange-local.sh logs     follow the server log
#   scripts/lagrange-local.sh reset --yes   stop and delete all data (agents, tasks, the admin account)
# Needs: the `lagrange` binary and Postgres 14+ (pg_ctl, initdb), e.g. `brew install postgresql@16`.
# Data lives in .firefall/ at the repo root (gitignored). Nothing else on the machine is touched.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.firefall"
PGDATA="$DIR/pg"
ENVFILE="$ROOT/web/.env.local"
PORT="${LAGRANGE_PORT:-8080}"
PGPORT="${FIREFALL_PGPORT:-55432}"
URL="http://localhost:$PORT"
EMAIL="${LAGRANGE_ADMIN_EMAIL:-you@firefall.local}"
HANDLE="${LAGRANGE_ADMIN_HANDLE:-you}"
export DATABASE_URL="postgres://lagrange@127.0.0.1:$PGPORT/lagrange?sslmode=disable"

die() { echo "error: $*" >&2; exit 1; }

find_pg() {
  if command -v pg_ctl >/dev/null 2>&1; then dirname "$(command -v pg_ctl)"; return; fi
  for d in /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin /opt/homebrew/opt/postgresql/bin /usr/lib/postgresql/*/bin; do
    [ -x "$d/pg_ctl" ] && { echo "$d"; return; }
  done
  return 1
}

need() {
  command -v lagrange >/dev/null 2>&1 || die "the lagrange binary is not on your PATH.
  Install it: go install github.com/three-agent-problem/lagrange/cmd/lagrange@latest"
  PGBIN="$(find_pg)" || die "Postgres is not installed (no pg_ctl found).
  Install it: brew install postgresql@16     (Debian/Ubuntu: apt install postgresql)"
}

pg_up() { "$PGBIN/pg_isready" -q -h 127.0.0.1 -p "$PGPORT" 2>/dev/null; }
server_up() { curl -fs -o /dev/null -m 2 "$URL/" 2>/dev/null; }
key_ok() { [ -n "${1:-}" ] && [ "$(curl -s -o /dev/null -m 3 -w '%{http_code}' -H "Authorization: Bearer $1" "$URL/api/me")" = 200 ]; }

up() {
  need
  mkdir -p "$DIR"
  if [ ! -d "$PGDATA" ]; then
    echo "· creating the database in .firefall/pg"
    "$PGBIN/initdb" -D "$PGDATA" -U lagrange -A trust >/dev/null
  fi
  if ! pg_up; then
    # TCP on localhost only: no socket file, so a long repo path cannot break it.
    "$PGBIN/pg_ctl" -D "$PGDATA" -l "$DIR/postgres.log" -w \
      -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start >/dev/null \
      || die "Postgres did not start. See .firefall/postgres.log (is port $PGPORT taken? set FIREFALL_PGPORT)"
  fi
  "$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U lagrange lagrange 2>/dev/null || true

  if [ ! -f "$DIR/admin-password" ]; then
    (umask 077; head -c 10 /dev/urandom | od -An -tx1 | tr -d ' \n' >"$DIR/admin-password")
  fi
  if ! server_up; then
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then die "port $PORT is taken by something else. Run with LAGRANGE_PORT=8081"; fi
    LAGRANGE_ADDR="127.0.0.1:$PORT" LAGRANGE_PUBLIC_URL="$URL" \
      LAGRANGE_ADMIN_EMAIL="$EMAIL" LAGRANGE_ADMIN_PASSWORD="$(cat "$DIR/admin-password")" \
      LAGRANGE_ADMIN_HANDLE="$HANDLE" LAGRANGE_ADMIN_NAME="${LAGRANGE_ADMIN_NAME:-You}" \
      nohup lagrange serve >"$DIR/lagrange.log" 2>&1 &
    echo $! >"$DIR/lagrange.pid"
    for _ in $(seq 1 40); do server_up && break; sleep 0.25; done
    server_up || die "Lagrange did not start. See .firefall/lagrange.log"
  fi

  # Reuse the saved key while it still works on this server; otherwise mint one and save it.
  local key=""
  [ -f "$ENVFILE" ] && key="$(sed -n 's/^LAGRANGE_KEY=//p' "$ENVFILE" | tail -1)"
  if ! key_ok "$key" || [ "$(sed -n 's/^LAGRANGE_URL=//p' "$ENVFILE" 2>/dev/null | tail -1)" != "$URL" ]; then
    key="$(lagrange token --api-key --email "$EMAIL" --label firefall | tr -d '[:space:]')"
    key_ok "$key" || die "could not mint an API key"
    touch "$ENVFILE"
    grep -v -E '^LAGRANGE_(URL|KEY)=' "$ENVFILE" >"$ENVFILE.tmp" || true
    printf 'LAGRANGE_URL=%s\nLAGRANGE_KEY=%s\n' "$URL" "$key" >>"$ENVFILE.tmp"
    mv "$ENVFILE.tmp" "$ENVFILE"
    echo "· saved the server and a new API key in web/.env.local"
  fi

  cat <<EOF

Lagrange is running.
  web app    $URL          log in: $EMAIL / $(cat "$DIR/admin-password")
  FIREFALL   cd web && pnpm dev, then choose Connect (the server is already saved)
  an agent   lagrange tunnel --server $URL --address echo-1 --create --echo
             (run \`lagrange login --server $URL\` once first, so the tunnel can make its own token)
  stop       scripts/lagrange-local.sh down
EOF
}

down() {
  need
  if [ -f "$DIR/lagrange.pid" ] && kill "$(cat "$DIR/lagrange.pid")" 2>/dev/null; then echo "· stopped Lagrange"; fi
  rm -f "$DIR/lagrange.pid"
  if [ -d "$PGDATA" ] && pg_up; then "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null && echo "· stopped Postgres"; fi
}

status() {
  need
  server_up && echo "Lagrange   up    $URL" || echo "Lagrange   down"
  pg_up && echo "Postgres   up    127.0.0.1:$PGPORT (.firefall/pg)" || echo "Postgres   down"
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  status) status ;;
  logs) tail -f "$DIR/lagrange.log" ;;
  reset)
    [ "${2:-}" = "--yes" ] || die "this deletes every agent, task and account in .firefall. Run: $0 reset --yes"
    down
    rm -rf "$PGDATA" "$DIR/admin-password" "$DIR"/*.log
    echo "· deleted .firefall/pg. The key in web/.env.local no longer works; \`up\` makes a new one."
    ;;
  *) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
