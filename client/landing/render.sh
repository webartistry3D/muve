#!/usr/bin/env bash
# =============================================================================
# render.sh — muve scroll-world render pipeline
# =============================================================================
# Generates the full scroll-scrubbed landing page asset chain:
#   6 scene stills -> 6 dive clips -> 5 connector clips -> encode -> mobile chain
#
# PREREQUISITES:
#   - higgsfield CLI installed + authed (higgsfield auth login)
#   - ffmpeg / ffprobe on PATH
#   - jq on PATH
#   - curl on PATH
#   - Enough Higgsfield credits (~200 for full desktop+mobile at standard tier)
#     OR Monid CLI working (set BACKEND=monid below)
#
# USAGE:
#   bash render.sh              # full render, desktop + mobile
#   bash render.sh --previz     # cheap 480p/720p draft to validate the journey
#   bash render.sh --desktop    # desktop chain only (skip mobile)
#   bash render.sh --stills     # generate stills only, then stop for review
#
# Run from the client/landing/ directory. Prompts are in prompts/.
# Output assets go to ../public/assets/ (where Vite serves them).
# =============================================================================
set -euo pipefail

# ---- Config -----------------------------------------------------------------
WORK="./_render"                  # scratch dir for sources, frames, logs
ASSETS="../public/assets"          # where the site reads stills (webp) + clips (mp4)
PROMPTS="./prompts"
NAMES="city request match driver ride arrival"
NAMES_M="city request match driver ride arrival"   # mobile uses same ids

# Backend: "higgsfield" (credits) or "monid" (pay-per-USD). Monid is cheaper
# for one-off builds but requires the Monid CLI + API connectivity.
BACKEND="${BACKEND:-higgsfield}"

# Video model — ONE for every chained clip (must accept --start-image + --end-image).
# seedance_2_0 (standard, 1080p) | seedance_2_0_mini (draft/previz, 720p) | kling3_0 (720p, alt filter)
VMODEL="${VMODEL:-seedance_2_0}"

# Previz mode: cheap draft tier to validate journey before full render
PREVIZ=false
DESKTOP_ONLY=false
STILLS_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --previz)  PREVIZ=true; VMODEL=seedance_2_0_mini ;;
    --desktop) DESKTOP_ONLY=true ;;
    --stills)  STILLS_ONLY=true ;;
  esac
done

# Per-model flags + durations (bash 3.2 safe — no associative arrays)
case "$VMODEL" in
  kling3_0)          VOPTS="--mode std --sound off";          DIVE_DUR=10; CONN_DUR=5 ;;
  seedance_2_0_mini) VOPTS="--mode std --resolution 720p";    DIVE_DUR=8;  CONN_DUR=5 ;;
  *)                 VOPTS="--mode std --resolution 1080p";   DIVE_DUR=8;  CONN_DUR=5 ;;
esac

# Monid resolution tier (only used if BACKEND=monid)
if $PREVIZ; then VRES=480p; elif [ "$VMODEL" = "seedance_2_0_mini" ]; then VRES=720p; else VRES=1080p; fi

mkdir -p "$WORK" "$ASSETS/vid"

echo "============================================================"
echo "  muve scroll-world render pipeline"
echo "  backend: $BACKEND | model: $VMODEL | previz: $PREVIZ"
echo "  desktop+mobile: $([ "$DESKTOP_ONLY" = false ] && echo yes || echo desktop-only)"
echo "  stills-only: $STILLS_ONLY"
echo "============================================================"

# ---- 1. Scene stills (Step 2) -----------------------------------------------
gen_still() { # name
  echo "  generating still: $1"
  higgsfield generate create gpt_image_2 --prompt "$(cat "$PROMPTS/still_$1.txt")" \
    --aspect_ratio 3:2 --resolution 2k --quality high --wait --wait-timeout 15m --json \
    > "$WORK/still_$1.json" 2> "$WORK/still_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/still_$1.json")
  if [ -n "$url" ]; then
    curl -fsSL "$url" -o "$WORK/still_$1.png" && echo "  still $1 ok" || echo "  still $1 FAIL"
  else
    echo "  still $1 FAIL (see $WORK/still_$1.err)"
  fi
}

