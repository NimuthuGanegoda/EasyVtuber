import os
import sys
import zipfile
import threading
import urllib.request
import wx

def download_with_progress(url, dest_path, dialog):
    """Download a file with a wx progress dialog."""
    try:
        response = urllib.request.urlopen(url)
        total_size = int(response.info().get('Content-Length').strip())
        downloaded = 0
        chunk_size = 1024 * 1024 # 1MB

        with open(dest_path, 'wb') as f:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                percent = int((downloaded / total_size) * 100)
                # Ensure we only call GUI methods from the main thread if needed
                wx.CallAfter(dialog.Update, percent, f"Downloading: {percent}% ({downloaded//1048576}MB / {total_size//1048576}MB)")

        return True
    except Exception as e:
        print(f"Download failed: {e}")
        return False

# Model weights are large (100s of MB) neural network files not currently
# hosted anywhere in this project's release artifacts. Set this to a real,
# reachable URL (e.g. a GitHub release asset) once one exists.
MODEL_ZIP_URL = "https://github.com/NimuthuGanegoda/EasyVtuber/releases/download/v1.0.0/models.zip"

def check_and_download_models(parent_frame):
    """Check if critical models are missing and download+extract them if a
    real model archive URL is configured. Never fakes success: if the
    archive can't be fetched or extracted, this reports failure honestly
    with instructions instead of leaving a corrupt placeholder file behind
    that would crash later inside ONNX Runtime with a cryptic error."""
    base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    models_dir = os.path.join(base_dir, 'models')
    model_check_path = os.path.join(models_dir, 'tha3', 'standard', 'fp16', 'decomposer.onnx')

    if os.path.exists(model_check_path):
        return True # Models are present

    print("Models not found. Attempting to download model archive.")
    temp_zip_path = os.path.join(base_dir, 'models_temp.zip')

    dialog = wx.ProgressDialog(
        "Downloading AI Models",
        "Connecting to download required AI models... (May take a while)",
        maximum=100,
        parent=parent_frame,
        style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE | wx.PD_SMOOTH | wx.PD_CAN_ABORT
    )

    class DownloadThread(threading.Thread):
        def __init__(self):
            super().__init__()
            self.success = False
            self.error = None

        def run(self):
            try:
                os.makedirs(models_dir, exist_ok=True)
                ok = download_with_progress(MODEL_ZIP_URL, temp_zip_path, dialog)
                if not ok or not os.path.exists(temp_zip_path) or not zipfile.is_zipfile(temp_zip_path):
                    self.error = "Model archive could not be downloaded or is not a valid zip."
                    return

                wx.CallAfter(dialog.Update, 99, "Extracting models...")
                with zipfile.ZipFile(temp_zip_path, 'r') as zf:
                    zf.extractall(models_dir)

                if not os.path.exists(model_check_path):
                    self.error = "Archive extracted but expected model files were not found inside it."
                    return

                self.success = True
            except Exception as e:
                self.error = str(e)
            finally:
                if os.path.exists(temp_zip_path):
                    try:
                        os.remove(temp_zip_path)
                    except OSError:
                        pass
                wx.CallAfter(dialog.Destroy)

    t = DownloadThread()
    t.start()

    # We must wait for the thread but keep the GUI pumping
    while t.is_alive():
        wx.Yield()

    if not t.success:
        wx.MessageBox(
            "Failed to download AI models automatically"
            + (f":\n{t.error}" if t.error else ".")
            + "\n\nPlease download the model files manually and place them in:\n"
            + models_dir,
            "Model Download Failed", wx.ICON_ERROR)
        return False

    wx.MessageBox("AI Models successfully downloaded and installed!", "Success", wx.ICON_INFORMATION)
    return True
