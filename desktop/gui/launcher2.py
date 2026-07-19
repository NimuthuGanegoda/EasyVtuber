import ctypes
import importlib.util
import os
import subprocess
import threading

import wx
import json
import sys

if sys.platform == 'win32':
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
p = None
cache_simplify_map = {
    'Off': 0,
    'Low': 1,
    'Medium': 2,
    'High': 3,
    'Higher': 4,
    'Highest': 6,
    'Gaming': 8
}

cache_simplify_quality_map = {
    'Off': 100,
    'Low': 99,
    'Medium': 95,
    'High': 90,
    'Higher': 85,
    'Highest': 80,
    'Gaming': 75
}
default_arg = {
    'character': 'Houshou_Marine',
    'input': 3,
    'output': 2,
    'ifm': None,
    'osf': '127.0.0.1:11573',
    'vmc': '127.0.0.1:39539',
    'min_cutoff': 50,
    'beta': 80,
    'is_extend_movement': False,
    'is_alpha_split': False,
    'is_bongo': False,
    'is_alpha_clean': False,
    'is_eyebrow': False,
    'cache_simplify': 'High',
    'ram_cache_size': '2gb',
    'vram_cache_size': '2gb',
    'model_select': 'seperable_half',
    'interpolation': "Off",
    'frame_rate_limit': '30',
    'sr': "Off",
    'use_tensorrt': False,
    'allow_unsafe_launch': False,
    'preset': 'Low',
    'mouse_audio_input': False,
    'audio_sensitivity': '0.02',
    'audio_threshold': '10.0',
    'blink_interval': '5.0',
    'breath_cycle': 'inf'
}

try:
    f = open('launcher.json')
    args = json.load(f)
    default_arg.update(args)
    f.close()
except:
    pass
finally:
    args = default_arg

p = None


def _runtime_desktop_root():
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return os.path.normpath(sys._MEIPASS)
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))


# Resolve relative to this file/runtime bundle, not the process CWD.
_DESKTOP_ROOT = _runtime_desktop_root()
dirPath = os.path.join(_DESKTOP_ROOT, 'backend', 'data', 'images')
characterList = []
studentModelList = []
studentModelCharacterMap = {}

def is_nvidia_gpu():
    if sys.platform != 'win32':
        return False
    # Prefer PowerShell's CIM cmdlets: `wmic` is deprecated and removed on
    # newer Windows 11/Server builds. Decode as UTF-8 (PowerShell's default
    # console encoding) rather than a hardcoded 'gbk', which only works on
    # Chinese-locale Windows and raises UnicodeDecodeError everywhere else.
    try:
        output = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command",
             "(Get-CimInstance Win32_VideoController).Name"],
            stderr=subprocess.DEVNULL,
        ).decode('utf-8', errors='ignore')
        if output.strip():
            return "NVIDIA" in output.upper()
    except Exception:
        pass
    # Fallback for systems without PowerShell CIM cmdlets available.
    try:
        output = subprocess.check_output(
            "wmic path Win32_VideoController get Name", shell=True,
            stderr=subprocess.DEVNULL,
        ).decode(sys.getfilesystemencoding(), errors='ignore')
        return "NVIDIA" in output.upper()
    except Exception:
        return False
hasTRTSupport = is_nvidia_gpu()

def refreshList():
    global characterList
    characterList = []
    for item in sorted(os.listdir(dirPath), key=lambda x: -os.path.getmtime(os.path.join(dirPath, x))):
        if '.png' == item[-4:]:
            characterList.append(item[:-4])


def scanStudentModels():
    """Scan custom_tha4_models directory for student models"""
    global studentModelList, studentModelCharacterMap
    studentModelList = []
    studentModelCharacterMap = {}

    custom_models_path = os.path.join(_DESKTOP_ROOT, 'data', 'models', 'custom_tha4_models')
    if os.path.exists(custom_models_path):
        try:
            for model_name in os.listdir(custom_models_path):
                model_path = os.path.join(custom_models_path, model_name)
                if os.path.isdir(model_path):
                    # Check if it's a valid student model
                    face_trt = os.path.join(model_path, 'face_morpher.trt')
                    body_trt = os.path.join(model_path, 'body_morpher.trt')
                    character_png = os.path.join(model_path,
                                                 'character.png')
                    has_trt = (os.path.exists(face_trt) and
                               os.path.exists(body_trt))
                    has_character = os.path.exists(character_png)

                    if has_trt and has_character:
                        studentModelList.append(model_name)
                        studentModelCharacterMap[model_name] = model_name
        except Exception:
            pass

    # Sort alphabetically
    studentModelList.sort()


refreshList()
scanStudentModels()


def _module_available(module_name):
    return importlib.util.find_spec(module_name) is not None


