import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { speakAlert } from '../utils/useGeolocation';

export default function ScanView({
  onDetectionComplete,
  onAutoLogHazard,
  isLoading,
  setIsLoading,
  apiUrl,
  onOpenSettings,
  currentGps,
  isGpsTracking,
  isSimulating,
  onStartGps,
  onStopGps,
  onToggleSimulation,
  showToast,
}) {
  const [scanMode, setScanMode] = useState('upload'); // 'upload' | 'camera'
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.15);
  const [isDriveModeActive, setIsDriveModeActive] = useState(false);
  const [isVoiceAlertEnabled, setIsVoiceAlertEnabled] = useState(true);
  const [recentDetectionAlert, setRecentDetectionAlert] = useState(null);

  // Camera HUD State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [liveBoxes, setLiveBoxes] = useState([]);
  const [liveFps, setLiveFps] = useState(0);
  const [liveLatency, setLiveLatency] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const fileInputRef = useRef(null);
  const lastAutoLogTimeRef = useRef(0);

  // Sample preset demo images
  const sampleImages = [
    {
      id: 'pothole-1',
      title: 'Main St Bridge Severe Pothole',
      desc: 'Deep asphalt crater on high-speed arterial road',
      badge: 'High Severity',
      badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
      url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      gps: { lat: 34.0522, lng: -118.2437, address: '1400 Main St Bridge, LA' },
    },
    {
      id: 'pothole-2',
      title: 'Grand Ave Cluster Fractures',
      desc: 'Severe pavement deterioration and multiple potholes',
      badge: 'Cluster Hazards',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      gps: { lat: 34.0545, lng: -118.2520, address: 'Grand Ave & 5th St, LA' },
    },
    {
      id: 'crack-1',
      title: 'Broadway Asphalt Transverse Fissure',
      desc: 'Longitudinal road distress across traffic lanes',
      badge: 'Surface Crack',
      badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      url: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=800&q=80',
      gps: { lat: 34.0485, lng: -118.2495, address: 'Broadway Boulevard #42, LA' },
    },
  ];

  // Run File Detection via /api/detect with GPS Geotagging
  const runFileDetection = async (file, customGps = null) => {
    setIsLoading(true);
    const startTime = performance.now();

    try {
      const formData = new FormData();
      formData.append('image', file);

      // Attach GPS coordinates if available
      const activeGps = customGps || currentGps;
      if (activeGps && activeGps.lat && activeGps.lng) {
        formData.append('lat', activeGps.lat);
        formData.append('lng', activeGps.lng);
        formData.append('speed', activeGps.speed || 0);
        formData.append('address', activeGps.address || '');
      }

      const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
      const response = await fetch(`${targetUrl}/api/detect`, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Detection API responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

      // Ensure GPS metadata is injected into the detection result
      const enrichedData = {
        ...data,
        gps: data.gps || activeGps || {
          lat: 34.0522,
          lng: -118.2437,
          address: 'Main St & 4th Ave, Los Angeles, CA',
        },
      };

      showToast?.(
        `Detected ${enrichedData.total_detections} hazard${
          enrichedData.total_detections === 1 ? '' : 's'
        } with GPS geotag in ${elapsed}s`,
        'success'
      );

      // If potholes were found, auto-log to the global map & traffic layer
      if (enrichedData.total_detections > 0 && onAutoLogHazard) {
        onAutoLogHazard(enrichedData);
      }

      onDetectionComplete(enrichedData, elapsed);
    } catch (err) {
      console.error('Detection error:', err);
      showToast?.(`Backend connection error: ${err.message}. Check API Settings.`, 'error');
      setIsLoading(false);
    }
  };

  // Handle Demo Sample Click
  const handleSelectSample = async (sample) => {
    setIsLoading(true);
    try {
      const res = await fetch(sample.url);
      const blob = await res.blob();
      const file = new File([blob], `${sample.id}.jpg`, { type: 'image/jpeg' });
      setSelectedImage(file);
      await runFileDetection(file, sample.gps);
    } catch (err) {
      showToast?.('Failed to load sample image. Please upload a local file.', 'error');
      setIsLoading(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      runFileDetection(file);
    }
  }, [currentGps]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      runFileDetection(file);
    }
  };

  // Initialize / Switch Camera Stream
  useEffect(() => {
    if (scanMode !== 'camera') {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
      return;
    }

    let stream = null;
    async function startCamera() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setCameraError(err.message || 'Camera permission denied or camera not found.');
        setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [scanMode, facingMode]);

  // Live Stream Continuous Inference Loop & Automated GPS Hazard Pinning
  useEffect(() => {
    if (scanMode !== 'camera' || !cameraActive) return;

    let isRunning = true;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    async function streamInference() {
      if (!isRunning) return;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        const frameStart = performance.now();
        try {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = 640;
          offCanvas.height = 480;
          const ctx = offCanvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);

          const blob = await new Promise((res) => offCanvas.toBlob(res, 'image/jpeg', 0.65));
          const formData = new FormData();
          formData.append('image', blob);

          const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
          const res = await fetch(`${targetUrl}/api/stream_detect`, {
            method: 'POST',
            headers: {
              'ngrok-skip-browser-warning': 'true',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: formData,
            signal: AbortSignal.timeout(2000),
          });

          if (res.ok) {
            const data = await res.json();
            const filteredBoxes = (data.detections || []).filter(
              (b) => b.confidence >= confidenceThreshold
            );
            setLiveBoxes(filteredBoxes);
            setIsConnected(true);
            const latency = Math.round(performance.now() - frameStart);
            setLiveLatency(latency);

            // Automated GPS Hazard Logging during Drive Dashcam Mode
            if (filteredBoxes.length > 0) {
              const now = Date.now();
              // Debounce auto-logging every 3.5 seconds
              if (now - lastAutoLogTimeRef.current > 3500) {
                lastAutoLogTimeRef.current = now;
                const topBox = filteredBoxes[0];
                const confPercent = Math.round(topBox.confidence * 100);

                setRecentDetectionAlert({
                  text: `Pothole Identified (${confPercent}%)`,
                  address: currentGps?.address || 'Current GPS Location',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                });

                // Voice Speech Alert
                if (isVoiceAlertEnabled) {
                  speakAlert(
                    `Warning! Severe pothole detected ahead on ${
                      currentGps?.address?.split(',')[0] || 'the roadway'
                    }`
                  );
                }

                // Push to global Map and Traffic layer
                if (onAutoLogHazard) {
                  // Capture thumbnail snapshot
                  const snapshotUrl = offCanvas.toDataURL('image/jpeg', 0.8);
                  onAutoLogHazard({
                    original: snapshotUrl.split(',')[1],
                    annotated: snapshotUrl.split(',')[1],
                    total_detections: filteredBoxes.length,
                    detections: filteredBoxes.map((b) => ({
                      name: b.name,
                      confidence: Math.round(b.confidence * 100),
                      bbox: { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 },
                    })),
                    gps: currentGps,
                  });
                }
              }
            }
          } else {
            setIsConnected(false);
          }
        } catch (err) {
          setIsConnected(false);
        }

        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
          setLiveFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
          frameCount = 0;
          lastFpsTime = now;
        }
      }

      if (isRunning) {
        setTimeout(streamInference, 320); // ~3 FPS
      }
    }

    streamInference();

    return () => {
      isRunning = false;
    };
  }, [
    scanMode,
    cameraActive,
    apiUrl,
    confidenceThreshold,
    currentGps,
    isVoiceAlertEnabled,
    onAutoLogHazard,
  ]);

  // Draw Live Bounding Boxes on Overlay Canvas
  useEffect(() => {
    if (scanMode !== 'camera' || !canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (liveBoxes.length === 0) return;

    const scaleX = canvas.width / 640;
    const scaleY = canvas.height / 480;

    liveBoxes.forEach((box) => {
      const { x1, y1, x2, y2, name, confidence } = box;
      const px = x1 * scaleX;
      const py = y1 * scaleY;
      const bw = (x2 - x1) * scaleX;
      const bh = (y2 - y1) * scaleY;

      // Glow bounding rectangle
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(px, py, bw, bh);

      // Corner accent brackets
      const cornerLength = Math.min(14, bw / 3, bh / 3);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#f87171';
      ctx.shadowBlur = 0;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(px, py + cornerLength);
      ctx.lineTo(px, py);
      ctx.lineTo(px + cornerLength, py);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(px + bw, py + bh - cornerLength);
      ctx.lineTo(px + bw, py + bh);
      ctx.lineTo(px + bw - cornerLength, py + bh);
      ctx.stroke();

      // Label Tag
      const labelText = `⚠️ ${name.toUpperCase()} ${Math.round(confidence * 100)}%`;
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(px, Math.max(0, py - 22), textWidth + 14, 22);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, px + 6, Math.max(15, py - 6));
    });
  }, [liveBoxes, scanMode]);

  // Capture snapshot from live stream and analyze fully
  const handleCaptureSnapshot = async () => {
    if (!videoRef.current) return;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = videoRef.current.videoWidth || 1280;
    offCanvas.height = videoRef.current.videoHeight || 720;
    const ctx = offCanvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, offCanvas.width, offCanvas.height);

    offCanvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `live_snapshot_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedImage(file);
        setScanMode('upload');
        await runFileDetection(file, currentGps);
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Top Banner / Mode Switcher */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-2xl">radar</span>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100 font-heading">
              AI Road Hazard Scanner
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              YOLOv8 deep learning road inspection with live GPS tracking & traffic congestion mapping
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1 w-full md:w-auto">
          <button
            onClick={() => setScanMode('upload')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              scanMode === 'upload'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            Upload & Analyze
          </button>
          <button
            onClick={() => setScanMode('camera')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              scanMode === 'camera'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">videocam</span>
            Live Dashcam HUD
          </button>
        </div>
      </div>

      {/* GPS Telemetry & Drive Mode Ribbon */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          {/* GPS Status Indicator */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isSimulating
                  ? 'bg-blue-400 animate-pulse'
                  : isGpsTracking
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-mono font-bold text-slate-200">
              {isSimulating
                ? '🚗 SIMULATING DRIVE'
                : isGpsTracking
                ? '📡 GPS LOCKED'
                : '📍 GPS READY'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate max-w-[280px]">
              <span className="material-symbols-outlined text-sm text-cyan-400">location_on</span>
              {currentGps?.address || 'Downtown Road Corridor'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {currentGps?.lat?.toFixed(5)}°N, {currentGps?.lng?.toFixed(5)}°W • {currentGps?.speed || 0} km/h • Heading {currentGps?.heading || 0}°
            </span>
          </div>
        </div>

        {/* GPS Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isSimulating) {
                onToggleSimulation?.();
                showToast?.('Drive simulation ended', 'info');
              } else {
                onToggleSimulation?.();
                showToast?.('🚗 Live road drive route simulation active', 'success');
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isSimulating
                ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-sm">directions_car</span>
            {isSimulating ? 'Stop Simulation' : 'Simulate Drive'}
          </button>

          <button
            onClick={() => {
              if (isGpsTracking && !isSimulating) {
                onStopGps?.();
                showToast?.('Hardware GPS paused', 'info');
              } else {
                onStartGps?.();
                showToast?.('Live Device GPS enabled', 'success');
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isGpsTracking && !isSimulating
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-sm">my_location</span>
            {isGpsTracking && !isSimulating ? 'GPS Active' : 'Enable Device GPS'}
          </button>

          <button
            onClick={() => {
              setIsVoiceAlertEnabled(!isVoiceAlertEnabled);
              showToast?.(
                isVoiceAlertEnabled ? 'Voice warnings muted' : 'Voice warnings active',
                'info'
              );
            }}
            className={`p-1.5 rounded-xl border transition-colors ${
              isVoiceAlertEnabled
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
            title="Toggle Voice Alerts for Potholes"
          >
            <span className="material-symbols-outlined text-base">
              {isVoiceAlertEnabled ? 'volume_up' : 'volume_off'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Scanner Stage */}
      <div className="w-full">
        {scanMode === 'upload' ? (
          /* ================= UPLOAD MODE ================= */
          <div className="flex flex-col gap-6">
            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isLoading && fileInputRef.current?.click()}
              className={`relative cursor-pointer group rounded-3xl border-2 border-dashed p-8 md:p-12 flex flex-col items-center justify-center text-center transition-all min-h-[320px] bg-slate-900/60 overflow-hidden ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/10 scale-[1.01]'
                  : 'border-slate-700/80 hover:border-amber-500/60 hover:bg-slate-900/90'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />

              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col items-center gap-4 z-10"
                  >
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
                      <span className="material-symbols-outlined text-amber-400 text-3xl animate-pulse">
                        analytics
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-bold text-slate-100 font-heading">
                        Analyzing Road Surface & Geotagging...
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        Executing YOLOv8 inference and registering road traffic coordinates
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-4 z-10"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform shadow-[0_0_25px_rgba(245,158,11,0.25)]">
                      <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100 font-heading">
                        Drop Road Photo Here or <span className="text-amber-400 underline">Browse</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Auto-geotags detected potholes with your GPS location and updates the Google Maps traffic layer
                      </p>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <span className="px-3 py-1 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700">
                        ⚡ Instant AI Detection
                      </span>
                      <span className="px-3 py-1 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700">
                        🛰️ Auto GPS Geotagging
                      </span>
                      <span className="px-3 py-1 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700">
                        🚦 Road Traffic Indicator
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick-Start Demo Samples with GPS Coordinates */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-sm">flash_on</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Test Road Scans (Auto Geotagged to Traffic Map)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500">1-click test with GPS road pinning</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {sampleImages.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => !isLoading && handleSelectSample(sample)}
                    className="bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3 flex flex-col gap-3 cursor-pointer group transition-all transform hover:-translate-y-1 shadow-lg"
                  >
                    <div className="w-full h-32 rounded-xl overflow-hidden relative">
                      <img
                        src={sample.url}
                        alt={sample.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span
                        className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border backdrop-blur-md ${sample.badgeColor}`}
                      >
                        {sample.badge}
                      </span>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="px-3 py-1 bg-amber-500 text-slate-950 text-xs font-bold rounded-lg shadow-md flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">play_arrow</span> Run Test
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{sample.title}</h4>
                      <p className="text-[10px] font-mono text-cyan-400 mt-0.5">{sample.gps.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ================= LIVE DASHCAM CAMERA MODE ================= */
          <div className="flex flex-col gap-4">
            <div className="relative w-full aspect-[4/3] md:aspect-video bg-black rounded-3xl overflow-hidden border border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)] flex items-center justify-center">
              {!cameraError ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />

                  {/* Top Notification Toast for Live Pothole Logging */}
                  {recentDetectionAlert && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600/95 border border-red-400 text-white px-4 py-2 rounded-2xl shadow-[0_0_25px_rgba(239,68,68,0.8)] flex items-center gap-2.5 animate-bounce">
                      <span className="material-symbols-outlined text-xl">crisis_alert</span>
                      <div>
                        <p className="text-xs font-bold">{recentDetectionAlert.text}</p>
                        <p className="text-[10px] text-red-100 font-mono">
                          📍 Geotagged at {recentDetectionAlert.address} • Road marked RED
                        </p>
                      </div>
                    </div>
                  )}

                  {/* HUD Framing & Telemetry Overlays */}
                  <div className="absolute inset-0 pointer-events-none border border-amber-500/10 m-4 rounded-2xl flex flex-col justify-between p-4">
                    {/* Top HUD Telemetry Bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="font-mono text-xs font-bold text-slate-200">DASHCAM FEED</span>
                        <span className="text-slate-600">|</span>
                        <span className="font-mono text-xs text-amber-400">{liveFps} FPS</span>
                        <span className="text-slate-600">|</span>
                        <span className="font-mono text-xs text-cyan-400">{liveLatency}ms</span>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl">
                        <span className="material-symbols-outlined text-sm text-red-400">warning</span>
                        <span className="font-mono text-xs font-bold text-red-400">
                          {liveBoxes.length} POTHOLE{liveBoxes.length === 1 ? '' : 'S'} DETECTED
                        </span>
                      </div>
                    </div>

                    {/* Center Targeting Reticle */}
                    <div className="self-center flex flex-col items-center justify-center opacity-40">
                      <div className="w-12 h-12 border border-dashed border-amber-400 rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                      </div>
                    </div>

                    {/* Bottom HUD Controls */}
                    <div className="flex items-center justify-between pointer-events-auto">
                      <button
                        onClick={() =>
                          setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                        }
                        className="p-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md transition-colors"
                      >
                        <span className="material-symbols-outlined text-base text-amber-400">
                          flip_camera_ios
                        </span>
                        Flip Cam
                      </button>

                      <button
                        onClick={handleCaptureSnapshot}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined text-lg">camera</span>
                        Snapshot & Geotag
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center p-8 gap-4 max-w-md">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                    <span className="material-symbols-outlined text-3xl">videocam_off</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Camera Access Disabled</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {cameraError}. Please permit camera access in your browser or switch to upload mode.
                    </p>
                  </div>
                  <button
                    onClick={() => setScanMode('upload')}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Switch to File Upload
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Telemetry & System Status Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">AI Model</span>
          <span className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            YOLOv8 Ultralytics
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Confidence Cutoff</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              className="w-20 accent-amber-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-bold text-amber-400 font-mono">
              {Math.round(confidenceThreshold * 100)}%
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Target Server</span>
          <button
            onClick={onOpenSettings}
            className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1 truncate text-left"
          >
            <span className="material-symbols-outlined text-xs">tune</span>
            {apiUrl || 'http://localhost:5000'}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">API Status</span>
          <span className={`text-xs font-bold font-mono flex items-center gap-1.5 ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'ONLINE (READY)' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </main>
  );
}
