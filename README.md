# 🌸 EasyVtuber: Pure Web & Elite Edition

[![Web App](https://img.shields.io/badge/Web-Live_App_🌐-ff69b4)](https://NimuthuGanegoda.github.io/EasyVtuber/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Browser%20%7C%20Windows%20%7C%20Linux-green)](https://github.com/NimuthuGanegoda/EasyVtuber)

**100% Browser-Based VTubing is here!** 🌸💎

EasyVtuber has been upgraded to run entirely in your web browser. No Python, no heavy local backends, and no complex setup. Just open the link, give camera permission, and start your VTubing journey!

---

## 🌐 Live Web App (Pure Client-Side)

Experience the full power of Talking Head Anime 4 directly in your browser:
👉 **[https://NimuthuGanegoda.github.io/EasyVtuber/](https://NimuthuGanegoda.github.io/EasyVtuber/)**

### ✨ Web Features:
- **Zero Install**: Runs 100% on your device using TensorFlow.js.
- **Privacy First**: All processing happens locally in your browser. No video is ever sent to a server.
- **Smart Account**: Automatically remembers your last used model and settings.
- **Potato Mode**: Optimized performance for older hardware and low-end PCs.
- **Expressive Tracking**: Powered by MediaPipe FaceLandmarker for high-precision motion capture.
- **Distilled Models**: Uses ultra-lightweight student models (< 2MB) for real-time 30+ FPS performance.

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