def _check_camera_access():
    cap = None
    try:
        import cv2
        if sys.platform == 'win32':
            cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            return False
        ok, _ = cap.read()
        return bool(ok)
    except Exception:
        return False
    finally:
        if cap is not None:
            cap.release()


def run_preflight(launch_args):
    errors = []
    warnings = []

    main_script = os.path.join(_DESKTOP_ROOT, 'main.py')
    if not os.path.exists(main_script):
        errors.append(f"Runtime entrypoint not found: {main_script}")

    if launch_args.get('use_tensorrt'):
        if sys.platform != 'win32':
            errors.append("TensorRT mode is currently supported only on Windows builds.")
        if not hasTRTSupport:
            errors.append("TensorRT was selected but no NVIDIA GPU was detected.")
        py_ver = sys.version_info
        if not (py_ver.major == 3 and py_ver.minor == 10):
            errors.append("TensorRT path requires Python 3.10 in this project.")

    output_mode = launch_args.get('output')
    if output_mode == 0:
        if sys.platform != 'win32':
            errors.append("Spout2 output is Windows-only.")
        if not _module_available('SpoutGL'):
            errors.append("Spout2 output requires SpoutGL. Install optional Windows dependencies.")
    elif output_mode == 3:
        if not _module_available('fastapi') or not _module_available('uvicorn'):
            errors.append("Web output requires FastAPI and Uvicorn. Install optional Windows dependencies.")
    elif output_mode == 1:
        if not _module_available('pyvirtualcam'):
            errors.append("Virtual camera output requires pyvirtualcam.")

    input_mode = launch_args.get('input')
    if input_mode == 1 and not _check_camera_access():
        errors.append("Webcam input selected but camera could not be opened.")
    if input_mode == 5:
        vmc = launch_args.get('vmc', '')
        if not vmc or ':' not in vmc:
            errors.append("VMC input must be in host:port format (example: 127.0.0.1:39539).")

    model_select = launch_args.get('model_select', '')
    model_name = ''
    if model_select.startswith('tha4_student_'):
        model_name = model_select.replace('tha4_student_', '', 1)
    try:
        if _DESKTOP_ROOT not in sys.path:
            sys.path.append(_DESKTOP_ROOT)
        from backend.managers.model_downloader import validate_selected_model
        ok, model_dir, missing = validate_selected_model(
            model_select=model_select,
            model_name=model_name,
            use_tensorrt=bool(launch_args.get('use_tensorrt')),
        )
        if not ok:
            errors.append(
                f"Model files are missing for '{model_select}' in {model_dir} (missing: {', '.join(missing)})."
            )
    except Exception as exc:
        warnings.append(f"Could not validate selected model files before launch: {exc}")

    return errors, warnings


def min_cutoff_mapper(value, revert=False):
    """
    Non-linear mapping function: 0-100 integer <-> 0-100 float
    Uses square function so numbers are denser closer to 0
    """
    if revert:
        # Float -> Int: Use square root inverse mapping
        return int((value / 100.0) ** 0.5 * 100)
    # Int -> Float: Use square mapping
    return (value / 100.0) ** 2 * 100.0


def beta_mapper(value, revert=False):
    """
    Non-linear mapping function: 0-100 integer <-> 0-1 float
    Uses square function so numbers are denser closer to 0
    """
    if revert:
        # Float -> Int: Use square root inverse mapping
        return int((value ** 0.5) * 100)
    # Int -> Float: Use square mapping
    return (value / 100.0) ** 2


