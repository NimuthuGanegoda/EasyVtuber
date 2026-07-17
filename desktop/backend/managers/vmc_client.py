import math
import threading
import time
from multiprocessing import Process, Value, shared_memory

import numpy as np
from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import BlockingOSCUDPServer

from .args import args
from ..utils.shared_mem_guard import SharedMemoryGuard
from ..utils.fps import FPS
from ..utils.filter import OneEuroFilterNumpy
from ..utils.timer_wait import wait_until

# VMC (Virtual Motion Capture) protocol: OSC over UDP. Spec: https://protocol.vmc.info
# We only consume the subset relevant to a face-tracking VTuber avatar: the
# "Head" bone's rotation (for head pose) and blend shape values (for
# expressions/mouth/eyes). Body/finger bones, HMD/controller/tracker
# transforms, and model calibration messages are ignored.
_BONE_ADDR = "/VMC/Ext/Bone/Pos"
_BLEND_VAL_ADDR = "/VMC/Ext/Blend/Val"
_BLEND_APPLY_ADDR = "/VMC/Ext/Blend/Apply"

# Blend shape name aliases -> our slot, matched case-insensitively. Senders
# vary widely (VRM0 Japanese-style names, VRM1 standard names, ARKit names),
# so each slot accepts several common spellings. First match wins.
_BLINK_L_NAMES = {"blink_l", "blinkleft", "eyeblinkleft"}
_BLINK_R_NAMES = {"blink_r", "blinkright", "eyeblinkright"}
_BLINK_BOTH_NAMES = {"blink"}
_MOUTH_A_NAMES = {"a", "aa", "mouthopen", "jawopen"}
_MOUTH_I_NAMES = {"i", "ih"}
_MOUTH_U_NAMES = {"u", "ou"}
_MOUTH_E_NAMES = {"e", "ee"}
_MOUTH_O_NAMES = {"o", "oh"}
_LOOK_LEFT_NAMES = {"lookleft", "eyelookoutleft", "eyelookinright"}
_LOOK_RIGHT_NAMES = {"lookright", "eyelookoutright", "eyelookinleft"}
_LOOK_UP_NAMES = {"lookup", "eyelookupleft", "eyelookupright"}
_LOOK_DOWN_NAMES = {"lookdown", "eyelookdownleft", "eyelookdownright"}


def _quat_to_euler(x: float, y: float, z: float, w: float):
    """Quaternion -> (pitch, yaw, roll) in radians, matching Unity/VMC's axis
    convention: X=pitch (look up/down), Y=yaw (turn left/right), Z=roll (tilt
    sideways). Verified against a pure-Y-axis test rotation. Still
    approximate for compound rotations (Unity is left-handed Y-up, so exact
    handedness isn't guaranteed) — good enough for head-tracking response,
    not a precise biomechanical mapping."""
    # pitch: rotation about X
    sinr_cosp = 2 * (w * x + y * z)
    cosr_cosp = 1 - 2 * (x * x + y * y)
    pitch = math.atan2(sinr_cosp, cosr_cosp)

    # yaw: rotation about Y
    sinp = 2 * (w * y - z * x)
    yaw = math.copysign(math.pi / 2, sinp) if abs(sinp) >= 1 else math.asin(sinp)

    # roll: rotation about Z
    siny_cosp = 2 * (w * z + x * y)
    cosy_cosp = 1 - 2 * (y * y + z * z)
    roll = math.atan2(siny_cosp, cosy_cosp)
    return pitch, yaw, roll


