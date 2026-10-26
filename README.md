# Every Touchdown

An interactive NFL season sculpture built with Vite, TypeScript and Three.js. Each path is a real offensive passing or rushing touchdown. Hover/tap to inspect, click to hold a play, double-click to focus, or watch the season construct itself with **Play Season**.

## Run locally

Node 22.12+ (or 20.19+), npm, and Python 3 for ingestion and data tests.

```sh
npm install
npm run dev
npm run build
npm run preview
```

Open `/DET/2025`, `/KC/2024`, `/SF/2023`, or any available team/season. `/` opens Detroit 2025. Team and year pickers update the URL; back/forward restores the corresponding sculpture. Historical aliases such as `/OAK/2016` canonicalize to `/LV/2016` while showing the historical team name. Unknown combinations show an explicit recovery state.

## Static archive and provenance

The checked-in archive contains **320 team-seasons, 13,371 offensive touchdowns, 2016–2025**. All 32 NFL franchises are available in each of the ten supported seasons. Both regular season and postseason are included and labeled. No incomplete 2026 season is published.

Source: [nflverse play-by-play](https://nflreadr.nflverse.com/reference/load_pbp.html), which documents source availability from 1999; this product intentionally ships only 2016–2025. [Team metadata](https://nflreadr.nflverse.com/reference/load_teams.html) supplies centralized names and colors in `src/data/teams.ts`. Current team abbreviations identify franchises across relocations; historical names are displayed for their applicable years.

Every dataset is generated, never manually transcribed:

```sh
npm run ingest -- --seasons 2016:2025
# A single season / team:
npm run ingest -- --seasons 2024 --team KC
# Refresh the official release instead of using the source cache:
npm run ingest -- --seasons 2025 --refresh
# Rebuild from an existing official source:
npm run ingest -- --seasons 2025 --input /absolute/path/play_by_play_2025.csv.gz
```

The Python standard-library pipeline caches official compressed releases in ignored `work/nflverse/`, reads CSV records once per season, normalizes franchise aliases, and retains scoring candidates and game accounting. It excludes returns, defensive TDs, conversion attempts, nullified scores and non-pass/rush recoveries. Each record preserves its original description, game/play IDs, air/YAC, run location/gap and source flags. Each dataset records the source URL and compressed-file SHA-256. Requests for seasons outside 2016–2025 write only to ignored `work/historical-data/`, never the production archive or picker. Audit reports are generated in ignored `work/audits/<year>/<team>.json`.

Files are published at `public/data/<season>/<team>.json`. `public/data/index.json` is an availability manifest rebuilt from published files. Missing/invalid LOS blocks publication; duplicate IDs fail ingestion. Missing/inconsistent air/YAC produces an explicitly unsegmented pass rather than a fabricated catch. **6 passes** across this archive use that fallback. The existing Detroit manual audit remains in `validation/` as a record of the prototype validation.

## Geometry and interaction

- Field length runs X −60…+60, scoring plane +50; LOS X = 50 − yardline_100.
- For recorded passing splits: catch X = LOS X + signed air_yards; goal X − catch X = yards_after_catch. Negative-air screens are preserved. Zero YAC adds no ground trail.
- Height and lateral positions are illustrative. Left/middle/right selects a region; play-ID seeds make placement stable. Rush location/gap shapes gentle ground splines, not invented tracking routes.
- Left drag orbits; right/Shift-drag pans; scroll/pinch zooms. Two-finger touch pans and zooms. Minimum camera distance is 38, with above-field polar limits and bounded camera targets.
- Thin paths have generous 8 px mouse / 12 px touch pick corridors. Hover reveals the whole play; click locks it and reveals the original description; empty click or Escape clears. Double-click/F focuses. Up/Down explores, Enter selects, Left/Right orbits, Shift+arrows pans, R resets.
- Rich team-colored aerial threads sit over a pale printed field on warm off-white. Rushes are quieter, gray-green variations of the team color; selected threads deepen in pigment. The original touchdown geometry remains intact.

## Playback and lifecycle

Playback uses a pure deterministic timeline sorted by week, game/date, quarter, descending game clock, and numeric play ID. Path draw ranges reveal LOS → pass → catch → YAC → score. Completed plays settle to resting materials; future plays stay hidden. Scrubbing reconstructs the same state forward or backward, including endpoint pulses.

Detroit 2025 remains 40 seconds. Other seasons scale with touchdown count (minimum 12 seconds), retaining distance-dependent draw duration and game separation. Hover/click inspection is suspended during playback; **orbit, pan, zoom, and smooth Reset View remain available while the timeline keeps running**. The opening overview move cancels on camera input. There is no ongoing autonomous drift. Pause/Resume, Restart, Exit and Escape behave consistently. Hidden tabs pause automatically.

One renderer, one animation loop, and one set of application listeners persist across dataset changes. Requests are aborted and sequence-guarded; old playback, picking, navigation listeners, geometries, materials and textures are disposed. Camera position is preserved. Fade transitions protect the composition while metadata and geometry change together. Device pixel ratio is capped at 2. Reduced-motion preference removes fades, camera easing and the expanding score ring.

Mobile captions flow below the scene. Modal team/year pickers retain keyboard focus, close on Escape, and disable unavailable combinations. Camera and playback controls occupy separate areas.

## Verification

```sh
npm run test:data
npm run test:geometry
npm run test:interaction
npm run test:navigation
npm run test:playback
npm run test:archive
npm run build
```

Archive checks cover all 320 datasets: unique source IDs, count accounting, finite renderable geometry, signed longitudinal invariants, historical availability, and dynamic playback durations. Detroit regression tests retain exact geometry and picking checks. Navigation tests verify focus/reset completion, interruption and camera bounds. Playback tests check deterministic backward/forward seeking, segment order and material restoration.

Browser QA includes multiple high-scoring seasons, selector transitions, direct links, back/forward, invalid routes, live camera navigation during playback, resource counts after repeated switching, and narrow-screen captions/controls.

## Production readiness (not deployed)

`npm run build` produces a static `dist/` directory, including the complete ~10 MB archive; the client downloads only the small catalog and selected team-season. Configure the eventual static host to serve `index.html` for team/season routes, but preserve real static-file 404s. No database, backend, authentication or tracking is required.

The shell includes title, description, favicon, Open Graph metadata and `public/og-preview.png`. The neutral social preview works for every route; runtime titles/descriptions reflect the selected season. Set an absolute production `og:image` URL when a deployment origin is chosen. Regenerate the preview with `scripts/render-og.py` using Python + Pillow. No deployment has been performed.

## Final light visual direction

Warm off-white canvas, a pale sage-neutral field, soft gray markings, and near-black editorial typography replace the dark exhibition palette. The sculpture carries expressive team color; the UI stays neutral. Play Season retains its deterministic mechanics with a small team-colored scoring ripple. Decorative study labels have been removed. There is no theme toggle and no new functionality.

Final visual pass: light gallery by default, persisted light/dark preference, curated pass/rush inks for all 32 teams, restrained scoring-end-zone identity and regulation-position goalposts. ALL/PASS/RUSH filters share the same visible play set with hit testing and Play Season; changing the filter exits playback and restores exploration. Theme changes preserve playback progress and geometry.
