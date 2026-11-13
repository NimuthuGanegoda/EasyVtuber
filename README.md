# 🌸 EasyVtuber: Pure Web & Elite Edition

[![Web App](https://img.shields.io/badge/Web-Live_App_🌐-ff69b4)](https://NimuthuGanegoda.github.io/EasyVtuber/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Browser%20%7C%20Windows%20%7C%20Linux-green)](https://github.com/NimuthuGanegoda/EasyVtuber)

**100% Browser-Based VTubing is here!** 🌸💎

EasyVtuber has been upgraded to run entirely in your web browser. No Python, no heavy local backends, and no complex setup. Just open the link, give camera permission, and start your VTubing journey!

---

## 🌐 Live Web App

👉 **[https://NimuthuGanegoda.github.io/EasyVtuber/](https://NimuthuGanegoda.github.io/EasyVtuber/)**

### 🛠️ Fix: "Loading..." Problem
If the page stays on a loading state, it is usually because the AI models are quite large (~20MB).
1. **Wait:** Give it 30-60 seconds on the first load.
2. **WebGPU/WebGL:** Ensure your browser has **Hardware Acceleration** enabled in settings.
3. **Camera:** If the viewport shows a camera error, check that nothing else is using the webcam and that the site has camera permission — the app now names the exact cause instead of spinning forever.

---

## 🎧 Connect to Discord / Streaming

To use your "Elite" avatar in Discord, Zoom, or OBS:

### Method 1: Desktop (Highest Quality)
1. Use the version in the `/desktop` folder.
2. Select **"OBS VirtualCam"** or **"Spout2"** as the Output in the launcher.
3. In Discord settings, select **"OBS Virtual Camera"** as your webcam.

### Method 2: Web (Pure Browser)
1. Open the [Live Web App](https://NimuthuGanegoda.github.io/EasyVtuber/).
2. Use **OBS Studio** to capture your browser window ("Window Capture").
3. Click **"Start Virtual Camera"** in OBS.
4. In Discord, select **"OBS Virtual Camera"**.

### ✨ Web Features
- **Zero Install**: Runs 100% on your device — MediaPipe face tracking in WebAssembly, no server round-trip.
- **Three renderers, graceful fallback**: a real VRM model if you supply one, otherwise GPU-accelerated procedural WebGL, otherwise Canvas 2D.
- **Privacy First**: All processing happens locally in your browser; nothing is uploaded.
- **Settings that persist**: camera source, GPU/CPU delegate, FPS cap and debug overlay are saved in `localStorage`.

---

## 🚀 Elite V2 (TypeScript + React + Wasm)

The "Elite Edition" has been rewritten for maximum performance on modern browsers using **React** and **MediaPipe Wasm**.

### 🛠️ How to run V2
```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

### 🎭 Character model (VRM)

By default the web app draws a simple procedural cartoon avatar (Canvas2D/WebGL
shapes) — no external assets needed, works out of the box. For a real,
professionally-rigged 3D character instead:

1. Design/export a character as a `.vrm` file. We recommend
   [VRoid Studio](https://vroid.com/en/studio) (free, from Pixiv) — build a
   character visually and export as VRM; since you're the creator, you own
   full rights to redistribute it.
2. Place the file at `web/public/models/character.vrm` and commit it.
3. That's it — the app detects the model automatically at startup and drives
   its head rotation, blink, and mouth shape from your webcam via
   [Kalidokit](https://github.com/yeemachine/kalidokit) (MediaPipe → VRM
   solving). The camera frames the model from its own bounding box, so chibi
   and non-standard proportions stay in shot. No model present, or it fails to
   load? The app falls back to the procedural avatar automatically — nothing
   breaks either way.

We deliberately did **not** build this against Live2D: its SDK license
explicitly requires a paid license for "VTuber tracking tools" like this one,
regardless of company size, which isn't something a public open-source repo
can quietly assume its way around. VRM + `@pixiv/three-vrm` + Kalidokit is
MIT-family licensed end to end.

---

## 🛡️ Security & Integrity

- **Strict Content Security Policy (CSP)**: `web/index.html` whitelists exactly the origins the app needs (MediaPipe CDN, GitHub API, avatar hosts). No wildcard script sources.
- **Automated Vulnerability Scanning**: CodeQL (`security.yml`) and Dependabot monitoring — both now run on `main` and on pull requests.
- **Local-only inference**: tracking, solving and rendering all happen on your machine.
- **Desktop web output is loopback-only** by default: the MJPEG server binds `127.0.0.1` and has no authentication, so LAN exposure is opt-in.

---

## 📂 Project Structure

| Path | What it is |
| --- | --- |
| `/web` | **Source** for the web app — React + TypeScript + Vite + MediaPipe |
| `/docs` | **Build output** of `/web`, committed and deployed by GitHub Pages (`deploy-pages.yml`). Regenerate with `npm --prefix web run build`; CI fails if it is stale. |
| `/` (`index.html`) | Forwards to `docs/` so the repository root URL works |
| `/desktop` | **Desktop suite** — Python + ONNX Runtime/TensorRT (THA3/THA4 via `ezvtuber-rt`) |
| `/legacy` | Archived JS bundles and older implementations (kept for reference, not built) |

---

## 🛠️ Contributor Excellence

Before submitting a PR:

```bash
cd web
npm ci
npm run typecheck     # strict TypeScript, no emits
npm run lint          # ESLint (react-hooks, typescript-eslint)
npm run format:check  # Prettier
npm test              # Vitest
npm run build         # must leave docs/ unchanged (see below)
```

And for the Python side:

```bash
python -m pip install -r desktop/requirements/requirements-dev.txt
python -m pytest desktop/tests -q
```

All of the above are enforced by CI (`web-ci.yml`, `python-package.yml`,
`windows-smoke.yml`). If you change anything under `web/src`, run
`npm --prefix web run build` and commit the regenerated `docs/` in the same PR.

---

## 🧪 Desktop Usage (For Power Users)

If you need even higher quality, frame interpolation (RIFE), or native OBS transparency, use the desktop version:

1. Navigate to the `desktop` folder.
2. Run `install_reqs.sh` or `install_reqs.bat`.
3. Launch the GUI with `python gui/launcher2.py` (or directly: `python main.py --character <name>`).

**Model weights are not bundled.** A fresh checkout ships empty placeholder
files, so the first launch will tell you what's missing. Download them once and
drop them under `desktop/data/models/` — see **`desktop/README.md` → "Model
weights"** for the exact layout and sources.

*See `desktop/README.md` for full desktop instructions.*

### 🪟 Windows Quick Start (Primary desktop target)

1. Open `desktop\` in terminal.
2. Run `install_reqs.bat`.
3. Launch with `python gui\launcher2.py`.
4. Keep TensorRT optional; ONNX Runtime (DirectML/OpenVINO/CPU) is the default fallback path. If TensorRT is selected but unavailable, the console now says exactly why before falling back.

Functional minimum on Windows:
- Launcher opens
- Webcam or VMC input works
- One model loads from local files
- VirtualCam or Debug output works
- Start/Stop relaunch is stable

---

## 🚀 Hardware Optimization

- **Web Version**: Automatically uses your browser's WebGL/WebGPU for acceleration.
- **Desktop Version**: Optimized for **Intel NPU**, **Apple Silicon**, and **High-end GPUs**. See `desktop/docs/NPU_OPTIMIZATION_GUIDE.md` and `desktop/docs/PerformanceTest.md`.

### Recommended desktop hardware tiers (Windows)

- **Tier 1 (best stability/performance):** NVIDIA GPU + optional TensorRT
- **Tier 2 (broad compatibility):** AMD/Intel GPU via DirectML
- **Tier 3 (fallback):** CPU/OpenVINO path when no GPU acceleration is available

---

## 🧑‍🎤 Credits & Acknowledgments
*   **Original Engine**: [Talking Head Anime 4](http://pkhungurn.github.io/talking-head-anime-4/) by **Pramook Khungurn**.
*   **Tracking**: [MediaPipe](https://google.github.io/mediapipe/) by Google.
*   **Desktop Runtime**: [ezvtuber-rt](https://github.com/zpeng11/ezvtuber-rt) by **zpeng11** (THA3/THA4 ONNX + TensorRT).
*   **Desktop Re-Engineering**: Enhanced and modularized by **Nimuthu**.

---

## 📜 License
MIT © GunwooHan & Pramook Khungurn. Re-Engineered by Nimuthu.
