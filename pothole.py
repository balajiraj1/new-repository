import cv2
from ultralytics import YOLO
import numpy as np

# Load the YOLOv8 model (pre-trained or fine-tuned on pothole dataset)
model = YOLO('best.pt')  # Replace with path to fine-tuned pothole model if available

# Initialize video capture (0 for webcam, or provide video file path)
video_path = 'pothole.mp4'  # Replace with your video file path
cap = cv2.VideoCapture(video_path)

# Get video properties
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = int(cap.get(cv2.CAP_PROP_FPS))

# Initialize video writer to save output
output_path = 'output_pothole_detection.mp4'
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Perform pothole detection
    results = model(frame)

    # Process results
    for result in results:
        boxes = result.boxes.xyxy.cpu().numpy()  # Bounding box coordinates
        scores = result.boxes.conf.cpu().numpy()  # Confidence scores
        classes = result.boxes.cls.cpu().numpy()  # Class IDs

        for box, score, cls in zip(boxes, scores, classes):
            if score > 0.5:  # Confidence threshold
                x1, y1, x2, y2 = map(int, box)
                label = f'Pothole: {score:.2f}'
                # Draw bounding box and label
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    # Write frame to output video
    out.write(frame)

    # Optional: Display the frame (comment out if not needed)
    cv2.imshow('Pothole Detection', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release resources
cap.release()
out.release()
cv2.destroyAllWindows()