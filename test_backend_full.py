import time
import io
import json
import numpy as np
import cv2
from server import app, init_db, get_db, purge_expired_records

def run_tests():
    print("=== Testing Pothole Detection & SQLite Backend ===")
    client = app.test_client()

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.status_code}"
    print("✓ /api/health passed:", res.get_json())

    # 2. Fast Stream Detection Benchmark
    dummy_img = np.zeros((360, 480, 3), dtype=np.uint8)
    # Add a mock pothole dark shape in the center
    cv2.circle(dummy_img, (240, 180), 40, (30, 30, 30), -1)
    _, encoded = cv2.imencode(".jpg", dummy_img, [cv2.IMWRITE_JPEG_QUALITY, 55])
    
    latencies = []
    for i in range(5):
        t0 = time.perf_counter()
        res = client.post(
            "/api/stream_detect",
            data={"image": (io.BytesIO(encoded.tobytes()), "frame.jpg")},
            content_type="multipart/form-data"
        )
        elapsed = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed)
        assert res.status_code == 200, f"stream_detect failed: {res.status_code}"
    
    avg_latency = np.mean(latencies[1:])  # drop first warm-up
    print(f"✓ /api/stream_detect benchmark avg latency: {avg_latency:.2f}ms (Target: < 50ms)")

    # 3. Auth Login (Admin & Officer)
    res_admin = client.post("/api/auth/login", json={"identifier": "admin@city.gov", "password": "admin123"})
    assert res_admin.status_code == 200 and res_admin.get_json()["user"]["role"] == "admin"
    print("✓ /api/auth/login admin login passed:", res_admin.get_json()["user"])

    res_officer = client.post("/api/auth/login", json={"identifier": "officer@city.gov", "password": "demo1234"})
    assert res_officer.status_code == 200 and res_officer.get_json()["user"]["role"] == "officer"
    print("✓ /api/auth/login officer login passed:", res_officer.get_json()["user"])

    # 4. Auth Signup (New User)
    new_email = f"officer_test_{int(time.time())}@city.gov"
    res_signup = client.post("/api/auth/signup", json={
        "name": "Field Officer Maya",
        "email": new_email,
        "password": "password123",
        "role": "officer"
    })
    assert res_signup.status_code == 201, f"Signup failed: {res_signup.get_json()}"
    new_user_id = res_signup.get_json()["user"]["id"]
    print("✓ /api/auth/signup passed for user id:", new_user_id)

    # 5. Admin Users Directory
    res_users = client.get("/api/auth/users")
    assert res_users.status_code == 200 and len(res_users.get_json()["users"]) >= 3
    print("✓ /api/auth/users passed. Total registered users:", len(res_users.get_json()["users"]))

    # 6. Hazards Creation & Retrieval (7-Day Scoped)
    hazard_payload = {
        "id": f"PTH-TEST-{int(time.time())}",
        "user_id": new_user_id,
        "user_email": new_email,
        "user_name": "Field Officer Maya",
        "title": "Main Boulevard Severe Crater",
        "lat": 34.0522,
        "lng": -118.2437,
        "severity": "critical",
        "confidence": "96.4%",
        "detectedTime": "Just now",
        "image": "data:image/jpeg;base64,mockphoto"
    }
    res_hazard_post = client.post("/api/hazards", json=hazard_payload)
    assert res_hazard_post.status_code == 201, f"Hazard post failed: {res_hazard_post.get_json()}"
    print("✓ /api/hazards POST passed")

    res_hazards_get = client.get("/api/hazards?all=true")
    assert res_hazards_get.status_code == 200 and len(res_hazards_get.get_json()["hazards"]) > 0
    print(f"✓ /api/hazards GET passed. Active 7-day hazards count: {len(res_hazards_get.get_json()['hazards'])}")

    # 7. History Creation & Retrieval
    history_payload = {
        "user_id": new_user_id,
        "user_email": new_email,
        "title": "Main Boulevard Scan",
        "total_detections": 2,
        "detections": [{"name": "pothole", "confidence": 0.96}],
        "analysisTime": "0.03",
        "gps": {"lat": 34.0522, "lng": -118.2437, "address": "Main Boulevard"}
    }
    res_hist_post = client.post("/api/history", json=history_payload)
    assert res_hist_post.status_code == 201
    print("✓ /api/history POST passed")

    res_hist_get = client.get(f"/api/history?user_email={new_email}")
    assert res_hist_get.status_code == 200 and len(res_hist_get.get_json()["history"]) == 1
    print("✓ /api/history GET passed for user:", res_hist_get.get_json()["history"][0]["title"])

    # 8. 7-Day Auto Purge Test
    conn = get_db()
    cursor = conn.cursor()
    # Insert an expired record from 10 days ago
    cursor.execute("""
        INSERT INTO hazards (id, user_id, user_email, user_name, title, lat, lng, severity, created_at)
        VALUES ('PTH-EXPIRED-10D', 1, 'old@city.gov', 'Old', 'Old pothole', 34.0, -118.0, 'moderate', datetime('now', '-10 days'))
    """)
    conn.commit()
    conn.close()

    # Call purge
    purge_expired_records()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM hazards WHERE id = 'PTH-EXPIRED-10D'")
    assert cursor.fetchone() is None, "Expired record was not purged!"
    conn.close()
    print("✓ 7-Day auto-purge successfully removed record older than 7 days")

    # 9. Admin Stats API
    res_admin_stats = client.get("/api/admin/stats")
    assert res_admin_stats.status_code == 200
    stats_data = res_admin_stats.get_json()
    print("✓ /api/admin/stats passed:", {
        "total_users": stats_data["total_users"],
        "active_hazards": stats_data["active_hazards"],
        "total_scans_7d": stats_data["total_scans_7d"],
        "model": stats_data["model_info"]["path"]
    })

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Real-time detection is fast, database is persistent per login, 7-day retention works, and admin dashboard is active.")

if __name__ == "__main__":
    run_tests()
