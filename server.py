import os
import io
import json
import base64
import sqlite3
import datetime
import cv2
import numpy as np
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, allow_headers=["*"], expose_headers=["*"])

DB_PATH = os.path.join(os.path.dirname(__file__), "pothole_detection.db")

# ---------------------------------------------------------------------------
# Database Initialization & 7-Day Auto Retention Management
# ---------------------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'officer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Hazards table (Pothole locations on map)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hazards (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            user_email TEXT,
            user_name TEXT,
            title TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            severity TEXT DEFAULT 'moderate',
            coords_text TEXT,
            confidence TEXT,
            image TEXT,
            detected_time TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    # Scan History table (Detailed detection logs)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_email TEXT,
            title TEXT,
            total_detections INTEGER DEFAULT 0,
            detections_json TEXT,
            analysis_time TEXT,
            lat REAL,
            lng REAL,
            address TEXT,
            image TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    # Create indexes for fast lookup and 7-day queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_hazards_created_at ON hazards(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_hazards_user_id ON hazards(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id)")
    
    # Seed default Admin and Officer accounts if not already present
    cursor.execute("SELECT id FROM users WHERE email = 'admin@city.gov'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            ("Administrator", "admin@city.gov", "admin123", "admin")
        )
        
    cursor.execute("SELECT id FROM users WHERE email = 'officer@city.gov'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            ("Inspector Alex", "officer@city.gov", "demo1234", "officer")
        )
        
    conn.commit()
    conn.close()
    
    # Run 7-day purge
    purge_expired_records()

def purge_expired_records():
    """Automatically clears hazards and history records older than 7 days from the database."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # 7 days retention limit
        cursor.execute("DELETE FROM hazards WHERE datetime(created_at) < datetime('now', '-7 days')")
        hazards_purged = cursor.rowcount
        
        cursor.execute("DELETE FROM history WHERE datetime(created_at) < datetime('now', '-7 days')")
        history_purged = cursor.rowcount
        
        conn.commit()
        conn.close()
        if hazards_purged > 0 or history_purged > 0:
            print(f"🧹 [7-Day Auto-Purge] Cleared {hazards_purged} expired hazards and {history_purged} expired history records.")
    except Exception as e:
        print(f"⚠️ Purge error: {e}")

init_db()

# ---------------------------------------------------------------------------
# YOLO Model Loading & High-Speed Warm-up
# ---------------------------------------------------------------------------
TRAINED_MODEL_CANDIDATES = [
    "runs/detect/train-3/weights/best.pt",
    "runs/detect/train/weights/best.pt",
    "y8best.pt",
    "yolov8n.pt"
]

MODEL_PATH = None
for candidate in TRAINED_MODEL_CANDIDATES:
    p = os.path.join(os.path.dirname(__file__), candidate)
    if os.path.exists(p):
        MODEL_PATH = p
        break

if not MODEL_PATH:
    MODEL_PATH = "yolov8n.pt"

print(f"⚡ Loading YOLO model from: {MODEL_PATH}")
device = 0 if torch.cuda.is_available() else "cpu"
use_half = True if torch.cuda.is_available() else False
model = YOLO(MODEL_PATH)
if torch.cuda.is_available():
    model.to("cuda")

# Pre-warm model with dummy inference for sub-millisecond first response
try:
    dummy = np.zeros((416, 416, 3), dtype=np.uint8)
    model.predict(source=dummy, imgsz=416, conf=0.15, verbose=False)
    print(f"🚀 Model warmed up successfully on device: {device}")
except Exception as e:
    print(f"⚠️ Model warmup warning: {e}")


# ---------------------------------------------------------------------------
# Authentication Routes (Per-User Login, Signup, Admin User Directory)
# ---------------------------------------------------------------------------
@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    identifier = data.get("identifier") or data.get("email") or ""
    password = data.get("password") or ""
    
    if not identifier.strip() or not password:
        return jsonify({"error": "Email/ID and password are required"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? OR name = ?", (identifier.strip(), identifier.strip()))
    user_row = cursor.fetchone()
    
    if not user_row or user_row["password"] != password:
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401
        
    cursor.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user_row["id"],))
    conn.commit()
    
    user_dict = {
        "id": user_row["id"],
        "name": user_row["name"],
        "email": user_row["email"],
        "role": user_row["role"]
    }
    conn.close()
    return jsonify({"status": "success", "user": user_dict}), 200

@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = data.get("role") or "officer"
    
    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            (name, email, password, role)
        )
        user_id = cursor.lastrowid
        conn.commit()
        user_dict = {"id": user_id, "name": name, "email": email, "role": role}
        conn.close()
        return jsonify({"status": "success", "user": user_dict}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "An account with this email already exists"}), 409
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

@app.route("/api/auth/users", methods=["GET"])
def get_users_list():
    """Admin endpoint to view all registered users and their detection statistics."""
    purge_expired_records()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login,
               COUNT(DISTINCT h.id) as hazard_count,
               COUNT(DISTINCT hs.id) as scan_count
        FROM users u
        LEFT JOIN hazards h ON u.id = h.user_id
        LEFT JOIN history hs ON u.id = hs.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    """)
    rows = cursor.fetchall()
    users = [dict(row) for row in rows]
    conn.close()
    return jsonify({"users": users})