class OptionPanel(wx.Panel):
    def __init__(self, parent, title='', desc='', choices=None, mapping=None, type=0, default=None, disabled=False, mapper=min_cutoff_mapper):
        wx.Panel.__init__(self, parent)
        self.type = type
        if mapping is not None:
            self.mapping = mapping
        else:
            self.mapping = choices
        mainSizer = wx.BoxSizer(wx.HORIZONTAL)
        leftSizer = wx.BoxSizer(wx.VERTICAL)
        self.SetSizer(mainSizer)
        titleText = wx.StaticText(self, wx.ID_ANY, title)
        titleFont = titleText.GetFont()
        titleFont.SetWeight(wx.FONTWEIGHT_SEMIBOLD)
        titleText.SetFont(titleFont)
        leftSizer.Add(titleText, 0, wx.ALL, 0)
        descText = wx.StaticText(self, wx.ID_ANY, desc)
        descFont = descText.GetFont()
        descFont.SetWeight(wx.FONTWEIGHT_EXTRALIGHT)
        descText.SetFont(descFont)
        leftSizer.Add(descText, 0, wx.ALL, 0)
        mainSizer.Add(leftSizer, 1, wx.EXPAND | wx.ALL, 0)
        if self.type == 0:
            self.control = wx.Choice(self, wx.ID_ANY, choices=choices)
            self.control.SetMinSize(wx.Size(300, -1))
            try:
                if default is not None:
                    if self.mapping:
                        self.control.SetSelection(self.mapping.index(default))
                    else:
                        self.control.SetSelection(default)
            except:
                pass
        elif self.type == 1:
            self.control = wx.CheckBox(self, wx.ID_ANY)
            try:
                if default is not None:
                    if self.mapping:
                        self.control.SetValue(self.mapping[default])
                    else:
                        self.control.SetValue(default)

            except:
                pass
        elif self.type == 2:
            self.control = wx.TextCtrl(self, wx.ID_ANY)
            self.control.SetMinSize(wx.Size(300, -1))
            try:
                if default is not None:
                    if self.mapping:
                        self.control.SetValue(self.mapping[default])
                    else:
                        self.control.SetValue(default)
            except:
                pass
        elif self.type == 3:
            # Slider type for float values 0.0 to 1.0
            sliderSizer = wx.BoxSizer(wx.HORIZONTAL)
            self.control = wx.Slider(self, wx.ID_ANY, value=50, minValue=0, maxValue=100, 
                                    style=wx.SL_HORIZONTAL)
            self.control.SetMinSize(wx.Size(250, -1))
            
            # Add a label to show the float value
            self.valueLabel = wx.StaticText(self, wx.ID_ANY, "0.50")
            self.valueLabel.SetMinSize(wx.Size(50, -1))
            
            try:
                if default is not None:
                    self.control.SetValue(default)
                    self.valueLabel.SetLabelText(f"{mapper(default):.4f}")
            except:
                pass
            
            # Update label when slider changes
            def onSliderChange(event):
                val = mapper(self.control.GetValue())
                self.valueLabel.SetLabelText(f"{val:.4f}")
            self.control.Bind(wx.EVT_SLIDER, onSliderChange)
            
            sliderSizer.Add(self.control, 1, wx.ALIGN_CENTER_VERTICAL)
            sliderSizer.Add(self.valueLabel, 0, wx.ALIGN_CENTER_VERTICAL | wx.LEFT, 10)
            mainSizer.Add(sliderSizer, 0, wx.ALIGN_CENTER_VERTICAL | wx.LEFT, 20)
            # Skip the normal control addition below
            self.control._slider_added = True

        if not (self.type == 3 and hasattr(self.control, '_slider_added')):
            mainSizer.Add(self.control, 0, wx.ALIGN_CENTER_VERTICAL | wx.LEFT, 20)

    def GetValue(self):
        if self.type == 0:
            ret = self.control.GetSelection()
        elif self.type == 1:
            ret = self.control.GetValue()
        elif self.type == 2:
            ret = self.control.GetValue()
        elif self.type == 3:
            ret = self.control.GetValue()
        if self.mapping is not None:
            return self.mapping[ret]
        else:
            return ret


def _important_log_line(line):
    """Extract 'important' short descriptions from main log lines for status bar; returns None for irrelevant lines."""
    line = line.strip()
    if not line:
        return None
    if line.startswith('Launched:'):
        return 'Launched'
    if 'Model Inference Ready' in line:
        return 'Model Inference Ready'
    # TRT: Building engine from ONNX: ...\filename.onnx
    if '[TRT]' in line and 'Building engine from ONNX:' in line:
        idx = line.find('Building engine from ONNX:')
        if idx != -1:
            path = line[idx + len('Building engine from ONNX:'):].strip().rstrip('\r\n')
            name = os.path.basename(path)
            if name:
                return f'Building: {name}'
    # TRT: Loading ONNX file from path ...\filename.onnx
    if '[TRT]' in line and 'Loading ONNX file from path' in line:
        idx = line.find('Loading ONNX file from path')
        if idx != -1:
            path = line[idx + len('Loading ONNX file from path'):].strip().strip('.').strip().rstrip('\r\n')
            name = os.path.basename(path)
            if name:
                return f'Loading: {name}'
    # ORT: Loading ONNX model from path ...\filename.onnx
    if '[ORT]' in line and 'Loading ONNX model from path' in line:
        idx = line.find('Loading ONNX model from path')
        if idx != -1:
            path = line[idx + len('Loading ONNX model from path'):].strip().strip('.').strip().rstrip('\r\n')
            name = os.path.basename(path)
            if name:
                return f'Loading: {name}'
    # ORT: Completed loading session: xxx.onnx
    if '[ORT]' in line and 'Completed loading session:' in line:
        idx = line.find('Completed loading session:')
        if idx != -1:
            name = line[idx + len('Completed loading session:'):].strip().rstrip('\r\n')
            if name:
                return f'Loaded: {name}'
    return None


def _on_main_log_line(panel, line):
    """Called in sub-thread: update panel status box if line is important."""
    display = _important_log_line(line)
    if display is not None:
        wx.CallAfter(panel.statusCtrl.SetValue, display)


