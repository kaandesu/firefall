#!/usr/bin/env bash
# Turn the raw PSI downloads in data/PSI-98 and data/PSI-25 into the small files the app and the tools server use.
#   scripts/prep-psi.sh            both
#   scripts/prep-psi.sh psi-98     Saffire-I F1C2 frames  → web/public/data/psi-98/ (WebP + index.json)
#   scripts/prep-psi.sh psi-25     BASS-II stills + report → web/public/data/psi-25/ (WebP + index.json + report.json)
# The raw folders are gitignored (hundreds of MB); only these outputs are committed.
# Needs cwebp (brew install webp). The NEF stills and the PDF text use macOS tools (sips, PDFKit); on Linux
# they need ImageMagick with raw support and pdftotext (poppler).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/web/public/data"
WHAT="${*:-psi-98 psi-25}"
command -v cwebp >/dev/null || { echo "cwebp not found: brew install webp" >&2; exit 1; }

psi98() {
  local src="$ROOT/data/PSI-98/rawdata/reduced-gravity/SAFFIRE_I_F1C2/SAFFIRE_I_F1C2_JPEG_Mapped" out="$OUT/psi-98" every=6
  [ -d "$src" ] || { echo "skip psi-98: $src not found"; return; }
  rm -rf "$out"; mkdir -p "$out"
  local files=() f
  while IFS= read -r f; do files+=("$f"); done < <(ls "$src" | grep -E '^Mapped_F1C2-[0-9]+\.jpeg$' | sort)
  local total=${#files[@]} first=${files[0]} last=${files[$((${#files[@]} - 1))]}
  local t0=${first//[^0-9]/}; t0=${t0#12}   # "F1C2" contributes the digits 1 2
  local n=0 rows=""
  for ((i = 0; i < total; i += every)); do
    f=${files[$i]}
    local ms=${f//[^0-9]/}; ms=${ms#12}
    local name; name=$(printf 'f%03d.webp' "$n")
    cwebp -quiet -q 55 -resize 640 0 "$src/$f" -o "$out/$name"
    rows+="${rows:+,}{\"t\":$(awk "BEGIN{printf \"%.3f\", ($ms-$t0)/1000}"),\"src\":\"$name\"}"
    n=$((n + 1))
  done
  local lms=${last//[^0-9]/}; lms=${lms#12}
  cat >"$out/index.json" <<EOF
{"study":"saffire-1","psi":"PSI-98","series":"F1C2","what":"Pre-test flow visualisation for sample 1, camera 2. The sample card is lit but not burning: this series shows the air flow over it before ignition, not a flame.","captured":"$(date -u -r $((t0 / 1000)) +%Y-%m-%dT%H:%M:%SZ)","frames_total":$total,"duration_s":$(awk "BEGIN{printf \"%.1f\", ($lms-$t0)/1000}"),"every":$every,"width":640,"source":"data/PSI-98/rawdata/reduced-gravity/SAFFIRE_I_F1C2/SAFFIRE_I_F1C2_JPEG_Mapped (distortion-corrected frames)","frames":[$rows]}
EOF
  echo "psi-98: $n of $total frames → $(du -sh "$out" | cut -f1)"
}

psi25() {
  local src="$ROOT/data/PSI-25" out="$OUT/psi-25"
  [ -d "$src" ] || { echo "skip psi-25: $src not found"; return; }
  rm -rf "$out"; mkdir -p "$out"
  local tmp; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' RETURN
  local rows="" n=0 f
  for f in "$src"/rawdata/reduced-gravity/raw_images/*.NEF; do
    local id; id=$(basename "$f" .NEF)
    if command -v sips >/dev/null; then sips -s format jpeg -Z 1600 "$f" --out "$tmp/$id.jpg" >/dev/null 2>&1
    else magick "$f" -resize 1600x1600 "$tmp/$id.jpg"; fi
    cwebp -quiet -q 68 "$tmp/$id.jpg" -o "$out/$id.webp"
    rows+="${rows:+,}{\"id\":\"$id\",\"src\":\"$id.webp\"}"
    n=$((n + 1))
  done
  echo "{\"study\":\"bass-ii\",\"psi\":\"PSI-25\",\"what\":\"Crew photographs of BASS-II burns in the Microgravity Science Glovebox (ISS Expedition 38, Nikon raw stills).\",\"source\":\"data/PSI-25/rawdata/reduced-gravity/raw_images (.NEF)\",\"stills\":[$rows]}" >"$out/index.json"

  local pdf="$src/BASS-II Summary Report.pdf"
  if [ -f "$pdf" ]; then
    if command -v osascript >/dev/null; then
      cat >"$tmp/pdf.js" <<'EOF'
ObjC.import('PDFKit')
function run(argv) {
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0]))
  const pages = []
  for (let i = 0; i < doc.pageCount; i++) { const s = doc.pageAtIndex(i).string; pages.push({ page: i + 1, text: s.isNil() ? '' : s.js }) }
  return JSON.stringify({ title: 'BASS-II Summary Report, NASA/TM-20210011385 (Olson, Ferkul et al., 2021)', pages: pages })
}
EOF
      osascript -l JavaScript "$tmp/pdf.js" "$pdf" >"$out/report.json"
    else
      echo "no PDFKit here: write $out/report.json with pdftotext by hand ({title, pages:[{page,text}]})" >&2
    fi
  fi
  echo "psi-25: $n stills$( [ -f "$out/report.json" ] && echo " + report text ($(du -h "$out/report.json" | cut -f1))") → $(du -sh "$out" | cut -f1)"
}

for w in $WHAT; do
  case "$w" in
    psi-98) psi98 ;;
    psi-25) psi25 ;;
    *) echo "unknown: $w (psi-98 or psi-25)" >&2; exit 1 ;;
  esac
done