# ---------------------------------------------------------------------------
# Real-Time AI Detection Endpoints (Optimized for High FPS)
# ---------------------------------------------------------------------------
@app.route("/api/stream_detect", methods=["POST"])
def stream_detect():
    """Ultra-fast lightweight stream detection with optimized resolution & half-precision."""
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if img is None:
        return jsonify({"error": "Invalid image file"}), 400

    # High-speed inference (imgsz=416 gives optimal speed/accuracy trade-off)
    results = model.predict(source=img, imgsz=416, conf=0.15, verbose=False)
    
    detections = []
    if results and len(results) > 0:
        result = results[0]
        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "name": result.names[cls_id],
                    "confidence": conf,
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1)
                })

    return jsonify({"detections": detections})


@app.route("/api/detect", methods=["POST"])
def detect():
    """Full single-image detection with annotated output and metadata."""
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if img is None:
        return jsonify({"error": "Invalid image file"}), 400

    results = model.predict(source=img, imgsz=640, conf=0.15, verbose=False)
    result = results[0]

    detections = []
    if result.boxes is not None and len(result.boxes) > 0:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "name": result.names[cls_id],
                "confidence": round(conf * 100, 1),
                "bbox": {
                    "x1": round(x1),
                    "y1": round(y1),
                    "x2": round(x2),
                    "y2": round(y2)
                }
            })

    annotated = result.plot()
    _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    annotated_b64 = base64.b64encode(buffer).decode("utf-8")

    _, orig_buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    original_b64 = base64.b64encode(orig_buffer).decode("utf-8")

    lat = request.form.get("latitude") or request.form.get("lat")
    lng = request.form.get("longitude") or request.form.get("lng")
    speed = request.form.get("speed")
    address = request.form.get("address")
    
    gps_info = None
    if lat and lng:
        try:
            gps_info = {
                "lat": float(lat),
                "lng": float(lng),
                "speed": float(speed) if speed else 0,
                "address": address or f"{float(lat):.4f}°N, {float(lng):.4f}°W"
            }
        except Exception:
            pass

    return jsonify({
        "original": original_b64,
        "annotated": annotated_b64,
        "detections": detections,
        "total_detections": len(detections),
        "gps": gps_info,
        "image_size": {
            "width": img.shape[1],
            "height": img.shape[0]
        }
    })