def _read_pipe_to_stream(pipe, dest_stream, out_lines=None, on_line_callback=None):
    """Read from pipe, write to dest_stream, optionally append to out_lines and callback."""
    if pipe is None:
        return
    try:
        for raw in iter(pipe.readline, b''):
            try:
                text = raw.decode('utf-8', errors='replace')
            except Exception:
                text = raw.decode('gbk', errors='replace')
            if out_lines is not None:
                out_lines.append(text)
            if on_line_callback is not None:
                on_line_callback(text)
            # Check if dest_stream is available (might not be in pythonw)
            if dest_stream is not None:
                try:
                    dest_stream.write(text)
                    dest_stream.flush()
                except (AttributeError, OSError, ValueError):
                    pass
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass


class LauncherPanel(wx.Panel):
    def __init__(self, parent):
        wx.Panel.__init__(self, parent)
        self.number_of_buttons = 0
        self.frame = parent
        self.optionDict = {}
        self.main_output_lines = []   # Copy of main stdout
        self.main_stderr_lines = []   # Copy of main stderr
        self._stopping = False
        self.mainSizer = wx.BoxSizer(wx.VERTICAL)
        controlSizer = wx.BoxSizer(wx.HORIZONTAL)
        self.widgetSizer = wx.BoxSizer(wx.VERTICAL)

        stEasy = wx.StaticText(self, wx.ID_ANY, "Easy")
        f = stEasy.GetFont()
        f.SetWeight(wx.FONTWEIGHT_HEAVY)
        f = f.MakeLarger()
        stEasy.SetFont(f)
        stVtuber = wx.StaticText(self, wx.ID_ANY, "Vtuber")
        f = stVtuber.GetFont()
        f.SetWeight(wx.FONTWEIGHT_LIGHT)
        f = f.MakeLarger()
        stVtuber.SetFont(f)
        controlSizer.Add(stEasy, 0, wx.ALL | wx.CENTER, 0)
        controlSizer.Add(stVtuber, 0, wx.RIGHT | wx.CENTER, 30)

        self.statusCtrl = wx.TextCtrl(
            self, wx.ID_ANY, '',
            style=wx.TE_READONLY | wx.BORDER_NONE | wx.TE_RIGHT,
        )
        self.statusCtrl.SetHint('Status')
        f = self.statusCtrl.GetFont()
        self.statusCtrl.SetFont(f.Smaller())
        controlSizer.Add(self.statusCtrl, 1, wx.ALIGN_CENTER_VERTICAL | wx.LEFT | wx.RIGHT, 8)

        self.btnLaunch = wx.Button(self, label="Save && Launch")
        self.btnLaunch.Bind(wx.EVT_BUTTON, self.OnLaunch)
        controlSizer.Add(self.btnLaunch, 0, wx.CENTER | wx.ALL, 10)

        self.mainSizer.Add(self.widgetSizer, 0, wx.CENTER | wx.ALL, 10)
        self.mainSizer.Add(controlSizer, 0, wx.CENTER | wx.EXPAND | wx.LEFT, 10)
        self.mainSizer.Add(wx.StaticLine(self), 0, wx.EXPAND | wx.LEFT | wx.RIGHT, 8)
        self.SetSizer(self.mainSizer)
        self.optionSizer = wx.BoxSizer(wx.VERTICAL)
        self.mainSizer.Add(self.optionSizer, 0, wx.EXPAND | wx.CENTER | wx.ALL, 2)

        def addOption(key, **kwargs):
            kwargs['default'] = args[key]
            t = OptionPanel(self, **kwargs)
            self.optionSizer.Add(t, 0, wx.EXPAND | wx.ALL, 5)
            self.optionDict[key] = t
            return t

        addOption('character', title='Character', desc='Select character image from data/images',
                  choices=characterList)

        addOption('input', title='Input Device', desc='Select face tracking source',
                  choices=['iFacialMocap', 'OpenSeeFace', 'OpenCV(Webcam)', 'Mouse Input', 'Debug Input', 'VMC Protocol'],
                  mapping=[0, 4, 1, 3, 2, 5])
        addOption('ifm', title='iFacialMocap IP', desc='IP address for iFacialMocap (default port 49983)', type=2)
        addOption('is_eyebrow', title='Eyebrow', desc='Enable eyebrow tracking (affects performance)', type=1,
                  default=True)
        addOption('osf', title='OpenSeeFace IP:Port', desc='IP and port for OpenSeeFace connection', type=2)
        addOption('vmc', title='VMC Listen IP:Port', desc='Local address to receive VMC tracking data on (e.g. 127.0.0.1:39539)',
                  type=2)
        addOption('mouse_audio_input', title='Audio Input', desc='Enable WASAPI audio input for lip sync', type=1)
        addOption('audio_sensitivity', title='Audio Sensitivity', desc='Sensitivity of lip sync to audio level', type=2)
        addOption('audio_threshold', title='Audio Threshold', desc='Noise gate threshold for audio input', type=2)
        addOption('blink_interval', title='Blink Interval', desc='Auto-blink frequency for mouse input',
                  choices=['No Blink', '3 seconds', '5 seconds', '7 seconds'],
                  mapping=['inf', '3.0', '5.0', '7.0'])
        addOption('min_cutoff', title='Min CutOff', desc='Filter frequency cutoff (Lower = smoother, Higher = responsive)', 
                  type=3, mapper=min_cutoff_mapper)
        addOption('beta', title='Beta', desc='Filter speed compensation (Lower = smoother, Higher = responsive)', 
                  type=3, mapper=beta_mapper)

        addOption('breath_cycle', title='Breath Cycle', desc='Auto-breath cycle (increases CPU usage)',
                  choices=['No Breath', '3 seconds', '5 seconds', '7 seconds'],
                  mapping=['inf', '3.0', '5.0', '7.0'])

        addOption('output', title='Output', desc='Select video output target',
                  choices=['Spout2', 'OBS VirtualCam', 'Debug Output', 'Web Server (Browser)'],
                  mapping=[0, 1, 2, 3])

        addOption('use_tensorrt', title='TensorRT Acceleration',
                  desc='Faster performance, longer startup (NVIDIA GPU only)',
                  type=1)
        addOption('allow_unsafe_launch', title='Allow Unsafe Launch',
                  desc='Bypass preflight blocks for unsupported/missing dependencies',
                  type=1)

        addOption('frame_rate_limit', title='FPS Limit', desc='Frame rate cap',
                  choices=['10', '15', '20', '30', '60'])
        addOption('preset', title='Performance Preset', desc='Presets will override detailed settings below',
                  choices=['Low', 'Medium', 'High', 'Ultra', 'Custom'])

        # Build model_select choices
        model_choices = ['Seperable Half', 'Seperable Full', 'Standard Half',
                         'Standard Full', 'THA4 Half', 'THA4 Full']
        model_mapping = ['seperable_half', 'seperable_full',
                         'standard_half', 'standard_full', 'tha4_half',
                         'tha4_full']

        # Add student models if available
        for student_model in studentModelList:
            model_choices.append(f'THA4 Student ({student_model})')
            model_mapping.append(f'tha4_student_{student_model}')

        addOption('model_select', title='Model Select',
                  desc='Select AI model version (Standard Full is higher quality)',
                  choices=model_choices,
                  mapping=model_mapping)
        addOption('ram_cache_size', title='RAM Cache Size', desc='Memory for final result caching',
                  choices=['Off', '1GB', '2GB', '4GB', '8GB', '16GB'],
                  mapping=['0b', '1gb', '2gb', '4gb', '8gb', '16gb'])
        addOption('vram_cache_size', title='VRAM Cache Size', desc='GPU memory for intermediate caching',
                  choices=['Off', '1GB', '2GB', '4GB', '8GB', '16GB'],
                  mapping=['0b', '1gb', '2gb', '4gb', '8gb', '16gb'])
        addOption('cache_simplify', title='Input Simplify',
                  desc='Higher simplification = more cache hits but less smooth',
                  choices=['Off', 'Low', 'Medium', 'High', 'Higher', 'Highest', 'Gaming'])

        addOption('sr', title='SuperResolution', desc='AI upscaling model (ESRGAN is high quality but heavy)',
                  choices=['Off', 'anime4k_x2', 'waifu2x_x2_half', 'real-esrgan_x4_half', 'waifu2x_x2_full',
                           'real-esrgan_x4_full'])
        addOption('interpolation', title='Frame Interpolation', desc='RIFE model for smoother FPS',
                  choices=['Off', 'x2_half', 'x3_half', 'x4_half', 'x2_full', 'x3_full', 'x4_full'])

        addOption('is_alpha_clean', title='Alpha Preprocessing',
                  desc='Clean up character edges (useful for LayerDiffusion)',
                  type=1)
        addOption('is_extend_movement', title='Extend Movement', desc='Enable virtual X/Y movement and scaling based on face tracking',
                  type=1)
        addOption('is_bongo', title='Bongocat Mode', desc='Rotate output to fit Bongocat desktop pet', type=1)
        addOption('is_alpha_split', title='Alpha Split', desc='Split alpha channel to right side of video stream',
                  type=1)

        def inputChoice(e=None):
            s = self.optionDict['input'].GetValue()
            if s != 0:
                self.optionSizer.Hide(self.optionDict['ifm'])
                self.optionSizer.Hide(self.optionDict['is_eyebrow'])
            else:
                self.optionSizer.Show(self.optionDict['ifm'])
                self.optionSizer.Show(self.optionDict['is_eyebrow'])
            if s != 4:
                self.optionSizer.Hide(self.optionDict['osf'])
            else:
                self.optionSizer.Show(self.optionDict['osf'])
                self.optionSizer.Show(self.optionDict['is_eyebrow'])
            if s != 5:
                self.optionSizer.Hide(self.optionDict['vmc'])
            else:
                self.optionSizer.Show(self.optionDict['vmc'])
            if s != 1 and s != 4 and s != 5:
                self.optionSizer.Hide(self.optionDict['min_cutoff'])
                self.optionSizer.Hide(self.optionDict['beta'])
            else:
                self.optionSizer.Show(self.optionDict['min_cutoff'])
                self.optionSizer.Show(self.optionDict['beta'])
            if s != 3:
                self.optionSizer.Hide(self.optionDict['mouse_audio_input'])
                self.optionSizer.Hide(self.optionDict['audio_sensitivity'])
                self.optionSizer.Hide(self.optionDict['audio_threshold'])
                self.optionSizer.Hide(self.optionDict['blink_interval'])
            else:
                self.optionSizer.Show(self.optionDict['mouse_audio_input'])
                self.optionSizer.Show(self.optionDict['blink_interval'])
                audioInputChoice()

            self.frame.fSizer.Layout()
            self.frame.Fit()

        def audioInputChoice(e=None):
            """Handle mouse_audio_input checkbox changes"""
            enabled = self.optionDict['mouse_audio_input'].GetValue()
            if enabled:
                self.optionSizer.Show(self.optionDict['audio_sensitivity'])
                self.optionSizer.Show(self.optionDict['audio_threshold'])
                self.optionDict['audio_sensitivity'].control.Enable(True)
                self.optionDict['audio_threshold'].control.Enable(True)
            else:
                self.optionSizer.Hide(self.optionDict['audio_sensitivity'])
                self.optionSizer.Hide(self.optionDict['audio_threshold'])
            self.frame.fSizer.Layout()
            self.frame.Fit()

        self.optionDict['input'].Bind(wx.EVT_CHOICE, inputChoice)
        self.optionDict['mouse_audio_input'].Bind(wx.EVT_CHECKBOX, audioInputChoice)
        inputChoice()

        def presetChoice(e=None):
            s = self.optionDict['preset'].GetValue()
            presetControls = [
                self.optionDict['model_select'],
                self.optionDict['ram_cache_size'],
                self.optionDict['vram_cache_size'],
                self.optionDict['cache_simplify'],
            ]
            presets = {
                'Low': [0, 1, 1, 5],
                'Medium': [1, 1, 1, 4],
                'High': [1, 2, 2, 2],
                'Ultra': [3, 3, 3, 1]
            }

            if s == 'Custom':
                for c in presetControls: self.optionSizer.Show(c)
            else:
                for c in presetControls: self.optionSizer.Hide(c)
            if s in presets:
                opt = presets[s]
                for i in range(4): presetControls[i].control.SetSelection(opt[i])

            self.frame.fSizer.Layout()
            self.frame.Fit()

        self.optionDict['preset'].Bind(wx.EVT_CHOICE, presetChoice)
        presetChoice()

        def onModelSelect(e=None):
            """Handle model selection change"""
            model_value = self.optionDict['model_select'].GetValue()
            is_student_model = 'tha4_student_' in model_value

            char_ctrl = self.optionDict['character']

            if is_student_model:
                char_ctrl.control.Enable(False)
                char_ctrl.control.SetToolTip(
                    'Locked: Student model includes built-in character')
            else:
                char_ctrl.control.Enable(True)
                char_ctrl.control.SetToolTip(
                    'Select a character from data/images')

        self.optionDict['model_select'].Bind(
            wx.EVT_CHOICE, onModelSelect)

        onModelSelect()

        def onActivate(e):
            global characterList
            char_ctrl = self.optionDict['character'].control
            tName = char_ctrl.GetStringSelection() if char_ctrl.GetSelection() >= 0 else ''
            refreshList()
            scanStudentModels()
            self.optionDict['character'].mapping = characterList
            char_ctrl.SetItems(characterList)
            try:
                idx = characterList.index(tName)
                char_ctrl.SetSelection(idx)
            except (ValueError, TypeError):
                if characterList:
                    char_ctrl.SetSelection(0)
            onModelSelect()

        if not hasTRTSupport:
            self.optionDict['use_tensorrt'].control.SetValue(False)
            self.optionDict['use_tensorrt'].control.Enable(False)
            self.optionDict['use_tensorrt'].control.SetToolTip(
                'NVIDIA GPU required for TensorRT acceleration')

        self.frame.Bind(wx.EVT_ACTIVATE, onActivate)

    def OnLaunch(self, e):
        global p
        args = {}
        for k in self.optionDict.keys():
            args[k] = self.optionDict[k].GetValue()
        f = open('launcher.json', mode='w')
        json.dump(args, f)
        f.close()
        self.btnLaunch.SetLabelText('Working...')

        if p is not None:
            self._stopping = True
            self._stop_running_process()
            p = None
            self.statusCtrl.Clear()
            self.btnLaunch.SetLabelText("Save & Launch")
        else:
            self._stopping = False
            errors, warnings = run_preflight(args)
            if warnings:
                print('\n'.join([f"[preflight warning] {w}" for w in warnings]))
            if errors and not args.get('allow_unsafe_launch'):
                wx.MessageBox(
                    "Launch blocked by preflight checks:\n\n- " + "\n- ".join(errors) +
                    "\n\nEnable 'Allow Unsafe Launch' only if you intentionally want to bypass these checks.",
                    "Preflight Failed",
                    wx.ICON_ERROR,
                )
                self.btnLaunch.SetLabelText("Save & Launch")
                return
            if errors and args.get('allow_unsafe_launch'):
                proceed = wx.MessageBox(
                    "Preflight found issues:\n\n- " + "\n- ".join(errors) +
                    "\n\nUnsafe launch is enabled. Continue anyway?",
                    "Preflight Warnings",
                    wx.YES_NO | wx.ICON_WARNING,
                )
                if proceed != wx.YES:
                    self.btnLaunch.SetLabelText("Save & Launch")
                    return

            python_exe = sys.executable
            if 'pythonw' in python_exe.lower():
                python_exe = python_exe.replace('pythonw.exe', 'python.exe').replace('pythonw', 'python')
            
            # Call the new root main.py
            project_root = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
            main_script = os.path.join(project_root, 'main.py')
            run_args = [python_exe, main_script]
            if len(args['character']):
                run_args.append('--character')
                run_args.append(args['character'])

            if args['input'] == 0:
                if len(args['ifm']):
                    run_args.append('--ifm_input')
                    if ':' in args['ifm']:
                        run_args.append(args['ifm'])
                    else:
                        run_args.append(args['ifm'] + ':49983')
            elif args['input'] == 1:
                run_args.append('--cam_input')
            elif args['input'] == 2:
                run_args.append('--debug_input')
            elif args['input'] == 3:
                run_args.append('--mouse_input')
                run_args.append('0,0,' + str(wx.GetDisplaySize().width) + ',' + str(wx.GetDisplaySize().height))
                if args['mouse_audio_input']:
                    run_args.append('--mouse_audio_input')
                    if args['audio_sensitivity']:
                        run_args.append('--audio_sensitivity')
                        run_args.append(str(args['audio_sensitivity']))
                    if args['audio_threshold']:
                        run_args.append('--audio_threshold')
                        run_args.append(str(args['audio_threshold']))
                if args['blink_interval']:
                    run_args.append('--blink_interval')
                    run_args.append(str(args['blink_interval']))
            elif args['input'] == 4:
                if len(args['osf']):
                    run_args.append('--osf_input')
                    run_args.append(args['osf'])
            elif args['input'] == 5:
                if len(args['vmc']):
                    run_args.append('--vmc_input')
                    run_args.append(args['vmc'])

            if args['breath_cycle']:
                run_args.append('--breath_cycle')
                run_args.append(str(args['breath_cycle']))

            if args['output'] == 0:
                run_args.append('--output_spout2')
            elif args['output'] == 1:
                run_args.append('--output_virtual_cam')
            elif args['output'] == 2:
                run_args.append('--output_debug')
            elif args['output'] == 3:
                run_args.append('--output_web')

            if args['is_alpha_split']:
                run_args.append('--alpha_split')
            if args['is_extend_movement']:
                run_args.append('--extend_movement')
            if args['is_bongo']:
                run_args.append('--bongo')
            if args['is_alpha_clean']:
                run_args.append('--alpha_clean')
            if args['is_eyebrow']:
                run_args.append('--eyebrow')

            if args['cache_simplify'] is not None:
                run_args.append('--simplify')
                run_args.append(str(cache_simplify_map[args['cache_simplify']]))
            if args['ram_cache_size'] is not None:
                run_args.append('--cache')
                run_args.append(args['ram_cache_size'])
                run_args.append('--gpu_cache')
                run_args.append(args['vram_cache_size'])

            if args['interpolation'] is not None:
                if not 'Off' == args['interpolation']:
                    run_args.append('--use_interpolation')
                if 'half' in args['interpolation']:
                    run_args.append('--interpolation_half')

                if 'x2' in args['interpolation']:
                    run_args.append('--interpolation_scale')
                    run_args.append('2')
                elif 'x3' in args['interpolation']:
                    run_args.append('--interpolation_scale')
                    run_args.append('3')
                elif 'x4' in args['interpolation']:
                    run_args.append('--interpolation_scale')
                    run_args.append('4')

            if args['model_select'] is not None:
                if 'tha4_student_' in args['model_select']:
                    model_name = args['model_select'].replace(
                        'tha4_student_', '')
                    run_args.append('--model_version')
                    run_args.append('v4_student')
                    run_args.append('--model_name')
                    run_args.append(model_name)
                elif 'tha4' in args['model_select']:
                    run_args.append('--model_version')
                    run_args.append('v4')
                else:
                    run_args.append('--model_version')
                    run_args.append('v3')
                if 'seperable' in args['model_select']:
                    run_args.append('--model_seperable')
                if 'half' in args['model_select']:
                    run_args.append('--model_half')

            if args['frame_rate_limit'] is not None:
                run_args.append('--frame_rate_limit')
                run_args.append(args['frame_rate_limit'])

            if args['sr'] is not None and args['sr'] != 'Off':
                run_args.append('--use_sr')
                if 'anime4k' in args['sr']:
                    run_args.append('--sr_a4k')
                if 'x4' in args['sr']:
                    run_args.append('--sr_x4')
                if 'half' in args['sr']:
                    run_args.append('--sr_half')

            if args['use_tensorrt'] is not None and args['use_tensorrt']:
                run_args.append('--use_tensorrt')

            run_args.append('--filter_min_cutoff')
            run_args.append(str(min_cutoff_mapper(args['min_cutoff'])))

            run_args.append('--filter_beta')
            run_args.append(str(beta_mapper(args['beta'])))

            print('Launched: ' + ' '.join(run_args))
            self.main_output_lines.clear()
            self.main_stderr_lines.clear()
            self.statusCtrl.SetValue('Launched')
            on_line = lambda line: _on_main_log_line(self, line)
            creation_flags = 0
            if sys.platform == 'win32':
                creation_flags = 0x08000000
            p = subprocess.Popen(
                run_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=creation_flags,
            )
            threading.Thread(
                target=_read_pipe_to_stream,
                args=(p.stdout, sys.stdout, self.main_output_lines, on_line),
                daemon=True,
            ).start()
            threading.Thread(
                target=_read_pipe_to_stream,
                args=(p.stderr, sys.stderr, self.main_stderr_lines, on_line),
                daemon=True,
            ).start()
            threading.Thread(target=self._watch_process_exit, daemon=True).start()
            self.btnLaunch.SetLabelText('Stop')

    def _stop_running_process(self):
        global p
        if p is None:
            return
        try:
            if sys.platform == 'win32':
                creation_flags = 0x08000000
                subprocess.run(['taskkill', '/F', '/PID', str(p.pid), '/T'],
                               stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL,
                               creationflags=creation_flags)
            else:
                p.terminate()
        except Exception:
            pass

    def _watch_process_exit(self):
        global p
        proc = p
        if proc is None:
            return
        code = proc.wait()
        stderr_tail = ''.join(self.main_stderr_lines[-25:])
        stdout_tail = ''.join(self.main_output_lines[-25:])

        def _finish_ui():
            global p
            if p is proc:
                p = None
            self.btnLaunch.SetLabelText("Save & Launch")
            if code != 0 and not self._stopping:
                details = stderr_tail.strip() or stdout_tail.strip() or "No details captured."
                wx.MessageBox(
                    f"EasyVtuber process exited with code {code}.\n\nRecent logs:\n{details}",
                    "Runtime Error",
                    wx.ICON_ERROR,
                )
            self._stopping = False

        wx.CallAfter(_finish_ui)


