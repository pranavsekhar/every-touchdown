# Every Touchdown — Phase 4

Vite + TypeScript + direct Three.js. Detroit's complete 2025 offensive touchdown sculpture: **56 TDs, 35 passing and 21 rushing**, derived from nflverse play-by-play. No sample plays remain.

## Run locally

Node.js 22.12+ (or 20.19+), npm, and Python 3 for ingestion/tests.

```sh
npm install
npm run dev
```

The normalized JSON is checked in, so the frontend needs no data download beyond its 40 KB season file and no backend. `npm run build` checks TypeScript and emits a static production build; `npm run preview` serves it.

## Rebuild the dataset

```sh
npm run ingest
# Force a fresh public release download:
npm run ingest -- --refresh
# Or process an existing official CSV / compressed CSV:
npm run ingest -- --input /absolute/path/play_by_play_2025.csv.gz
```

The standard-library Python pipeline downloads/caches the official nflverse release in `work/nflverse/`, scans the REG/POST season, filters on final touchdown and scoring-team flags, and excludes returns, conversion attempts, no-plays and other non-pass/rush scores. It preserves source IDs, player IDs, original descriptions, quarter/clock, LOS, air/YAC, run gap and coarse locations. The final source flags correctly handle overturned replay decisions and between-downs penalties.

Generated files:

- `public/data/2025/DET.json` — browser dataset with source URL, source SHA-256, summary and normalized records.
- `validation/DET-2025.md` — readable debug summary and five normalized examples.
- `validation/DET-2025.audit.json` — exhaustive exclusions, nullified attempts, missing fields, per-week counts and examples.
- `validation/manual-verification.md` — manual checks against original source descriptions, with their limitations.

## Coordinate and visual meaning

- Field X length: −60…+60; Z width: −26.65…+26.65; scoring goal-line plane: **X=+50**.
- `startYardline=100-yardline_100`; `LOS X=50-yardline_100`.
- `catch X=LOS X+air_yards`; `score X-catch X=yards_after_catch`.
- All plays travel toward the same goal line. Negative-air passes correctly travel backward before YAC moves forward; zero air is valid, not missing.
- No arbitrary end-zone depth is added. The source's touchdown yardage ends at the goal-line plane.
- An aerial pass ends at a subtle catch node. Nonzero YAC continues as a quieter, field-hugging blue trail. Zero YAC has no fabricated ground segment. Rushes use low silver trails.
- Height is an illustrative, bounded exponential function of positive air distance. Left/middle/right uses seeded placement within the recorded region, not player tracking. Run location/gap influence the initial rushing direction, with bounded lateral movement on short runs.
- Missing/inconsistent air or YAC yields an unsegmented pass, with no inferred catch node. Source nulls remain null. Missing LOS can fall back explicitly to touchdown yards; if neither exists, ingestion writes an audit and refuses to publish an incomplete season.

## Validation

```sh
npm run test:data
npm run test:geometry
npm run test:interaction
npm run test:navigation
npm run test:playback
npm run build
```

Tests cover real-source accounting, signed longitudinal invariants, deterministic geometry, field bounds, monotonic rushing distance, curved long runs, short rushes, zero YAC, and synthetic null/inconsistent values. Manual checks verify descriptions for five representative scores; source descriptions do not independently verify numerical air/YAC splits.

Drag to orbit, scroll/pinch to zoom, or use existing rotation/reset controls. Focus the field and use arrow keys/R for keyboard rotation/reset. There is no automatic ambient animation. Page design remains from Phase 1. The default camera is tuned for the complete season, with the scoring end closer to the viewer.

Phase 4 season playback and exploration are implemented. Broader product features remain intentionally absent.

## Phase 2.5 visual treatment

Aerial passes are fine blue threads at 42–58% opacity; YAC is 26%, and warm neutral rushes are 23%. Catch markers are smaller and translucent, without rings. Ground runs use deterministic centripetal splines with bounded lateral bends influenced by run location/gap; no source longitudinal coordinate is changed. Numbers, hashes, end-zone lettering and coordinate decoration are further subordinated. This remains the unselected baseline; Phase 3 only changes materials while a play is being explored.

## Phase 3 exploration

