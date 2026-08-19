import { useState, useRef, useEffect } from 'react';
import BorderGlow from './BorderGlow';

export default function ScanView() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamError, setStreamError] = useState(false);
  const [boxes, setBoxes] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize Camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStreamError(false);
      } catch (err) {
        console.error("Camera error:", err);
        setStreamError(true);
      }
    }
    
    setupCamera();
    
    return () => {
      // Cleanup stream on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Inference Loop
  useEffect(() => {
    let active = true;
    
    async function runInference() {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        if (active) setTimeout(runInference, 100);
        return;
      }
      
      try {
        // Capture frame from video
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob and POST to backend
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.6));
        const formData = new FormData();
        formData.append('image', blob);
        
        // Use the localtunnel API URL
        const API_URL = 'https://plain-emus-happen.loca.lt';
        
        const response = await fetch(`${API_URL}/api/stream_detect`, {
          method: 'POST',
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: formData
        });
        
        if (response.ok) {
          setIsConnected(true);
          const data = await response.json();
          setBoxes(data.detections || []);
        } else {
          setIsConnected(false);
        }
      } catch (err) {
        setIsConnected(false);
      }
      
      // Schedule next inference frame (every ~500ms)
      if (active) setTimeout(runInference, 500); 
    }
    
    runInference();
    return () => { active = false; };
  }, []);

  // Draw Bounding Boxes
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Sync canvas resolution to its display size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scaling factor from video's native resolution to the actual display size
    const scaleX = canvas.width / videoRef.current.videoWidth;
    const scaleY = canvas.height / videoRef.current.videoHeight;
    
    boxes.forEach(box => {
      const {x1, y1, x2, y2, name, confidence} = box;
      
      const px = x1 * scaleX;
      const py = y1 * scaleY;
      const width = (x2 - x1) * scaleX;
      const height = (y2 - y1) * scaleY;
      
      // Draw Box
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.strokeRect(px, py, width, height);
      
      // Draw Label
      ctx.fillStyle = '#00FF00';
      ctx.font = 'bold 16px "Inter", sans-serif';
      ctx.fillText(`${name} ${confidence.toFixed(2)}`, px, py - 5);
    });
  }, [boxes]);

  return (
    <main className="flex-grow flex flex-col w-full max-w-4xl mx-auto px-container-padding py-6 gap-section-gap">
      <div className="flex flex-col items-center gap-4 mb-4">
        <h2 className="text-2xl font-headline-lg-mobile text-on-surface">Live Pothole Detection</h2>
        <p className="text-on-surface-variant text-center max-w-2xl">
          Real-time video feed. Make sure your Python backend is running and you have granted camera permissions.
        </p>
      </div>

      <BorderGlow
        edgeSensitivity={30}
        glowColor="26 80 80"
        backgroundColor="#16181D"
        borderRadius={12}
        glowRadius={30}
        glowIntensity={1}
        coneSpread={25}
        animated={false}
        colors={['#149ECA', '#8ab4f8', '#F0B429']}
        className="w-full aspect-[4/5] md:aspect-video relative overflow-hidden"
      >
        <div className="w-full h-full flex items-center justify-center bg-black relative">
          {!streamError ? (
            <>
              {/* Native video element for smooth streaming */}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
              />
              {/* Overlay canvas for drawing YOLO bounding boxes */}
              <canvas 
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
            </>
          ) : (
            <div className="flex flex-col items-center text-center p-6 gap-4">
              <span className="material-symbols-outlined text-error text-5xl">videocam_off</span>
              <p className="text-error font-bold">Cannot access webcam.</p>
              <p className="text-on-surface-variant text-sm">Please ensure you have granted camera permissions to this website.</p>
              <button 
                className="mt-4 px-6 py-2 bg-surface-card border border-asphalt-gray rounded-full hover:bg-asphalt-gray transition-colors"
                onClick={() => window.location.reload()}
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </BorderGlow>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="bg-surface-card border border-asphalt-gray rounded-xl p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">speed</span>
            <span className="font-label-mono text-xs uppercase tracking-wider">Stream</span>
          </div>
          <div className="font-data-metric text-data-metric text-primary">
            LIVE
          </div>
        </div>
        <div className="bg-surface-card border border-asphalt-gray rounded-xl p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">verified</span>
            <span className="font-label-mono text-xs uppercase tracking-wider">Model</span>
          </div>
          <div className="font-data-metric text-[16px] leading-[24px] font-bold text-on-surface">YOLOv8 API</div>
        </div>
        <div className="bg-surface-card border border-asphalt-gray rounded-xl p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span className="font-label-mono text-xs uppercase tracking-wider">Classes</span>
          </div>
          <div className="font-data-metric text-data-metric text-danger-orange">10</div>
        </div>
        <div className="bg-surface-card border border-asphalt-gray rounded-xl p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">memory</span>
            <span className="font-label-mono text-xs uppercase tracking-wider">Status</span>
          </div>
          <div className={`font-data-metric text-data-metric ${isConnected ? 'text-ai-cyan' : 'text-error'}`}>
            {isConnected ? 'API Connected' : 'API Disconnected'}
          </div>
        </div>
      </section>
    </main>
  );
}