class MainFrame(wx.Frame):
    def __init__(self, *args, **kw):
        super(MainFrame, self).__init__(*args, **kw)
        self.InitUi()

        self.Bind(wx.EVT_CLOSE, self.OnClose)

    def OnClose(self, e):
        global p
        if p is not None:
            try:
                if sys.platform == 'win32':
                    creation_flags = 0x08000000
                    subprocess.run(['taskkill', '/F', '/PID', str(p.pid), '/T'],
                                  stdout=subprocess.DEVNULL,
                                  stderr=subprocess.DEVNULL,
                                  creationflags=creation_flags)
                else:
                    p.terminate()
            except Exception:
                pass
        e.Skip()

    def InitUi(self):
        self.SetTitle("EasyVtuber Launcher")
        self.fSizer = wx.BoxSizer(wx.VERTICAL)
        panel = LauncherPanel(self)
        self.fSizer.Add(panel, 1, wx.EXPAND)
        self.SetSizer(self.fSizer)
        self.SetMinSize(wx.Size(600, 0))
        self.Fit()
        self.Centre()


def main():
    app = wx.App()

    # Offline-only local check: warns if no model weights are installed yet,
    # but never blocks the launcher from opening (this app never downloads
    # anything itself — see backend/managers/model_downloader.py).
    try:
        if _DESKTOP_ROOT not in sys.path:
            sys.path.append(_DESKTOP_ROOT)
        from backend.managers.model_downloader import check_models_present
        check_models_present(None)
    except Exception as e:
        print(f"Failed to check models: {e}")

    sample = MainFrame(None)

    sample.Show()
    app.MainLoop()


if __name__ == "__main__":
    main()
