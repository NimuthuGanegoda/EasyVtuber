import os
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
    desktop_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    models_dir = os.path.join(desktop_root, 'data', 'models')

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
