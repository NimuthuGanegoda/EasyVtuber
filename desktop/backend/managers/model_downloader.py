import os
import sys
import wx

# This app is designed to run fully offline: it never opens a network
# connection on its own. Model weights are large (100s of MB - GB) neural
# network files that must be placed manually by the user (see
# desktop/README.md, "Model weights") — this module only checks locally
# whether they're present and tells the user clearly if they aren't.

# Any one of these existing (and non-empty) is treated as "at least one
# usable model is installed". Checked in order of how likely a user is to
# have set it up: the default model_version (v4_student) first, then the
# other supported variants.
_MODEL_MARKERS = [
    os.path.join('tha4_student', 'face_morpher.onnx'),
    os.path.join('tha4', 'fp16', 'decomposer.onnx'),
    os.path.join('tha3', 'standard', 'fp16', 'decomposer.onnx'),
    os.path.join('tha3', 'seperable', 'fp16', 'decomposer.onnx'),
]

_THA3_COMPONENTS = [
    'combiner.onnx', 'decomposer.onnx', 'editor.onnx', 'morpher.onnx',
    'rotator.onnx', 'merge.onnx', 'merge_no_eyebrow.onnx',
]

_THA4_COMPONENTS = [
    'body_morpher.onnx', 'combiner.onnx', 'decomposer.onnx', 'morpher.onnx',
    'upscaler.onnx', 'merge.onnx', 'merge_no_eyebrow.onnx',
]

_THA4_STUDENT_COMPONENTS = [
    'face_morpher.onnx', 'body_morpher.onnx', 'editor.onnx', 'rotator.onnx',
]


def get_desktop_root() -> str:
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return os.path.normpath(sys._MEIPASS)
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_models_dir() -> str:
    if getattr(sys, 'frozen', False):
        exe_models = os.path.join(os.path.dirname(sys.executable), 'data', 'models')
        if os.path.isdir(exe_models):
            return exe_models
    return os.path.join(get_desktop_root(), 'data', 'models')


def _check_components(base_dir: str, components):
    missing = []
    for comp in components:
        p = os.path.join(base_dir, comp)
        if not os.path.exists(p) or os.path.getsize(p) == 0:
            missing.append(comp)
    return missing


def validate_selected_model(model_select: str, model_name: str = '', use_tensorrt: bool = False):
    """Validate that the selected model variant has local files needed to launch."""
    models_dir = get_models_dir()

    if model_select.startswith('tha4_student_'):
        model_name = model_select.replace('tha4_student_', '', 1)
    if model_select.startswith('tha4_student'):
        if model_name:
            model_dir = os.path.join(models_dir, 'custom_tha4_models', model_name)
        else:
            model_dir = os.path.join(models_dir, 'tha4_student')
        required = _THA4_STUDENT_COMPONENTS
        if use_tensorrt and model_name:
            required = ['face_morpher.trt', 'body_morpher.trt', 'character.png']
        missing = _check_components(model_dir, required)
        return (len(missing) == 0, model_dir, missing)

    if 'tha4' in model_select:
        precision = 'fp16' if 'half' in model_select else 'fp32'
        model_dir = os.path.join(models_dir, 'tha4', precision)
        missing = _check_components(model_dir, _THA4_COMPONENTS)
        return (len(missing) == 0, model_dir, missing)

    precision = 'fp16' if 'half' in model_select else 'fp32'
    family = 'seperable' if 'seperable' in model_select else 'standard'
    model_dir = os.path.join(models_dir, 'tha3', family, precision)
    missing = _check_components(model_dir, _THA3_COMPONENTS)
    return (len(missing) == 0, model_dir, missing)


def check_models_present(parent_frame=None):
    """Return True if at least one supported model variant is installed
    locally. Never touches the network. On failure, shows a message box
    (if wx is running) with manual setup instructions; always returns a
    bool rather than raising, since a missing model shouldn't block the
    launcher UI from opening — it should just be visible before the user
    tries to launch and hits the (now-clear) runtime error instead."""
    # __file__ = desktop/backend/managers/model_downloader.py — three levels
    # up reaches desktop/, matching ezvtb_rt_interface.py's EZVTB_DATA path
    # (desktop/data/models), NOT desktop/backend/data (that's character images).
    models_dir = get_models_dir()

    for marker in _MODEL_MARKERS:
        path = os.path.join(models_dir, marker)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return True

    print(f"No model weights found under {models_dir}. See desktop/README.md, 'Model weights', for how to install them.")
    try:
        wx.MessageBox(
            "No AI model files were found.\n\n"
            "This app works fully offline and never downloads anything "
            "automatically — you need to place model weight files "
            "yourself before it can run.\n\n"
            "See desktop/README.md (\"Model weights\") for where to get "
            "them and where to put them:\n" + models_dir,
            "Model Files Missing", wx.ICON_WARNING)
    except Exception:
        pass  # wx.App may not be running yet in some call contexts.
    return False
