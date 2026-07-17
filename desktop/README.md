# EasyVtuber Desktop

Python backend that animates an anime character in real time from webcam/mocap
face tracking, using the Talking Head Anime (THA) neural posers. Windows is
the primary supported platform (NVIDIA TensorRT-RTX or DirectML acceleration);
it also runs on Linux/Mac via the ONNXRuntime CPU/GPU fallback path.

## Requirements

- Python 3.10 (required if you want TensorRT-RTX acceleration — its wheel is
  built only for cp310; other Python 3.x versions work fine for the
  ONNXRuntime-only path).
- Windows 10/11 for TensorRT-RTX or Spout2 output; any OS for the
  ONNXRuntime fallback.
- An NVIDIA GPU for TensorRT-RTX, or any DirectX 12 GPU for the DirectML
  ONNXRuntime provider on Windows.

## Install

From the `desktop/` folder:

```
install_reqs.bat      REM Windows
./install_reqs.sh      # Linux/Mac
```

This installs the core Python dependencies (OpenCV, ONNXRuntime, MediaPipe,
etc.) via pip. It does **not** install `tensorrt_rtx`/`pycuda` — those are a
separate NVIDIA SDK that isn't on PyPI; see "TensorRT-RTX acceleration"
below if you want that path. Without it, the app still runs on the
ONNXRuntime provider (DirectML on Windows, CPU/CUDA elsewhere).

## Offline by design

This app never opens a network connection on its own — no telemetry, no
license checks, no auto-download, nothing "phones home." Everything it
needs (model weights, character images, dependencies) must already be on
disk before you launch it; it does not need LAN, WiFi, or internet access
to run, and it works the same with your network adapter disabled entirely.

The only code paths that touch a socket at all are opt-in tracking inputs
you must explicitly enable with a flag (`--ifm_input`, `--osf_input`,
`--vmc_input`) or the local debug output server (`--output_web`, bound to
`127.0.0.1` by default) — none of these run unless you ask for them, and
none require internet, only (for the tracking inputs) another device on
your own LAN if you're not sending from the same machine.

## Model weights

**Not bundled — you must place them yourself.** The files under
`data/models/<tha3|tha4|tha4_student>/...` in a fresh checkout are empty
placeholders, not real model data. Consistent with "offline by design"
above, this app does **not** attempt to download them for you — the GUI
launcher just checks locally on startup whether any model variant is
present and shows a warning if not (`backend/managers/model_downloader.py`);
it never opens a connection to check or fetch anything.

To get real ONNX-format weights (THA3, RIFE, waifu2x, Real-ESRGAN — exported
by `ezvtb_rt`'s author for this exact runtime), download them yourself
(on any machine with internet, then transfer the files over if the machine
running this app is offline) from:

- https://github.com/zpeng11/ezvtuber-rt/releases/download/0.0.1/20241220.zip
  (~1.6GB; verified live)

Extract it and lay the contents out under `desktop/data/models/` matching the
structure `ezvtuber-rt/ezvtb_rt/init_utils.py` expects (`tha3/<seperable|standard>/<fp16|fp32>/*.onnx`,
`rife/rife_x{2,3,4}_<fp16|fp32>.onnx`, `waifu2x/...`, `Real-ESRGAN/...`) —
check the zip's own folder layout against that file if it doesn't match
exactly. THA4/THA4-student weights aren't in that archive; those come from
[pkhungurn/talking-head-anime-4-demo](https://github.com/pkhungurn/talking-head-anime-4-demo)
(PyTorch `.pt` checkpoints — you'd need to export them to ONNX yourself to
use with this app's `tha4`/`tha4_student` code paths). All THA weights are
CC-BY 4.0 (attribution: Pramook Khungurn), commercial use permitted.

Until real weights are in place for whichever `--model_version` you select,
everything else (tracking, launcher, output pipeline) runs fine, but model
loading will fail with a traceback in the console. The app detects this and
exits with a clear message within a second instead of hanging forever
(which is what it did before — the main process waited on the inference
process indefinitely with no indication it had died).

## Launch

GUI launcher (recommended — lets you pick character, input source, output,
and acceleration mode):

```
python gui\launcher2.py
```

Direct CLI:

```
python main.py --character Houshou_Marine --cam_input --output_virtual_cam
```

Available `--character` values are the filenames (without `.png`) in
`backend/data/images/`. Run `python main.py --help` for the full flag list
(input sources: `--cam_input`, `--ifm_input`, `--osf_input`, `--mouse_input`,
`--vmc_input`; outputs: `--output_virtual_cam` for OBS/UnityCapture,
`--output_spout2` for Spout2 — Windows-only, requires `pip install SpoutGL`
— or `--output_web` for a local MJPEG stream at `http://127.0.0.1:8000`).

### VMC protocol input

`--vmc_input host:port` (e.g. `--vmc_input 127.0.0.1:39539`) receives face
tracking over [VMC](https://protocol.vmc.info) (OSC/UDP) — the interop
standard used by VSeeFace, SnekStudio's VMCSender, Unreal's VMC Receiver
actor, and most VR/webcam trackers with a VMC export mode. Point any VMC
sender at the host:port you pass here. Use `0.0.0.0:<port>` instead of
`127.0.0.1` only if the sender runs on a different device on your network —
`127.0.0.1` is safer by default since VMC has no authentication.

Currently mapped: head rotation (pitch/yaw/roll, from the `Head` bone),
blinking, mouth vowel shapes (A/I/U/E/O and common ARKit/VRM aliases), and
eye look direction. Not mapped: eyebrow/emotion blend shapes, hand/body
bones, physics. Unmapped blend shapes are silently ignored.

## TensorRT-RTX acceleration (optional, Windows + NVIDIA only)

1. Download the TensorRT-RTX SDK zip from NVIDIA (see `scripts/pack_release.bat`
   for the exact version/URL this project targets) and extract it.
2. `pip install` the `tensorrt_rtx-*-cp310-*.whl` from that SDK, plus `pycuda`.
3. Pass `--use_tensorrt` (or check the launcher's "Use TensorRT" box — only
   enabled when an NVIDIA GPU is detected).

If TensorRT-RTX isn't installed or fails to initialize, the app automatically
falls back to ONNXRuntime.
