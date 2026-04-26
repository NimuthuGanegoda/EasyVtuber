# 🌸 EasyVtuber: The Elite & Lite AI Companion

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-green)](https://github.com/NimuthuGanegoda/EasyVtuber)
[![NPU Optimized](https://img.shields.io/badge/NPU-Intel_Core_Ultra_⚡-blue)](docs/NPU_OPTIMIZATION_GUIDE.md)

EasyVtuber is an elite, autonomous AI VTubing suite. Now reorganized for modularity and performance, it bridges the gap between complex VTuber rigs and "Super Lite" hardware.

---

## 📂 Project Structure

Re-engineered for clarity and cross-platform compatibility:
- **`backend/`**: Core animation engines (THA2/3/4) and real-time managers.
- **`gui/`**: Modular launchers for Windows and Linux.
- **`data/`**: Centralized models, character images, and assets.
- **`requirements/`**: Optimized dependency lists for ultra-lite installation.
- **`scripts/`**: Utility scripts for maintenance and setup.

---

## ✨ Elite Features

| Feature | Description |
| :--- | :--- |
| ⚡ **Hardware Accelerated** | Native support for **Intel NPU**, **Apple Silicon (Metal)**, **NVIDIA (TensorRT)**, and **AMD (DirectML)**. |
| 🎬 **THA v4 Support** | Integrated Talking Head Animation v4 for the most expressive anime movement. |
| 🏎️ **RIFE Interpolation** | Boost your FPS by 50-100% on low-end "Potato" hardware. |
| 📱 **UDP iPhone Link** | 60FPS high-precision face tracking via UDP direct connection. |
| 🧠 **Smart Caching** | Uses `brotli` to bypass GPU overhead when your face isn't moving. |

---

## 🛠️ Complete Installation Guide

### 🚀 Automatic Install (Recommended)
This script installs everything using `uv` for lightning speed and auto-configures your hardware backend.

**Windows:**
```cmd
install_reqs.bat
```

**Linux / macOS:**
```bash
chmod +x install_reqs.sh
./install_reqs.sh
```

---

## 🧪 Usage

### 💬 Unified Launcher
The best way to start is through the modern GUI:
```bash
python gui/launcher2.py
```

### ⚡ Direct Mode (Lite)
Start directly from the root with minimal overhead:
```bash
python main.py --character your_character_name
```

---

## 🚀 Hardware Optimization

- **Intel Core Ultra:** Automatically uses the **NPU** via OpenVINO/DirectML.
- **Mac M1/M2/M3:** Native **Apple Silicon** support for Metal acceleration.
- **AMD/NVIDIA:** High-performance **DirectML/TensorRT** backends.
- **Potato Mode:** Highly quantized models and "Half" precision modes for low-end CPUs.

---

## 📜 License
MIT © GunwooHan. Enhanced & Re-Engineered by Nimuthu.
