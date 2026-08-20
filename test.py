from ultralytics import YOLO
import cv2

# Use the newly trained model
model = YOLO("runs/detect/train-3/weights/best.pt")

# Test it on the video (set show=True to see it live, save=True to save the output)
results = model.predict(source="tested.mp4", show=True, save=True)
print("Testing complete. Output saved in runs/detect/predict/")