from ultralytics import YOLO

if __name__ == '__main__':
    # Load a pre-trained YOLOv8 Nano model (smallest and fastest, perfect for 4GB VRAM)
    model = YOLO('yolov8n.pt')

    # Train the model on the pothole dataset
    # This assumes the dataset has a data.yaml file in the extracted folder
    model.train(
        data='pothole.v17i.yolov8/data.yaml', 
        epochs=50, 
        imgsz=640, 
        batch=8, # Small batch size to fit in 4GB VRAM
        device=0 # Uses the first NVIDIA GPU
    )

    print("Training complete! The best weights are saved in runs/detect/train/weights/best.pt")
