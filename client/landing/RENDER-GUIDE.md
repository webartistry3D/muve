# Muve Landing Page — Render Guide

This guide covers everything you need to turn the scaffolded landing page into a
fully rendered scroll-scrubbed "fly through the world" experience.

## What's been built

The landing page is **scaffolded and functional** with placeholder stills. When
you scroll, the engine works — copy animates, the route rail tracks, the layout
responds. The only thing missing is the **generated video chain** that replaces
the placeholder stills with actual clay-diorama scenes and camera flights.

### File structure

```
client/
├── public/                    # Served by Vite in dev, copied to dist/ in build
│   ├── index.html             # The landing page — config-driven, mounts the scrub engine
│   ├── scrub-engine.js        # Portable scroll-scrub engine (vanilla JS, zero deps)
│   ├── shared.css             # Shared styles for about/contact pages
│   ├── about.html             # About Us page
│   ├── contact.html           # Contact Us page
│   └── assets/
│       ├── *.webp             # Scene stills (currently placeholders)
│       ├── *-m.webp           # Mobile portrait posters (currently placeholders)
│       └── vid/
│           ├── *.mp4          # Desktop dive clips (to be generated)
│           ├── conn*.mp4      # Desktop connector clips (to be generated)
│           ├── *-m.mp4        # Mobile dive clips (to be generated)
│           └── conn*-m.mp4    # Mobile connector clips (to be generated)
├── landing/                   # Build-time rendering assets (not served to browsers)
│   ├── render.sh              # Full render pipeline script (bash)
│   ├── RENDER-GUIDE.md        # This file
│   └── prompts/               # All generation prompts (17 desktop + 11 mobile)
│       ├── style-preamble.txt # Shared style preamble (reused verbatim in every still)
│       ├── still_*.txt        # 6 scene still prompts (gpt_image_2, 3:2, 2k)
│       ├── dive_*.txt         # 6 desktop dive prompts (seedance, 16:9, 8s)
│       ├── conn_*.txt         # 5 desktop connector prompts (seedance, 16:9, 5s)
│       ├── dive_*_m.txt       # 6 mobile dive prompts (seedance, 9:16, 8s)
│       └── conn_*_m.txt       # 5 mobile connector prompts (seedance, 9:16, 5s)
├── app.html                   # React app entry (served at /app)
└── src/                       # React source code
```

### The journey (6 scenes)

| # | Scene | What's in the diorama | Accent |
|---|---|---|---|
| 1 | The City | Miniature city at dawn, streets waking up | Amber `#FFB84D` |
| 2 | The Request | Rider on a corner, phone glowing, green pin drops | Green `#0E8345` |
| 3 | The Match | Glowing network paths connecting rider to driver | Green `#0E8345` |
| 4 | The Driver | Car at curb, headlights on, driver getting in | Amber `#FFB84D` |
| 5 | The Ride | Three cars (MuveX/XL/Black) driving the route | Red `#C5564A` |
| 6 | Arrival | Car pulls up to destination, person steps out | Green `#0E8345` |

### Art direction

- **Style:** Soft matte low-poly clay diorama, isometric, tilt-shift miniature, warm light
- **Camera:** Fly-through (Architecture B) — dives into each scene, pulls up and out, aerial hops between scenes
- **Background:** Cream `#F4F1EC` (matches the page bg for seamless posters)
- **Palette:** Charcoal `#1A1A1F`, Signal green `#0E8345`, Warm grey `#8A8A8E`, Cream `#F4F1EC`, Amber `#FFB84D`, Brick red `#C5564A`

---

## Prerequisites

1. **Higgsfield CLI** — installed + authed
   ```bash
   higgsfield auth login          # interactive OAuth (you must run this)
   higgsfield workspace list      # check credits
   ```
   You need roughly **200 credits** for the full desktop + mobile chain at standard tier.
   For a previz run (draft tier), ~50 credits suffices.

2. **ffmpeg / ffprobe** — on PATH (frame extraction + encoding)

3. **jq** + **curl** — on PATH (JSON parsing + downloads)

4. **(Optional) Monid CLI** — for pay-per-USD rendering instead of credits:
   ```bash
   monid balance                  # check balance
   ```
   Monid is ~15% cheaper per clip and has no monthly expiry. Set `BACKEND=monid`
   when running the pipeline. The full desktop+mobile chain at 1080p ≈ $54 via Monid.

