# 🌸 EasyVtuber Studio — Pure Web & Desktop Edition

[![Web App](https://img.shields.io/badge/Live_Studio-Launch_Now_🌐-ff69b4)](https://NimuthuGanegoda.github.io/EasyVtuber/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Browser%20%7C%20Windows%20%7C%20Linux-green)](https://github.com/NimuthuGanegoda/EasyVtuber)

**Zero-install, privacy-first VTuber Studio in your browser — plus an offline-first Desktop AI edition.**

Open the live link, pick or drop your avatar (`.vrm` 3D model, transparent `.png` PNGTuber art, or the built-in customizable Studio Avatar), and start streaming to OBS, Twitch, YouTube, or Discord in seconds. Everything runs **100% locally on your device** — nothing is ever uploaded.

---

## 🌐 Live Public Web Studio

👉 **[https://NimuthuGanegoda.github.io/EasyVtuber/](https://NimuthuGanegoda.github.io/EasyVtuber/)**

### ✨ Key Studio Features

- **3 Ready-to-Use Avatar Engines**
  - **Studio 2D Avatar (Built-In):** 5 instant presets (*Sakura, Kitsune, Neko, Cyber, Midnight*), custom hair/eye/skin/outfit color pickers, reactive hair physics, and accessories (*Fox Ears, Cat Ears, Halo, Glasses, Horns*).
  - **PNGTuber 2D Mode:** Drop any transparent `.png`/`.webp` artwork (single image or **Idle + Talking + Blinking** multi-sprite sets) for instant 2.5D head parallax and voice-reactive talk bounce.
  - **VRM 3D Mode (`.vrm` 0.x & 1.0):** Drag-and-drop any VRoid Studio / VRM character for Kalidokit head/neck/spine/eye `lookAt` tracking, 3-point studio lighting (*Studio, Neon, Sunset, Moonlight*), and 7 facial expressions.
  - **Local Browser Persistence:** Uploaded `.vrm` models and PNGTuber sprites are saved locally in IndexedDB so they reload automatically next visit without ever leaving your machine.
- **Resilient Face Tracking & Voice Lip-Sync**
  - MediaPipe FaceLandmarker in WebAssembly with **automatic GPU → CPU delegate fallback**, redundant WASM CDN fallback, one-click **Pose Calibration (`C`)**, head sensitivity & smoothing sliders, organic auto-blink, and idle breathing.
  - Real-time **Microphone Lip-Sync** (Web Audio API with live VU meter, Gain, and Noise Gate) — works standalone even without a webcam.
  - Real **Privacy Camera Off** button that shuts down webcam hardware tracks immediately.
- **Broadcast-Ready OBS, Discord & Clip Export**
  - **Pop-Out OBS Stage Window (`Pop-Out`):** Opens a clean, zero-UI `1024×1024` HD stage window for OBS Window Capture while you control expressions, lighting, and scenes in the main tab.
  - **OBS Browser Source URL Parameters:** Supports `?clean=1&bg=transparent|green|blue|obsidian&mirror=1&cam=0&avatar=kitsune` plus an in-app **OBS Guide** modal with one-click URL copy.
  - **HD Media Export:** Crisp `1024×1024` PNG Snapshots (`Snap`) and live **WebM Video Clip Recording (`Rec`)** composited with your selected stage backdrop and optional live microphone audio.
  - **Named Scene Profiles & Rebindable Hotkeys:** Save/switch/export/import JSON scene profiles and click any hotkey to rebind it.

---

## 🎧 Connect to OBS Studio & Discord

### Method 1: Web Studio (Instant — No Install)
1. Open **[EasyVtuber Studio](https://NimuthuGanegoda.github.io/EasyVtuber/)** (works on desktop & mobile browsers).
2. Choose **Chroma Green** or **Chroma Blue** in the **Stage** tab and click **Pop-Out** in the bottom dock (or click **OBS Guide** in the header to copy a direct Browser Source URL).
3. In **OBS Studio**, add a **Window Capture** source targeting `EasyVtuber — OBS Stage` (with an optional Chroma Key filter).
4. For **Discord / Zoom / Meet**, click **Start Virtual Camera** in OBS and select **OBS Virtual Camera** in Discord's Voice & Video settings.

### Method 2: Desktop AI Edition (Talking Head Anime 3 / 4)
1. Use the offline Python suite in `/desktop` for neural portrait animation, RIFE frame interpolation, and native Spout2 / OBS VirtualCam output.
2. See [`desktop/README.md`](desktop/README.md) for setup and model weights.

---

## 🚀 Local Development (Web Studio)

```bash
cd web
npm ci
npm run dev      # http://localhost:5173
```

### Verification Before PR
```bash
cd web
npm run typecheck     # strict TypeScript
npm run lint          # ESLint (React Compiler & TypeScript rules)
npm run format:check  # Prettier
npm test              # Vitest unit suite
npm run build         # builds into ../docs/ (must be committed in sync)
```

For the Python desktop suite:
```bash
python -m pip install -r desktop/requirements/requirements-dev.txt
python -m pytest desktop/tests -q
```

---

## 🧪 Desktop Quick Start

### Windows
```bat
cd desktop
install_reqs.bat
start_launcher.bat
```

### Linux / macOS
```bash
cd desktop
chmod +x install_reqs.sh start_launcher.sh
./install_reqs.sh
./start_launcher.sh
```

> **Note on Desktop Model Weights:** The desktop edition is offline-by-design and does not bundle multi-GB neural weights. See [`desktop/README.md`](desktop/README.md) ("Model weights") for the exact layout and download link.

---

## 📂 Project Structure

| Path | Description |
| --- | --- |
| `/web` | **Web Studio source** — React 19, TypeScript, Vite, Three.js (`@pixiv/three-vrm`), Kalidokit, MediaPipe WASM |
| `/docs` | **Production bundle** deployed automatically to GitHub Pages (`deploy-pages.yml`) |
| `/desktop` | **Offline Desktop Suite** — Python, wxPython Studio Launcher, ONNX Runtime / TensorRT-RTX (`ezvtuber-rt`), VMC/OSC |
| `/legacy` | Archived legacy bundles (kept for reference only) |

---

## 🛡️ Security & Privacy

- **Strict Content Security Policy (CSP)** in `web/index.html` whitelisting only required WASM/model/font/avatar origins.
- **100% Local Processing:** Face tracking, audio lip-sync, VRM/PNG rendering, and IndexedDB avatar caching all stay strictly on your device.
- **Automated Security & CI:** CodeQL (`security.yml`), Dependabot, `web-ci.yml`, `python-package.yml`, and `windows-smoke.yml` run on every PR and push.

---

## 🧑‍🎤 Credits & Acknowledgments

- **Original Engine**: [Talking Head Anime 4](http://pkhungurn.github.io/talking-head-anime-4/) by **Pramook Khungurn**.
- **Tracking & VRM**: [MediaPipe](https://google.github.io/mediapipe/), [`@pixiv/three-vrm`](https://github.com/pixiv/three-vrm), and [Kalidokit](https://github.com/yeemachine/kalidokit) (MIT-family licensed end to end).
- **Desktop Runtime**: [ezvtuber-rt](https://github.com/zpeng11/ezvtuber-rt) by **zpeng11**.
- **Re-Engineering & Studio Edition**: Enhanced and maintained by **Nimuthu**.

## 📜 License

MIT © GunwooHan & Pramook Khungurn. Re-Engineered by Nimuthu.
