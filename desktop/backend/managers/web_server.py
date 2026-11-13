import cv2
import threading
import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()
current_frame = None
frame_condition = threading.Condition()

# How long a single client wait blocks before looping. Without a timeout,
# `frame_condition.wait()` blocked forever when the inference process died, so
# every connected browser tab hung on an open connection with no feedback.
FRAME_WAIT_TIMEOUT_S = 1.0


def send_frame(frame):
    global current_frame
    # Frames arrive in the layout chosen by backend/utils/output_layout.py:
    # 3-channel is already BGR (post_process_ret's debug/web branch, which is
    # what OpenCV encodes natively), 4-channel is BGRA.
    if frame is None:
        return
    if frame.ndim != 3 or frame.shape[2] not in (3, 4):
        raise ValueError(f'expected a 3- or 4-channel image, got shape {frame.shape}')
    bgr = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR) if frame.shape[2] == 4 else frame
    ok, buffer = cv2.imencode('.jpg', bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not ok:
        return
    with frame_condition:
        current_frame = buffer.tobytes()
        frame_condition.notify_all()


def generate_frames():
    while True:
        with frame_condition:
            frame_condition.wait(timeout=FRAME_WAIT_TIMEOUT_S)
            frame = current_frame
        if frame is not None:
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')


@app.get('/')
def video_feed():
    return StreamingResponse(
        generate_frames(), media_type='multipart/x-mixed-replace; boundary=frame'
    )


@app.get('/health')
def health():
    """Cheap liveness probe for the launcher/smoke tests (no stream read)."""
    return {'ok': True, 'frame': current_frame is not None}


def start_server(port=8000, host='127.0.0.1'):
    def run():
        # Loopback-only by default: this stream has no authentication, so
        # binding 0.0.0.0 would expose the user's live camera-driven output
        # to anyone else on the local network. Pass host="0.0.0.0" explicitly
        # to opt into LAN sharing.
        uvicorn.run(app, host=host, port=port, log_level='warning')

    t = threading.Thread(target=run, daemon=True)
    t.start()
    return t
