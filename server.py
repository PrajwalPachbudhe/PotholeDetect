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
MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")
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


@app.route("/api/stream_detect", methods=["POST"])
def stream_detect():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    
    # Read image from upload
    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if img is None:
        return jsonify({"error": "Invalid image file"}), 400

    # Run detection
    results = model.predict(source=img, conf=0.1, verbose=False)
    
    detections = []
    if results and len(results) > 0:
        result = results[0]
        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "class": result.names[cls_id],
                    "confidence": conf,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2
                })

    return jsonify({"detections": detections})



@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_PATH})

if __name__ == "__main__":
    print("🚀 Pothole Detection API starting on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
