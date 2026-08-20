import requests

url = "http://localhost:5000/api/stream_detect"
files = {"image": open("Pothole Detection  Pothole Detection using python and yolov8.png", "rb")}
response = requests.post(url, files=files)
print(response.json())