class VMCClientProcess(Process):
    def __init__(self, pose_position_shm: shared_memory.SharedMemory):
        super().__init__()
        self.pose_position_shm = pose_position_shm
        host_port = args.vmc_input.split(':')
        self.host = host_port[0] or "127.0.0.1"
        self.port = int(host_port[1]) if len(host_port) > 1 else 39539
        self.fps = Value('f', 0.0)

    def run(self):
        pose_position_shm_guard = SharedMemoryGuard(self.pose_position_shm, ctrl_name="pose_position_shm_ctrl")
        np_pose_shm = np.ndarray((45,), dtype=np.float32, buffer=self.pose_position_shm.buf[:45 * 4])
        np_position_shm = np.ndarray((4,), dtype=np.float32, buffer=self.pose_position_shm.buf[45 * 4:45 * 4 + 4 * 4])

        state_lock = threading.Lock()
        # Latest received head rotation (radians) and blend shape values (0..1).
        state = {
            'pitch': 0.0, 'yaw': 0.0, 'roll': 0.0,
            'blink_l': 0.0, 'blink_r': 0.0,
            'mouth_a': 0.0, 'mouth_i': 0.0, 'mouth_u': 0.0, 'mouth_e': 0.0, 'mouth_o': 0.0,
            'look_x': 0.0, 'look_y': 0.0,
        }

        def on_bone(address, *osc_args):
            if len(osc_args) < 8 or osc_args[0] != "Head":
                return
            _name, _px, _py, _pz, rx, ry, rz, rw = osc_args[:8]
            pitch, yaw, roll = _quat_to_euler(rx, ry, rz, rw)
            with state_lock:
                state['pitch'] = pitch
                state['yaw'] = yaw
                state['roll'] = roll

        def on_blend_val(address, *osc_args):
            if len(osc_args) < 2:
                return
            name, value = str(osc_args[0]).lower(), float(osc_args[1])
            with state_lock:
                if name in _BLINK_L_NAMES:
                    state['blink_l'] = value
                elif name in _BLINK_R_NAMES:
                    state['blink_r'] = value
                elif name in _BLINK_BOTH_NAMES:
                    state['blink_l'] = value
                    state['blink_r'] = value
                elif name in _MOUTH_A_NAMES:
                    state['mouth_a'] = value
                elif name in _MOUTH_I_NAMES:
                    state['mouth_i'] = value
                elif name in _MOUTH_U_NAMES:
                    state['mouth_u'] = value
                elif name in _MOUTH_E_NAMES:
                    state['mouth_e'] = value
                elif name in _MOUTH_O_NAMES:
                    state['mouth_o'] = value
                elif name in _LOOK_LEFT_NAMES:
                    state['look_x'] = -value
                elif name in _LOOK_RIGHT_NAMES:
                    state['look_x'] = value
                elif name in _LOOK_UP_NAMES:
                    state['look_y'] = value
                elif name in _LOOK_DOWN_NAMES:
                    state['look_y'] = -value

        def on_blend_apply(address, *osc_args):
            pass  # We read `state` on our own write cadence; no action needed.

        dispatcher = Dispatcher()
        dispatcher.map(_BONE_ADDR, on_bone)
        dispatcher.map(_BLEND_VAL_ADDR, on_blend_val)
        dispatcher.map(_BLEND_APPLY_ADDR, on_blend_apply)
        dispatcher.set_default_handler(lambda address, *a: None)

        server = BlockingOSCUDPServer((self.host, self.port), dispatcher)
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        print(f"VMC Input listening on {self.host}:{self.port} (waiting for a VMC-compatible sender)")

        input_fps = FPS(60)
        pose_filter = OneEuroFilterNumpy(freq=60.0, mincutoff=args.filter_min_cutoff, beta=args.filter_beta)

        last_time: float = time.perf_counter()
        interval: float = 1.0 / 60  # write to shared memory at a fixed 60Hz regardless of sender rate
        breath_start_time = time.perf_counter()
        position_vector = np.array([0, 0, 0, 1], dtype=np.float32)

        try:
            while True:
                with state_lock:
                    s = dict(state)

                breath_elapsed = (time.perf_counter() - breath_start_time) % args.breath_cycle
                breath_value = np.sin(breath_elapsed / args.breath_cycle * np.pi)

                eyebrow_vector = [0.0] * 12
                mouth_eye_vector = [0.0] * 27
                pose_vector = [0.0] * 6

                mouth_eye_vector[2] = s['blink_l']
                mouth_eye_vector[3] = s['blink_r']

                mouth_eye_vector[14] = max(s['mouth_a'], s['mouth_e'], s['mouth_o']) * 1.5
                mouth_eye_vector[15] = s['mouth_i']
                mouth_eye_vector[16] = s['mouth_u']
                mouth_eye_vector[17] = s['mouth_e']
                mouth_eye_vector[18] = s['mouth_o']

                mouth_eye_vector[25] = s['look_y']
                mouth_eye_vector[26] = s['look_x']

                pose_vector[0] = s['pitch']
                pose_vector[1] = s['yaw']
                pose_vector[2] = s['roll']
                pose_vector[3] = pose_vector[1]
                pose_vector[4] = pose_vector[2]
                pose_vector[5] = breath_value

                model_input_arr = eyebrow_vector
                model_input_arr.extend(mouth_eye_vector)
                model_input_arr.extend(pose_vector)

                self.fps.value = input_fps()

                with pose_position_shm_guard.lock():
                    np_pose_shm[:] = pose_filter(np.array(model_input_arr, dtype=np.float32))
                    np_position_shm[:] = position_vector

                wait_until(last_time + interval)
                last_time += interval
        finally:
            server.shutdown()
