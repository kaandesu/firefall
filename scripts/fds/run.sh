#!/usr/bin/env bash
# Generate and run the Apollo CM-012 FDS cases (1 g on the pad and µg) with NIST FDS.
#   scripts/fds/run.sh            # both cases, T_END=30
#   T_END=2 scripts/fds/run.sh 1g # a quick check of one case
# FDS: github.com/firemodels/fds releases, macOS installer extracted to ~/FDS (x86_64, runs under Rosetta).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB="$ROOT/web"
OUT="$WEB/public/data/fds/apollo-cm012"
FDS="${FDS:-$HOME/FDS/bin/fds_openmp}"
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-4}"
CASES="${*:-1g ug}"

[ -x "$FDS" ] || { echo "FDS not found at $FDS"; exit 1; }
[ -n "${SKIP_GEN:-}" ] || (cd "$WEB" && node --import ./scripts/register.mjs scripts/gen-fds.ts "$OUT")

for c in $CASES; do
  dir="$OUT/$c"; chid="apollo_cm012_$c"
  echo "── running $chid (OMP $OMP_NUM_THREADS threads)"
  start=$(date +%s)
  (cd "$dir" && "$FDS" "$chid.fds" > fds.log 2>&1) || { echo "FDS failed, see $dir/$chid.out"; tail -20 "$dir/fds.log"; exit 1; }
  echo "   done in $(( $(date +%s) - start )) s"
  echo $(( $(date +%s) - start )) > "$dir/runtime_s.txt"
  grep -E "STOP|ERROR" "$dir/$chid.out" | tail -2 || true
done

# Summarise both runs for the app (manifest.json: version, run time, cells, peak HRR / pressure, alarm times).
(cd "$WEB" && node --import ./scripts/register.mjs scripts/fds-manifest.ts "$OUT")
