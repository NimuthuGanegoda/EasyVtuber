# Intel NPU & Low-End PC Optimization Guide

This project is optimized to run smoothly on low-end "Potato PCs" and modern laptops with **Intel Core Ultra** processors (NPUs).

## 1. Intel NPU Acceleration (OpenVINO)

If you have an Intel Core Ultra processor, you can offload the face tracking and animation to the built-in NPU. This saves battery and keeps your GPU free for gaming or streaming.

### How to Enable:
1. Ensure you have the OpenVINO runtime installed:
   ```bash
   pip install onnxruntime-openvino
   ```
2. The launcher will automatically detect `OpenVINOExecutionProvider`.
3. In the "Model Select" dropdown, choosing any **Half** precision model (e.g., `THA4 Half`) is recommended for the best NPU performance.

## 2. Low-End PC / Laptop Optimization

If you are running on an older laptop or a PC without a dedicated GPU:

- **Use "Half" Precision Models**: Always select "Half" (FP16) versions in the launcher. They are significantly faster and use less memory.
- **Enable RIFE Frame Interpolation**: Select `x2_half` or `x3_half`. This allows the AI to generate fewer frames while your screen displays a smooth 60fps.
- **Input Simplify**: Set this to "Higher" or "Highest". This increases the chance of hitting the "Smart Cache," which bypasses heavy GPU calculations when your face isn't moving much.
- **RAM Cache**: Increase your RAM cache if you have 16GB+ of memory. This drastically reduces GPU load over time.

## 3. DirectML for AMD/Intel GPUs

For users with AMD Radeon or Intel Arc/Iris Xe graphics, the project uses **DirectML**. 
- If you see visual artifacts (weird colors or distorted faces), try switching from **Half** to **Full** precision for that specific model.
- Ensure your Windows Graphics drivers are updated to the latest version.