---

## Rendering

### Option A: Full render (desktop + mobile)

From the `client/landing/` directory:

```bash
bash render.sh
```

This runs all 7 phases:
1. Generate 6 scene stills (gpt_image_2, 3:2, 2k)
2. Generate 6 desktop dive clips (seedance_2_0, 16:9, 8s)
3. Extract boundary frames from rendered dives
4. Generate 5 desktop connector clips (seedance_2_0, 16:9, 5s)
5. Encode desktop chain (1080p, crf 20, GOP 8)
6. Generate + encode mobile 9:16 portrait chain (720p, GOP 4)
7. Extract mobile posters from portrait dive first frames

**Time:** ~30-60 minutes (generations run concurrently, but each takes 3-8 min).

### Option B: Previz run (cheap draft to validate the journey)

```bash
bash render.sh --previz
```

Uses `seedance_2_0_mini` (720p draft tier, ~1/4 the cost) to validate the full
journey and seam quality before spending on the final render. Because the draft
model still frame-locks, the previz translates directly to the final render.

### Option C: Desktop only (skip mobile)

```bash
bash render.sh --desktop
```

Skips the 9:16 portrait chain. The engine still hardens phone scrubbing
(seek-coalescing, iOS priming, safe-area), so the page degrades gracefully on
phones — it just serves the desktop clips.

### Option D: Stills only (review before video)

```bash
bash render.sh --stills
```

Generates only the 6 scene stills, converts to webp, and stops. Review them for
cohesion — they should all look like one cohesive world (same angle, palette,
light). Re-roll any off-style one before spending on video.

### Using Monid instead of Higgsfield credits

```bash
BACKEND=monid bash render.sh
```

Same pipeline, but video clips are billed per-clip in USD via Monid's
`bytedance /v1/video/seedance-2.0` endpoint instead of Higgsfield credits.
Stills still use Higgsfield `gpt_image_2` (credits) unless you have the Codex
CLI for subscription-billed stills.

---

## After rendering

### Preview locally

```bash
cd landing
npx serve .              # or: python -m http.server 4321
```

Open `http://localhost:4321` and scroll through the full journey.

### QA the seams (don't skip)

The most likely thing to be wrong is a visible "pop" at scene transitions:

1. **Scroll slowly through each transition.** The last frame of one scene should
   match the first frame of the next (the connector bridges them with
   frame-identical endpoints).

2. **If you see a pop:** the connector's endpoints weren't the actual rendered
   frames. The render.sh script handles this automatically (extracts frames from
   rendered videos, not stills), but if you manually regenerate a connector,
   make sure to re-extract the boundary frames first.

3. **If a connector was rejected by the NSFW filter** (common for interior/street
   scenes): re-roll it (often passes on 2nd-3rd try), or regenerate that one
   clip on `kling3_0` with the same start/end frames:
   ```bash
   VMODEL=kling3_0; VOPTS="--mode std --sound off"
   # then manually: gen_conn 3 last_match.png first_driver.png
   ```

4. **Check the console** for errors. Confirm `video.seekable.end(0) > 0` (blob
   loading working — the engine does this automatically).

5. **Test on mobile** (real phone or DevTools emulation):
   - Portrait 9:16 clips should be served (check Network panel: `*-m.mp4`)
   - No blank/black scenes (iOS priming fix is in the engine)
   - No scroll jump when URL bar collapses
   - Fast flick shouldn't freeze the video (seek coalescing)

6. **Test `prefers-reduced-motion`** — should fall back to stills only, no video.

---

## Re-rolling individual assets

### Re-roll a still

```bash
higgsfield generate create gpt_image_2 \
  --prompt "$(cat prompts/still_match.txt)" \
  --aspect_ratio 3:2 --resolution 2k --quality high \
  --wait --json | jq -r '.[0].result_url' | xargs curl -fsSL -o _render/still_match.png

cwebp -quiet -q 84 -resize 1800 0 _render/still_match.png -o assets/match.webp
```

To lock style to an approved still, add `--image _render/still_city.png`.

### Re-roll a dive clip

