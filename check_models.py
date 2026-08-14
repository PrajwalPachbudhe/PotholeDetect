from ultralytics import YOLO
import os

# Check both models
for model_name in ["y8best.pt", "best.pt"]:
    path = os.path.join(os.path.dirname(__file__), model_name)
    if os.path.exists(path):
        print(f"\n{'='*50}")
        print(f"Model: {model_name}")
        print(f"Size: {os.path.getsize(path) / 1024 / 1024:.1f} MB")
        model = YOLO(path)
        print(f"Class names: {model.names}")
        print(f"Number of classes: {len(model.names)}")
        print(f"Task: {model.task}")
    else:
        print(f"{model_name} not found")