echo ""
echo "[1/7] Generating scene stills..."
for n in $NAMES; do gen_still "$n" & done; wait

# Convert to webp for the site
for n in $NAMES; do
  cwebp -quiet -q 84 -resize 1800 0 "$WORK/still_$n.png" -o "$ASSETS/$n.webp" 2>/dev/null || \
    ffmpeg -v error -y -i "$WORK/still_$n.png" -q:v 2 "$ASSETS/$n.webp"
  echo "  webp: $n"
done

echo ""
echo "  >>> Review the stills in assets/ for cohesion before continuing."
echo "  >>> Re-roll any off-style one: gen_still <name>"
if $STILLS_ONLY; then echo "  --stills mode: stopping here."; exit 0; fi

# ---- 2. Dive-in clips — desktop (Step 4, architecture B) -------------------
gen_dive() { # name
  echo "  generating dive: $1"
  higgsfield generate create "$VMODEL" --prompt "$(cat "$PROMPTS/dive_$1.txt")" \
    --start-image "$WORK/still_$1.png" \
    $VOPTS --aspect_ratio 16:9 --duration "$DIVE_DUR" \
    --wait --wait-timeout 20m --json > "$WORK/dive_$1.json" 2> "$WORK/dive_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/dive_$1.json")
  if [ -n "$url" ]; then
    curl -fsSL "$url" -o "$WORK/dive_$1.mp4" && echo "  dive $1 ok" || echo "  dive $1 FAIL"
  else
    echo "  dive $1 FAIL (see $WORK/dive_$1.err)"
  fi
}

# Monid backend variant
gen_dive_monid() { # name
  echo "  generating dive (monid): $1"
  furl=$(monid_frame_url "$WORK/still_$1.png" "still_$1")
  jq -n --arg p "$(cat "$PROMPTS/dive_$1.txt")" --arg u "$furl" --arg r "$VRES" \
    '{content:[{type:"text",text:$p},{type:"image_url",image_url:{url:$u},role:"first_frame"}],
      resolution:$r, duration:'"$DIVE_DUR"', ratio:"16:9", generate_audio:false}' \
    > "$WORK/dive_$1.body.json"
  rid=$(NO_COLOR=1 monid run -p bytedance -e /v1/video/seedance-2.0 -f "$WORK/dive_$1.body.json" -j | jq -r '.runId')
  monid_wait "$rid" "$WORK/dive_$1.json"
  url=$(jq -r '.output.content.video_url // empty' "$WORK/dive_$1.json")
  if [ -n "$url" ]; then
    curl -fsSL "$url" -o "$WORK/dive_$1.mp4" && echo "  dive $1 ok (\$$(jq -r '.cost.value' "$WORK/dive_$1.json"))" || echo "  dive $1 FAIL"
  else
    echo "  dive $1 FAIL ($(jq -r '.status' "$WORK/dive_$1.json"))"
  fi
}

echo ""
echo "[2/7] Generating desktop dive clips..."
for n in $NAMES; do
  if [ "$BACKEND" = "monid" ]; then gen_dive_monid "$n" & else gen_dive "$n" & fi
done; wait

# ---- 3. Extract boundary frames (Step 5) -----------------------------------
echo ""
echo "[3/7] Extracting boundary frames..."
set -- $NAMES
for n in "$@"; do
  ffmpeg -v error -ss 0 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/first_$n.png"
  ffmpeg -v error -sseof -0.15 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/last_$n.png"
  echo "  frames: $n"
done

# ---- 4. Connector clips — desktop (Step 5) ---------------------------------
gen_conn() { # i startPng endPng
  echo "  generating connector: $1"
  higgsfield generate create "$VMODEL" --prompt "$(cat "$PROMPTS/conn_$1.txt")" \
    --start-image "$2" --end-image "$3" \
    $VOPTS --aspect_ratio 16:9 --duration "$CONN_DUR" \
    --wait --wait-timeout 20m --json > "$WORK/conn_$1.json" 2> "$WORK/conn_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/conn_$1.json")
  if [ -n "$url" ]; then
    curl -fsSL "$url" -o "$WORK/conn_$1.mp4" && echo "  conn $1 ok" || echo "  conn $1 FAIL"
  else
    echo "  conn $1 FAIL (see $WORK/conn_$1.err)"
  fi
}

