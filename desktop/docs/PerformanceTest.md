# Performance Test Environment

### Setup
* Release version v0.3
* Test platform: Windows 10 22H2
* GPUs: Nvidia 3060 12G, Nvidia 1660 Super 6G, Intel ARC A770 16G, AMD RX580 8G.

### Test Variables
* Jpeg compression and Input Simplify set to 'Medium'
* Debug input and debug output enabled
* Eyebrow parameters disabled
* FPS limit set to 60fps
* Nvidia cards tested using TensorRT

Measurements were taken 5-10 seconds after startup, excluding long-term caching effects.

# Test Results

| GPU | Mode | Latency (ms) | GPU Usage | Notes |
| --- | --- | --- | --- | --- |
| 3060 12G | THA3 Standard Half (TRT) | 8-12ms | 15% | Very smooth |
| 1660S 6G | THA3 Standard Half (TRT) | 12-18ms | 25% | Good performance |
| ARC A770 | THA3 Standard Full (DML) | 25-35ms | 40% | Compatible via DirectML |
| RX580 8G | THA3 Standard Full (DML) | 40-50ms | 60% | Acceptable for older hardware |

*Note: Results are for reference only. Actual performance depends on your specific CPU, driver version, and background tasks.*

# Known Issues
* **Intel ARC A770**: RIFE interpolation (Full precision) produces artifacts; Waifu2x (Full precision) may output a solid green screen.
* **AMD RX580**: THA3 models in Half precision may produce distorted results.
* **Nvidia 3060**: Occasional unexplained spikes in GPU usage (likely driver-related).

# Thoughts on DirectML
DirectML allows this project to run on almost any Windows GPU and the latest AI PC NPUs. However, implementation differences in hardware kernels and drivers mean that certain models or precisions may produce "broken" (distorted or tinted) images.

For example, the RIFE model implementation was updated to batch multiple frames together. While this reduced VRAM usage and improved TensorRT performance, it caused the Intel A770 to produce distorted images in Full precision, though Half precision remained functional and faster.

On some AMD integrated graphics, certain THA3 kernels cannot run on the GPU and are offloaded to the CPU. This constant data transfer between GPU and CPU causes a massive performance drop.

Currently, the Python ONNX Runtime API has limited support for inspecting kernel compatibility before execution. We cannot programmatically predict if a specific hardware/precision combo will fail.

**Recommendation:** If you see strange visual glitches or unexpected lag, try switching the model precision (Half vs. Full) or the model version. Check the console for DirectML warnings. For the best, most hassle-free experience, an Nvidia GPU (7.5+ architecture) with TensorRT is highly recommended.
