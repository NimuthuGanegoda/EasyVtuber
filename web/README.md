# EasyVtuber Web (Elite V2)

React + TypeScript + Vite front-end: MediaPipe face tracking in the browser,
three interchangeable character renderers, and a Canvas 2D compositing layer.

```bash
npm install
npm run dev        # dev server on :5173
npm run build      # writes ../docs (tracked, deployed by GitHub Pages)
npm run typecheck  # strict TS, no emit
npm run lint       # ESLint
npm run format     # Prettier (--write)
npm test           # Vitest
```

Requires Node 22 (CI pins `node-version: 22`).

## Architecture

```
src/
  App.tsx                  UI shell, settings, the single RAF render loop
  types.ts                 Shared view-model types (no React import)
  character/
    spec.ts                Geometry + palette — THE source of truth (see below)
    canvas2d.ts            Canvas 2D renderer + pose smoothing
  components/
    PerformanceMonitor.tsx Overlay FPS/heap/DOM monitor (backtick to toggle)
  hooks/
    useVtuber.ts           Camera, MediaPipe, worker, hotkeys, tracking state
    useSettings.ts         Persisted camera/delegate/FPS/debug settings
    useContributors.ts     GitHub contributors with an hour-long local cache
  utils/
    poseExtractor.ts       478/468 landmarks -> PoseData (pure, unit-tested)
    poseWorker.ts          Web Worker wrapper around poseExtractor
    webglRenderer.ts       WebGL procedural renderer
    vrmRenderer.ts         three-vrm + Kalidokit renderer
```

### Render fallback chain

`App.tsx` drives **one** `requestAnimationFrame` loop and picks, per frame:

1. **VRM** (`utils/vrmRenderer.ts`) — if `public/models/character.vrm` loaded.
   Driven from raw landmarks by Kalidokit, scripted with per-channel smoothing.
2. **WebGL** (`utils/webglRenderer.ts`) — procedural shapes, one draw call per
   shape with a single branching fragment shader.
3. **Canvas 2D** (`character/canvas2d.ts`) — same shapes as (2), used when WebGL
   is unavailable. **Both renderers import their geometry and palette from
   `character/spec.ts`;** they used to keep private copies that had drifted, so
   the two paths did not look identical.

Overlays and the debug HUD are always drawn on the 2D canvas on top.

### Character assets

Put a `.vrm` at `web/public/models/character.vrm` (Vite serves `public/` at the
site root). If it is missing or fails to load, the app logs once and falls back —
no configuration needed. The camera frames the model from its own bounding box,
so chibi/VRM0 exports are not cropped.

## Pose extraction

`extractPose(landmarks, blendshapes?, transformMatrix?)` is pure and covered by
`utils/poseExtractor.test.ts`:

- Accepts **478** (iris refinement on) *or* **468** (off) landmarks. Fewer than
  `POSE_MIN_LANDMARKS` (468) throws `PoseExtractionError` — deliberately, and
  both call sites surface that error to the user instead of swallowing it.
- Prefers MediaPipe blendshapes (`eyeBlink*`, `jawOpen`) over geometric
  estimates, and the facial transformation matrix over landmark-derived angles.
- Always returns finite numbers, clamped to their meaningful ranges.

The worker protocol is one message in / one message out, echoing an `id`. The
main thread keeps **at most one frame in flight**, so a slow worker drops frames
instead of accumulating latency. Failures come back as `{ id, error }` and are
shown as a warning banner in the viewport.

## Content Security Policy

`index.html` carries the CSP. If you add an origin you must add it to **all** of
`script-src` / `connect-src` / `img-src` as appropriate. Current allowances:

| Origin | Why |
| --- | --- |
| `cdn.jsdelivr.net` | MediaPipe tasks-vision WASM bundle |
| `storage.googleapis.com` | face_landmarker model asset |
| `api.github.com` | contributors panel |
| `github.com`, `*.githubusercontent.com` | contributor avatars |
| `api.dicebear.com` | assistant avatar |
| `fonts.googleapis.com` / `fonts.gstatic.com` | fonts |

`'wasm-unsafe-eval'` in `script-src` is required for the MediaPipe WASM module —
without it tracking fails to initialise. `'unsafe-inline'` is currently needed
for the inline style attribute the app writes.

## Known limitations

- **Hand tracking is not implemented.** The old UI had a disabled button and a
  hotkey that toggled unused state; both were removed rather than left to look
  functional.
- Backgrounds are CSS gradients (`gradient` / `none` / `blur`); an arbitrary
  image background is not wired up.
- `blur` is a translucent dark panel, not a real backdrop blur of the avatar.