gen_conn_monid() { # i startPng endPng
  echo "  generating connector (monid): $1"
  su=$(monid_frame_url "$2" "conn$1_start"); eu=$(monid_frame_url "$3" "conn$1_end")
  jq -n --arg p "$(cat "$PROMPTS/conn_$1.txt")" --arg s "$su" --arg e "$eu" --arg r "$VRES" \
    '{content:[{type:"text",text:$p},
               {type:"image_url",image_url:{url:$s},role:"first_frame"},
               {type:"image_url",image_url:{url:$e},role:"last_frame"}],
      resolution:$r, duration:'"$CONN_DUR"', ratio:"16:9", generate_audio:false}' \
    > "$WORK/conn_$1.body.json"
  rid=$(NO_COLOR=1 monid run -p bytedance -e /v1/video/seedance-2.0 -f "$WORK/conn_$1.body.json" -j | jq -r '.runId')
  monid_wait "$rid" "$WORK/conn_$1.json"
  url=$(jq -r '.output.content.video_url // empty' "$WORK/conn_$1.json")
  if [ -n "$url" ]; then
    curl -fsSL "$url" -o "$WORK/conn_$1.mp4" && echo "  conn $1 ok (\$$(jq -r '.cost.value' "$WORK/conn_$1.json"))" || echo "  conn $1 FAIL"
  else
    echo "  conn $1 FAIL ($(jq -r '.status' "$WORK/conn_$1.json"))"
  fi
}

echo ""
echo "[4/7] Generating desktop connector clips..."
set -- $NAMES; i=0; prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then
    i=$((i+1))
    if [ "$BACKEND" = "monid" ]; then gen_conn_monid "$i" "$WORK/last_$prev.png" "$WORK/first_$n.png" &
    else gen_conn "$i" "$WORK/last_$prev.png" "$WORK/first_$n.png" & fi
  fi
  prev="$n"
done; wait

# ---- 5. Encode desktop chain (Step 6) --------------------------------------
enc() { # src dst
  ffmpeg -v error -y -i "$1" -an -vf "unsharp=5:5:0.8:5:5:0.0" \
    -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
    -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$2"
  echo "  enc $2 $(du -h "$2" | cut -f1)"
}

echo ""
echo "[5/7] Encoding desktop chain..."
for n in $NAMES; do enc "$WORK/dive_$n.mp4" "$ASSETS/vid/$n.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); enc "$f" "$ASSETS/vid/conn$i.mp4"; done

if $DESKTOP_ONLY; then
  echo ""
  echo "============================================================"
  echo "  Desktop chain complete! Open index.html to preview."
  echo "  Assets in: $ASSETS/vid/"
  echo "============================================================"
  exit 0
fi

# ---- 6. Mobile 9:16 portrait chain (Step 6b) --------------------------------
# Composite stills onto 1080x1920 canvases for portrait start images
composite_portrait() { # name
  ffmpeg -v error -y -f lavfi -i "color=c=#F4F1EC:s=1080x1920" \
    -i "$WORK/still_$1.png" -filter_complex \
    "[1:v]scale=1015:-2[img];[0:v][img]overlay=32:540" \
    -frames:v 1 -q:v 2 "$WORK/still_${1}_m.png"
  echo "  portrait canvas: $1"
}

gen_dive_m() { # name
  echo "  generating mobile dive: $1"
  higgsfield generate create "$VMODEL" --prompt "$(cat "$PROMPTS/dive_${1}_m.txt")" \
    --start-image "$WORK/still_${1}_m.png" \
    $VOPTS --aspect_ratio 9:16 --duration "$DIVE_DUR" \
    --wait --wait-timeout 20m --json > "$WORK/dive_${1}_m.json" 2> "$WORK/dive_${1}_m.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/dive_${1}_m.json")
  if [ -n "$url" ]; then
    curl -fsSL "$url" -o "$WORK/dive_${1}_m.mp4" && echo "  dive $1 (mobile) ok" || echo "  dive $1 (mobile) FAIL"
  else
    echo "  dive $1 (mobile) FAIL (see $WORK/dive_${1}_m.err)"
  fi
}