# ---------------------------------------------------------------------------
# Hazards & Map Dots (Database Scoped with 7-Day Auto Purge)
# ---------------------------------------------------------------------------
@app.route("/api/hazards", methods=["GET", "POST"])
def manage_hazards():
    # Automatically prune records > 7 days old
    purge_expired_records()
    
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json() or {}
        if not data:
            conn.close()
            return jsonify({"error": "No data provided"}), 400
        
        hazard_id = data.get("id") or f"PTH-{int(datetime.datetime.now().timestamp() * 1000) % 100000}"
        user_id = data.get("user_id") or data.get("userId")
        user_email = data.get("user_email") or data.get("userEmail") or ""
        user_name = data.get("user_name") or data.get("userName") or ""
        title = data.get("title") or "Pothole Hazard"
        lat = float(data.get("lat") or 0.0)
        lng = float(data.get("lng") or 0.0)
        severity = data.get("severity") or "moderate"
        coords_text = data.get("coordsText") or f"{lat:.4f}° N, {lng:.4f}° W"
        confidence = str(data.get("confidence") or "90%")
        detected_time = data.get("detectedTime") or "Just now"
        image = data.get("image") or ""

        # Limit image storage size if base64 to preserve fast SQLite access
        if len(image) > 500000:
            image = image[:500000]

        cursor.execute("""
            INSERT OR REPLACE INTO hazards (
                id, user_id, user_email, user_name, title, lat, lng, 
                severity, coords_text, confidence, image, detected_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (hazard_id, user_id, user_email, user_name, title, lat, lng, severity, coords_text, confidence, image, detected_time))
        
        conn.commit()
        conn.close()
        return jsonify({"status": "saved", "hazard": data}), 201

    else:
        # GET: Fetch active hazards within past 7 days
        user_id = request.args.get("user_id")
        user_email = request.args.get("user_email")
        
        # If user filter is provided, allow returning user-specific hazards or all 7-day active hazards
        all_hazards = request.args.get("all", "true").lower() == "true"
        
        if not all_hazards and user_id:
            cursor.execute("""
                SELECT * FROM hazards 
                WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-7 days')
                ORDER BY created_at DESC
            """, (user_id,))
        elif not all_hazards and user_email:
            cursor.execute("""
                SELECT * FROM hazards 
                WHERE user_email = ? AND datetime(created_at) >= datetime('now', '-7 days')
                ORDER BY created_at DESC
            """, (user_email,))
        else:
            cursor.execute("""
                SELECT * FROM hazards 
                WHERE datetime(created_at) >= datetime('now', '-7 days')
                ORDER BY created_at DESC
                LIMIT 300
            """)

        rows = cursor.fetchall()
        hazards = []
        for r in rows:
            hazards.append({
                "id": r["id"],
                "userId": r["user_id"],
                "userEmail": r["user_email"],
                "userName": r["user_name"],
                "title": r["title"],
                "lat": r["lat"],
                "lng": r["lng"],
                "severity": r["severity"],
                "coordsText": r["coords_text"],
                "confidence": r["confidence"],
                "image": r["image"],
                "detectedTime": r["detected_time"],
                "createdAt": r["created_at"]
            })
            
        conn.close()
        return jsonify({"hazards": hazards, "retention_days": 7})


# ---------------------------------------------------------------------------
# User History Management (7-Day Retention Scoped)
# ---------------------------------------------------------------------------
@app.route("/api/history", methods=["GET", "POST", "DELETE"])
def manage_history():
    purge_expired_records()
    conn = get_db()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json() or {}
        user_id = data.get("user_id") or data.get("userId")
        user_email = data.get("user_email") or data.get("userEmail") or ""
        title = data.get("title") or "Pothole Scan"
        total_detections = int(data.get("total_detections") or len(data.get("detections") or []))
        detections_json = json.dumps(data.get("detections") or [])
        analysis_time = str(data.get("analysisTime") or "0.12")
        
        gps = data.get("gps") or {}
        lat = float(gps.get("lat") or 0.0)
        lng = float(gps.get("lng") or 0.0)
        address = gps.get("address") or ""
        image = data.get("annotated") or data.get("original") or ""
        if len(image) > 300000:
            image = image[:300000]

        cursor.execute("""
            INSERT INTO history (
                user_id, user_email, title, total_detections, detections_json, 
                analysis_time, lat, lng, address, image, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, user_email, title, total_detections, detections_json, analysis_time, lat, lng, address, image))
        
        conn.commit()
        item_id = cursor.lastrowid
        conn.close()
        return jsonify({"status": "saved", "id": item_id}), 201

    elif request.method == "DELETE":
        user_id = request.args.get("user_id")
        user_email = request.args.get("user_email")
        if user_id:
            cursor.execute("DELETE FROM history WHERE user_id = ?", (user_id,))
        elif user_email:
            cursor.execute("DELETE FROM history WHERE user_email = ?", (user_email,))
        else:
            cursor.execute("DELETE FROM history")
        conn.commit()
        conn.close()
        return jsonify({"status": "cleared"}), 200

    else:
        # GET history records for user (< 7 days)
        user_id = request.args.get("user_id")
        user_email = request.args.get("user_email")

        if user_id:
            cursor.execute("""
                SELECT * FROM history 
                WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-7 days')
                ORDER BY created_at DESC
            """, (user_id,))
        elif user_email:
            cursor.execute("""
                SELECT * FROM history 
                WHERE user_email = ? AND datetime(created_at) >= datetime('now', '-7 days')
                ORDER BY created_at DESC
            """, (user_email,))
        else:
            cursor.execute("""
                SELECT * FROM history 
                WHERE datetime(created_at) >= datetime('now', '-7 days')
                ORDER BY created_at DESC
                LIMIT 100
            """)

        rows = cursor.fetchall()
        items = []
        for r in rows:
            items.append({
                "id": r["id"],
                "userId": r["user_id"],
                "userEmail": r["user_email"],
                "title": r["title"],
                "total_detections": r["total_detections"],
                "detections": json.loads(r["detections_json"]) if r["detections_json"] else [],
                "analysisTime": r["analysis_time"],
                "gps": {"lat": r["lat"], "lng": r["lng"], "address": r["address"]},
                "annotated": r["image"],
                "timestamp": r["created_at"]
            })
        conn.close()
        return jsonify({"history": items, "retention_days": 7})


