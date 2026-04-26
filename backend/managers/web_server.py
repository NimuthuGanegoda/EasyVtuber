import cv2
import threading
import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()
current_frame = None
frame_condition = threading.Condition()

def send_frame(frame):
    global current_frame
    with frame_condition:
        # frame is typically RGB if 3 channels (virtual_cam) or BGR for debug
        # OpenCV uses BGR natively. The model output is RGB?
        # In main.py, cv2.imshow displays it directly, so it might be RGB or BGR.
        # Let's assume RGB and convert to BGR for imencode, or just BGR to BGR.
        # Actually cv2.imshow expects BGR, but pyvirtualcam expects RGB.
        # The model output is RGB. If cv2.imshow looks blueish, it's RGB.
        # For simplicity, convert RGB to BGR before encoding to JPEG if it looks weird.
        # We will assume it's RGB and convert it to BGR so JPEG encoding is correct
        bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        ret, buffer = cv2.imencode('.jpg', bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ret:
            current_frame = buffer.tobytes()
            frame_condition.notify_all()

def generate_frames():
    while True:
        with frame_condition:
            frame_condition.wait()
            frame = current_frame
        if frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.get("/")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

def start_server(port=8000):
    def run():
        uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
    t = threading.Thread(target=run, daemon=True)
    t.start()
    return t
