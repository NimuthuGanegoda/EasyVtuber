# EasyVtuber  

> Spend your money on a better GPU instead of an expensive VTuber rig!

![OBS Record With Transparent Virtual Cam Input](assets/new_sample.gif)

This is a fork of [GunwooHan/EasyVtuber](https://github.com/GunwooHan/EasyVtuber).  
We have backported the iOS face tracking logic from the original [talking-head-anime-2-demo](https://github.com/pkhungurn/talking-head-anime-2-demo) to improve tracking quality. By using a direct UDP connection, we've achieved 60fps face tracking on iPhone, removing the bottleneck of the standard iFacialMocap PC client.

Finally, we've added custom shader support for OBS virtual cameras, unlocking native RGBA output without needing a green screen.

## Major Updates
* **TensorRT & DirectML Support**: Accelerated ONNX models for Nvidia, AMD, and Intel GPUs (including latest **Intel NPUs**).
* **RIFE Frame Interpolation**: Boosts FPS by 50-100%, allowing for much smoother motion on slower hardware.
* **Smart Caching**: Uses `brotli` compression to significantly reduce GPU load during long sessions.
* **Super Resolution**: Integrated `waifu2x` and `real-esrgan` for crystal clear output.
* **New Launcher**: Beautiful WxPython-based interface in English.
* **Spout2 Support**: Native transparent output directly to OBS.
* **THA V4 Support**: Includes the latest Talking Head Animation v4 models.

## Requirements

### Hardware
- **Tracking**: Mouse tracking (no camera needed), USB Webcam, or iPhone (iFacialMocap app).
- **GPU**: Most dedicated GPUs from the last 5 years (Nvidia/AMD/Intel). High-end integrated graphics (Intel Iris Xe/Arc) are also supported. See [Performance Test](PerformanceTest.md).

### Software
- Windows 10/11
- OBS Studio (for streaming/recording)
- Photoshop (to prepare your character images)

## Quick Start (Pre-built Package)
Download the latest all-in-one package from our releases or the following mirrors:
* [Google Drive](https://drive.google.com/drive/folders/1cYj18EfVQ2Cl348_rkCu_fgaasHTI_io?usp=drive_link)

### 1. Install Spout2 OBS Plugin (Optional)
Recommended for native transparency. Download the installer from [Off-World-Live/obs-spout2-plugin](https://github.com/Off-World-Live/obs-spout2-plugin/releases).

### 2. Launch
Double-click `01A.Launcher.bat` or `01B.Launcher_Debug.bat`.

## Input/Output Methods

### Spout2 Output (Recommended)
Native transparent background. Set the "Composite Mode" to **Premultiplied Alpha** in the OBS Spout2 source settings.

### iFacialMocap (Best Tracking)
Uses iPhone's TrueDepth camera. Enter your phone's IP in the launcher (default port 49983). Ensure your PC and phone are on the same local network.

### OpenSeeFace (High Precision Webcam)
Best for users without an iPhone. Download [OpenSeeFace](https://github.com/emilianavt/OpenSeeFace/releases), run `run.bat` with `--model 4`, and set the launcher input to `127.0.0.1:11573`.

### Intel NPU Optimization
If you have an **Intel Core Ultra** processor, you can run this project on your NPU via DirectML to save battery and GPU power. See [Performance Test](PerformanceTest.md) for details.

## Installation (for Developers)

1. **Install Anaconda**: [anaconda.com](https://www.anaconda.com)
2. **Setup Conda Environment**:
   ```bash
   conda create -y -n easyvtuber python=3.10
   conda activate easyvtuber
   conda install conda-forge::pycuda
   conda install -c nvidia/label/cuda-12.9.1 cuda-nvcc-dev_win-64 cudnn cuda-runtime
   ```
3. **Clone & Install Dependencies**:
   ```bash
   git clone https://github.com/NimuthuGanegoda/EasyVtuber.git
   cd EasyVtuber
   git submodule update --init --recursive
   pip install -r requirements.txt
   ```
4. **Download Models**: Place models in `data/models` from [this link](https://drive.google.com/file/d/1pWKIpjWeqfpa3Rub185FVvxDr5H09pOi/view?usp=drive_link).

## FAQ

**Q: I have an AMD/Intel GPU and the image looks distorted.**
A: This is often a DirectML driver issue. Ensure your drivers are up to date. Try switching model precision (Half vs Full) in the launcher.

**Q: How do I use my own character?**
A: Place a 512x512 PNG with transparency in `data/images`. It should then appear in the launcher dropdown.

**Q: Why doesn't Task Manager show GPU load?**
A: Some AI tasks show up under "Compute" or "Video Processing" instead of "3D". Click the graph name in Task Manager to change the view.

---
## References
* [Talking Head Anime 3](http://pkhungurn.github.io/talking-head-anime-3/)
* [RIFE: Real-Time Intermediate Flow Estimation](https://github.com/hzwer/ECCV2022-RIFE)
* [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