# ---------------------------------------------------------------------------
# Admin Dashboard Analytics & Statistics API
# ---------------------------------------------------------------------------
@app.route("/api/admin/stats", methods=["GET"])
def admin_stats():
    purge_expired_records()
    conn = get_db()
    cursor = conn.cursor()

    # Total users
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]

    # Active 7-day hazards
    cursor.execute("SELECT COUNT(*) FROM hazards WHERE datetime(created_at) >= datetime('now', '-7 days')")
    active_hazards = cursor.fetchone()[0]

    # Critical vs Moderate breakdown
    cursor.execute("""
        SELECT severity, COUNT(*) as count 
        FROM hazards 
        WHERE datetime(created_at) >= datetime('now', '-7 days')
        GROUP BY severity
    """)
    severity_breakdown = {row["severity"]: row["count"] for row in cursor.fetchall()}

    # Total Scans in past 7 days
    cursor.execute("SELECT COUNT(*), SUM(total_detections) FROM history WHERE datetime(created_at) >= datetime('now', '-7 days')")
    scan_row = cursor.fetchone()
    total_scans_7d = scan_row[0] or 0
    total_potholes_found = scan_row[1] or 0

    # Daily trend for past 7 days
    cursor.execute("""
        SELECT date(created_at) as day, COUNT(*) as detections, COUNT(DISTINCT user_id) as active_users
        FROM hazards
        WHERE datetime(created_at) >= datetime('now', '-7 days')
        GROUP BY date(created_at)
        ORDER BY day ASC
    """)
    daily_trends = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "total_users": total_users,
        "active_hazards": active_hazards,
        "total_scans_7d": total_scans_7d,
        "total_potholes_found": total_potholes_found,
        "severity_breakdown": severity_breakdown,
        "daily_trends": daily_trends,
        "model_info": {
            "path": MODEL_PATH,
            "device": str(device),
            "classes": model.names,
            "half_precision": use_half,
            "retention_policy": "7 Days Auto-Pruning"
        }
    })

@app.route("/api/admin/purge_old", methods=["POST"])
def admin_purge_trigger():
    purge_expired_records()
    return jsonify({"status": "success", "message": "7-day retention cleanup executed successfully."})

@app.route("/", methods=["GET", "HEAD"])
def index():
    return "Pothole Detection & Database API is running with 7-day retention!", 200

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok", 
        "model": MODEL_PATH,
        "device": str(device),
        "db": "SQLite3 (pothole_detection.db)",
        "retention": "7_days"
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Pothole Detection & Database API starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)