Hover any aerial or ground segment to reveal its complete touchdown and a minimal caption. Click to lock the play and read its original description. Click another path to replace selection; click empty canvas or press Escape to clear. Dragging or pinching never selects or deselects a play, and single-click selection never moves the camera. Double-click (or F) gently focuses the play while retaining the viewing direction.

Picking uses pre-sampled curves projected into an 8 CSS-pixel corridor (12 for touch), with nearest-segment/depth tie-breaking. Projection is cached until the camera changes, and pointer picking runs at most once per frame. Hit corridors do not change visible geometry, and interaction never rebuilds meshes. Material opacity/color transitions settle in approximately 200 ms, or immediately with reduced motion. Every material's exact Phase 2.5 rest values are retained. Inactive paths now retain 68% of rest opacity during hover/selection, rather than 16%.

Focus the sculpture: Up/Down explores individual plays, Enter locks selection, Escape clears, Left/Right orbits, and R resets the camera. Caption text is semantic HTML, safely assigned as text, with an accessible live region. The original description appears only for locked selections.

Validation: 56/56 plays can be independently hit at the default camera; data and geometry checks still pass. Browser checks include passing/rushing hover, selection replacement, persistent selection during orbit, empty-space and Escape clearing, negative air yards, resumed hover after orbit, keyboard navigation, and narrow caption layout.

## Phase 3.5 spatial navigation

The field, markings and ambient environment are brighter while retaining a dark exhibition palette. Description and structured metadata share one left caption, with a soft readability scrim when the field moves behind it.

- Left-drag orbits; right-drag or Shift-drag pans along the ground plane; scroll/pinch zooms. Two-finger touch combines pan and zoom.
- Camera distance ranges from 38 to 255 yards (previous minimum 115), allowing approximately 3× closer inspection. Polar limits keep the viewpoint above the turf; target bounds are X ±55, Z ±25, Y 0.5–6.
- Double-click a touchdown or press F on the explored play to focus. A 650 ms eased translation preserves viewing direction and fits the play, with reduced-motion support. New pointer/wheel navigation cancels focus immediately.
- Reset View / R clears residual camera inertia and returns to the canonical camera and target, retaining play selection. Shift-arrow keys offer keyboard panning.
- Pan gestures do not select/deselect; hover suspends during camera gestures and resumes on release. Real-data geometry and source JSON remain unchanged.

Tests include all-play focus frames, target bounds, close-camera clearance, animation cancellation and exact overview reset. The same navigation remains available during paused playback.


## Phase 4 — Play Season

Play Season clears selection, fades the sculpture, and eases back to the canonical overview. A deterministic 40-second timeline builds all 56 touchdowns in week/game/quarter/descending-clock/numeric-play-ID order. Duration varies with touchdown distance and play type; short pauses separate plays and larger pauses separate games.

Existing indexed tubes reveal from LOS to catch, then through YAC. Catch nodes briefly emphasize the handoff; a small expanding ground ring marks scoring. Completed plays return to their exact resting materials, future plays remain hidden. The timeline reuses the left caption without original descriptions and includes only a week/opponent label, Pause/Resume, Restart, Exit and a keyboard-accessible range scrubber.

`timeline.ts` is pure chronology/timing. `DrawTouchdown.setProgress` reconstructs every segment and marker from progress without allocating geometry/materials. `SeasonPlayer` owns one time value, including settle/pulse state. Seeking pauses and deterministically reconstructs the requested instant, even backward; Resume continues there. Pause enables orbit/pan/zoom for spatial inspection; play picking remains suspended until exit. Escape exits. Switching away from the browser tab pauses automatically.

The automatic camera drifts only six degrees across the whole season; it never follows a touchdown. Reduced-motion preference disables camera drift, opening camera interpolation, and the expanding scoring ring. At the end, a short beat resolves to the full sculpture and restores normal exploration. Exit also restores every draw range, marker scale and resting material. No real-data coordinates or source records change.

Playback tests check all 56 paths, signed-air anatomy, same-clock ordering, independent time samples, backward/forward seeks, total duration, single-active-play invariant, and exact geometry/material restoration. Existing data, geometry, picking and navigation suites remain passing.
