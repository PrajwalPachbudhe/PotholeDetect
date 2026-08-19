from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import io
import os

app = Flask(__name__)
CORS(app)

# Load model once on startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), "y8best.pt")
model = YOLO(MODEL_PATH)

@app.route("/api/detect", methods=["POST"])
def detect():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    
    # Read image from upload
    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if img is None:
        return jsonify({"error": "Invalid image file"}), 400

    # Run detection — all road hazard classes
    results = model.predict(source=img, conf=0.1)
    result = results[0]

    # Build detections list
    detections = []
    if result.boxes is not None and len(result.boxes) > 0:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "class": result.names[cls_id],
                "confidence": round(conf * 100, 1),
                "bbox": {
                    "x1": round(x1),
                    "y1": round(y1),
                    "x2": round(x2),
                    "y2": round(y2)
                }
            })

    # Draw annotated image
    annotated = result.plot()

    # Encode annotated image to base64
    _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 90])
    annotated_b64 = base64.b64encode(buffer).decode("utf-8")

    # Encode original image to base64
    _, orig_buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    original_b64 = base64.b64encode(orig_buffer).decode("utf-8")

    return jsonify({
        "original": original_b64,
        "annotated": annotated_b64,
        "detections": detections,
        "total_detections": len(detections),
        "image_size": {
            "width": img.shape[1],
            "height": img.shape[0]
        }
    })


from flask import Response

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_PATH})

import threading
import time

class VideoCamera:
    def __init__(self, model):
        self.cap = cv2.VideoCapture(0)
        self.model = model
        self.latest_frame = None
        self.latest_boxes = None
        self.running = True
        
        self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.capture_thread.start()
        
        self.inference_thread = threading.Thread(target=self._inference_loop, daemon=True)
        self.inference_thread.start()

    def _capture_loop(self):
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                self.latest_frame = frame
            time.sleep(0.01)

    def _inference_loop(self):
        while self.running:
            if self.latest_frame is not None:
                frame_to_infer = self.latest_frame.copy()
                # Run the model on the CPU (takes ~1.5s per frame)
                results = self.model.predict(source=frame_to_infer, conf=0.1, verbose=False)
                if results and len(results) > 0:
                    self.latest_boxes = results[0]
            time.sleep(0.01)

    def get_frame(self):
        if self.latest_frame is None:
            return None
            
        frame = self.latest_frame.copy()
        
        # Overlay the latest known bounding boxes on the LIVE frame
        if self.latest_boxes and self.latest_boxes.boxes is not None:
            for box in self.latest_boxes.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = self.latest_boxes.names[cls]
                
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 3)
                cv2.putText(frame, f"{name} {conf:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return buffer.tobytes() if ret else None

# Global camera instance
camera_instance = None

@app.route("/video_feed")
def video_feed():
    global camera_instance
    if camera_instance is None:
        camera_instance = VideoCamera(model)

    def generate():
        while True:
            frame_bytes = camera_instance.get_frame()
            if frame_bytes:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.03) # Cap stream at ~30 FPS

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')



if __name__ == "__main__":
    print("🚀 Pothole Detection API starting on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
