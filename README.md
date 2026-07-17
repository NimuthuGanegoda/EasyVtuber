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
If the page stays on "Loading Elite Experience...", it is usually because the AI models are quite large (~20MB). 
1. **Wait:** Give it 30-60 seconds on the first load.
2. **WebGPU/WebGL:** Ensure your browser has **Hardware Acceleration** enabled in settings.
3. **CORS/Mixed Content:** If you connect a local backend, click the **Lock (🔒)** icon in your browser, go to **Site Settings**, and set **"Insecure content"** to **Allow**.

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

### ✨ Web Features:
- **Zero Install**: Runs 100% on your device using TensorFlow.js.
- **Auto-Elite Detection**: Automatically scales performance based on your CPU/RAM.
- **Smart Setup Guidance**: In-app tips to fix common browser security and connection issues.
- **Privacy First**: All processing happens locally in your browser.
- **Smart Account**: Automatically remembers your last used model and settings.

---

## 🚀 New: Elite V2 (TypeScript + React + Wasm)

The "Elite Edition" has been rewritten for maximum performance on modern browsers using **React** and **MediaPipe Wasm**.

### ✨ V2 Features:
- **Modular Core**: Replaced the heavy JS bundle with a sleek React/TypeScript architecture.
- **Wasm Acceleration**: MediaPipe tracking now runs in high-performance WebAssembly.
- **Vite Pipeline**: Instant-on development and optimized builds.
- **Hyper-Potato Mode**: Dedicated optimizations for ancient Intel hardware.

### 🛠️ How to run V2:
1. Navigate to the `web` folder.
2. Run `npm install` and `npm run dev`.
3. Open the provided local link.

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
   solving). No model present, or it fails to load? The app falls back to the
   procedural avatar automatically — nothing breaks either way.

We deliberately did **not** build this against Live2D: its SDK license
explicitly requires a paid license for "VTuber tracking tools" like this one,
regardless of company size, which isn't something a public open-source repo
can quietly assume its way around. VRM + `@pixiv/three-vrm` + Kalidokit is
MIT-family licensed end to end.

---

## 🛡️ Security & Integrity

EasyVtuber Elite is built with a security-first mindset:
- **Strict Content Security Policy (CSP)**: Prevents unauthorized scripts and protects your session.
- **Automated Vulnerability Scanning**: Integrated CodeQL and Dependabot monitoring.
- **Sanitized Inputs**: All user-provided data is rigorously cleaned before processing.
- **Privacy First**: Tracking and inference happen 100% locally in your browser/device.

---

## 👤 Elite Account System

Sync your experience across devices with the **Velvet Rope** account system:
- **Cloud Sync**: Save your character selections, neural engine settings, and UI preferences.
- **Secure Authentication**: Powered by **Firebase** (Email & GitHub OAuth).
- **Pro Access**: Exclusive access to experimental features like WebGPU acceleration for registered souls.

---

## 📂 Project Structure
- **`/` (Root)**: Production Web Deployment (Live Environment).
- **`/web`**: **Source Code (Elite V2)** - React + TS + Firebase.
- **`/desktop`**: **Desktop Suite** - Python/PyTorch local environment.
- **`/legacy`**: Archived JS bundles and older implementations.

---

## 🛠️ Contributor Excellence

We demand technical perfection. Before submitting a PR:
1. Ensure all code is typed with **Strict TypeScript**.
2. Run `npm run lint` in the `/web` directory.
3. Run `npm run format` to adhere to our elite aesthetic standards.

## 🧪 Desktop Usage (For Power Users)

If you need even higher quality, frame interpolation (RIFE), or native OBS transparency, use the desktop version:

1. Navigate to the `desktop` folder.
2. Run `install_reqs.sh` or `install_reqs.bat`.
3. Launch with `python main.py`.

*See `desktop/README.md` for full desktop instructions.*

---

## 🚀 Hardware Optimization

- **Web Version**: Automatically uses your browser's WebGL/WebGPU for acceleration.
- **Desktop Version**: Optimized for **Intel NPU**, **Apple Silicon**, and **High-end GPUs**.

---

## 🧑‍🎤 Credits & Acknowledgments
*   **Original Engine**: [Talking Head Anime 4](http://pkhungurn.github.io/talking-head-anime-4/) by **Pramook Khungurn**.
*   **Tracking**: [MediaPipe](https://google.github.io/mediapipe/) by Google.
*   **Inference**: [TensorFlow.js](https://www.tensorflow.org/js).
*   **Code Graph Analysis**: [Graphify](https://github.com/Graphify-Labs/graphify) by **Graphify Labs**.
*   **Desktop Re-Engineering**: Enhanced and modularized by **Nimuthu**.

---

## 📜 License
MIT © GunwooHan & Pramook Khungurn. Re-Engineered by Nimuthu.