gen_conn_m() { # i startPng endPng
  echo "  generating mobile connector: $1"
  higgsfield generate create "$VMODEL" --prompt "$(cat "$PROMPTS/conn_${1}_m.txt")" \
    --start-image "$2" --end-image "$3" \
    $VOPTS --aspect_ratio 9:16 --duration "$CONN_DUR" \
    --wait --wait-timeout 20m --json > "$WORK/conn_${1}_m.json" 2> "$WORK/conn_${1}_m.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/conn_${1}_m.json")
  if [ -n "$url" ]; then
    curl -fsSL "$url" -o "$WORK/conn_${1}_m.mp4" && echo "  conn $1 (mobile) ok" || echo "  conn $1 (mobile) FAIL"
  else
    echo "  conn $1 (mobile) FAIL (see $WORK/conn_${1}_m.err)"
  fi
}

echo ""
echo "[6/7] Generating mobile 9:16 portrait chain..."
# Portrait start canvases
for n in $NAMES_M; do composite_portrait "$n"; done

# Mobile dives
for n in $NAMES_M; do gen_dive_m "$n" & done; wait

# Extract mobile boundary frames
set -- $NAMES_M
for n in "$@"; do
  ffmpeg -v error -ss 0 -i "$WORK/dive_${n}_m.mp4" -frames:v 1 -q:v 2 "$WORK/first_${n}_m.png"
  ffmpeg -v error -sseof -0.15 -i "$WORK/dive_${n}_m.mp4" -frames:v 1 -q:v 2 "$WORK/last_${n}_m.png"
done

# Mobile connectors
set -- $NAMES_M; i=0; prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then
    i=$((i+1))
    gen_conn_m "$i" "$WORK/last_${prev}_m.png" "$WORK/first_${n}_m.png" &
  fi
  prev="$n"
done; wait

# Encode mobile chain (720 wide, GOP 4, crf 23)
encm() { # src dst
  ffmpeg -v error -y -i "$1" -an -vf "scale=720:-2,unsharp=5:5:0.6:5:5:0.0" \
    -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
    -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart "$2"
  echo "  encm $2 $(du -h "$2" | cut -f1)"
}

echo ""
echo "  Encoding mobile chain..."
for n in $NAMES_M; do encm "$WORK/dive_${n}_m.mp4" "$ASSETS/vid/${n}-m.mp4"; done
i=0; for f in "$WORK"/conn_*_m.mp4; do i=$((i+1)); encm "$f" "$ASSETS/vid/conn${i}-m.mp4"; done

# Mobile posters: extract first frame of each portrait dive -> webp
for n in $NAMES_M; do
  ffmpeg -v error -y -i "$WORK/dive_${n}_m.mp4" -frames:v 1 -q:v 2 "$WORK/poster_${n}_m.png"
  cwebp -quiet -q 80 -resize 1080 0 "$WORK/poster_${n}_m.png" -o "$ASSETS/${n}-m.webp" 2>/dev/null || \
    ffmpeg -v error -y -i "$WORK/poster_${n}_m.png" -q:v 2 "$ASSETS/${n}-m.webp"
  echo "  poster: $n-m.webp"
done

# ---- 7. Done ----------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Render complete! Open index.html to preview."
echo ""
echo "  Desktop assets:  $ASSETS/vid/*.mp4 (1080p, GOP 8)"
echo "  Mobile assets:   $ASSETS/vid/*-m.mp4 (720p portrait, GOP 4)"
echo "  Stills:          $ASSETS/*.webp"
echo "  Mobile posters:  $ASSETS/*-m.webp"
echo ""
echo "  QA the seams: scroll through each transition and check"
echo "  for frame continuity. See RENDER-GUIDE.md > QA section."
echo "============================================================"
