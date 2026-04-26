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

## 📂 Project Re-Architecture

To support both "Elite" local performance and "Pure Web" accessibility, the project is now structured as follows:

- **`/` (Root)**: The **Pure Web App**. Host this on GitHub Pages for an instant VTuber website.
- **`/desktop`**: The **High-Performance Desktop Suite**. Use this for NVIDIA TensorRT, Intel NPU (OpenVINO), and AMD DirectML acceleration.
- **`/data`**: Web-optimized character models and assets.

---

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
*   **Desktop Re-Engineering**: Enhanced and modularized by **Nimuthu**.

---

## 📜 License
MIT © GunwooHan & Pramook Khungurn. Re-Engineered by Nimuthu.