```bash
higgsfield generate create seedance_2_0 \
  --prompt "$(cat prompts/dive_ride.txt)" \
  --start-image _render/still_ride.png \
  --mode std --resolution 1080p --aspect_ratio 16:9 --duration 8 \
  --wait --json | jq -r '.[0].result_url' | xargs curl -fsSL -o _render/dive_ride.mp4

ffmpeg -v error -y -i _render/dive_ride.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart assets/vid/ride.mp4
```

**Important:** if you re-roll a dive, you must also re-extract its boundary
frames and re-generate the adjacent connectors (they depend on the actual
rendered frames):

```bash
ffmpeg -v error -ss 0 -i _render/dive_ride.mp4 -frames:v 1 -q:v 2 _render/first_ride.png
ffmpeg -v error -sseof -0.15 -i _render/dive_ride.mp4 -frames:v 1 -q:v 2 _render/last_ride.png
# Then re-generate conn_4 (uses last_driver.png -> first_ride.png)
# and conn_5 (uses last_ride.png -> first_arrival.png)
```

---

## Deploying

The landing page lives in `client/public/` and is served by Vite in dev and
copied to `client/dist/` during build. In production, the frontend Express
server (`client/server.js`) serves it at `/` and the React app at `/app`.

### Two-service deployment (Render)

The app deploys as two separate web services (see `render.yaml`):

1. **Backend** (`muve-api`) — API + WebSockets from `server/`
2. **Frontend** (`muve`) — Landing page + React app from `client/`, built with
   `npm run build` and served with `npm start` (runs `server.js`)

Set `VITE_API_URL` on the frontend to the backend's URL so the React app knows
where to send API requests and WebSocket connections.

### Asset sizes (estimated after render)

| Asset type | Count | Est. size each | Total |
|---|---|---|---|
| Desktop stills (webp) | 6 | ~200 KB | ~1.2 MB |
| Mobile posters (webp) | 6 | ~120 KB | ~720 KB |
| Desktop clips (mp4, 1080p) | 11 | ~8 MB | ~88 MB |
| Mobile clips (mp4, 720p) | 11 | ~3 MB | ~33 MB |

The engine lazy-loads clips (only prefetches nearby segments), so initial page
load is just the first still + the first clip.

---

## Cost summary

| Tier | Backend | Desktop only | Desktop + mobile |
|---|---|---|---|
| Previz (720p draft) | Higgsfield credits | ~50 credits | ~100 credits |
| Standard (1080p) | Higgsfield credits | ~110 credits | ~200 credits |
| Standard (1080p) | Monid (pay-per-USD) | ~$27 | ~$54 |
| Standard (720p) | Monid (pay-per-USD) | ~$11 | ~$22 |

Stills: 6 × ~15 Higgsfield credits = ~90 credits (or free via Codex CLI if available).

---

## Customizing

### Change the copy

Edit `index.html` — the `sections` array in the `mountScrollWorld()` call. Each
section has `eyebrow`, `title`, `body`, `tags`, and optional `cta` (last section
only). The `accent` per section colors the copy and route dot.

### Change the pacing

Each section accepts optional `scroll` (viewport-heights of scroll per dive —
more = longer dwell) and `linger` (0-1, remaps time so the camera settles
mid-scene where the copy peaks). Current values:

| Scene | scroll | linger |
|---|---|---|
| City (hero) | 1.6 | 0.40 |
| Request | 1.3 | 0.35 |
| Match | 1.3 | 0.35 |
| Driver | 1.3 | 0.35 |
| Ride | 1.4 | 0.40 |
| Arrival (finale) | 1.6 | 0.45 |

### Change the theme

Edit the `:root, .sw-root` CSS variables in `index.html`:

```css
--sw-bg: #F4F1EC;       /* page background (match scene bg) */
--sw-ink: #1A1A1F;      /* primary text */
--sw-ink-soft: #6B6B6B; /* secondary text */
--sw-accent: #0E8345;   /* default accent (overridden per-section) */
```

### Add/remove scenes

1. Add/remove prompts in `prompts/`
2. Update the `NAMES` variable in `render.sh`
3. Update the `sections` + `connectors` + `connectorsMobile` arrays in `index.html`
  (connectors length must = sections length - 1)
