import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { speakAlert } from '../utils/useGeolocation';

export default function ScanView({
  onDetectionComplete,
  onAutoLogHazard,
  isLoading,
  setIsLoading,
  apiUrl,
  currentGps,
  isGpsTracking,
  isSimulating,
  onStartGps,
  onStopGps,
  onToggleSimulation,
  onNavigateToMap,
  hazards = [],
  showToast,
}) {
  const [scanMode, setScanMode] = useState('camera'); // default to 'camera' for instant live dashcam
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.15);
  const [isVoiceAlertEnabled, setIsVoiceAlertEnabled] = useState(true);
  const [recentDetectionAlert, setRecentDetectionAlert] = useState(null);
  const [taggedPotholesCount, setTaggedPotholesCount] = useState(0);

  // Camera HUD State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const miniMapContainerRef = useRef(null);
  const miniMapInstanceRef = useRef(null);
  const miniMapVehicleMarkerRef = useRef(null);
  const miniMapHazardsLayerRef = useRef(L.layerGroup());

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [liveBoxes, setLiveBoxes] = useState([]);
  const [liveFps, setLiveFps] = useState(0);
  const [liveLatency, setLiveLatency] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const fileInputRef = useRef(null);
  const lastAutoLogTimeRef = useRef(0);

  // Auto-start GPS when on camera mode
  useEffect(() => {
    if (scanMode === 'camera' && !isGpsTracking && !isSimulating && onStartGps) {
      onStartGps();
    }
  }, [scanMode, isGpsTracking, isSimulating, onStartGps]);

  // Mini-Map Initializer
  useEffect(() => {
    if (scanMode !== 'camera' || !miniMapContainerRef.current) return;
    if (miniMapInstanceRef.current) {
      miniMapInstanceRef.current.invalidateSize();
      return;
    }

    const lat = currentGps?.lat || 34.0515;
    const lng = currentGps?.lng || -118.2480;

    const miniMap = L.map(miniMapContainerRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      subdomains: 'abc',
      maxZoom: 19,
    }).addTo(miniMap);

    miniMapHazardsLayerRef.current.addTo(miniMap);
    miniMapInstanceRef.current = miniMap;

    const t1 = setTimeout(() => miniMap.invalidateSize(), 150);
    const t2 = setTimeout(() => miniMap.invalidateSize(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }
    };
  }, [scanMode]);

  // Update Mini-Map vehicle position and markers in real-time
  useEffect(() => {
    if (!miniMapInstanceRef.current) return;

    if (currentGps?.lat && currentGps?.lng) {
      const { lat, lng, heading = 0 } = currentGps;

      // Update vehicle dot
      const vehicleHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></div>
          <div class="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_12px_#3b82f6] flex items-center justify-center text-white">
            <span class="material-symbols-outlined text-[11px]" style="transform: rotate(${heading}deg)">navigation</span>
          </div>
        </div>
      `;

      const vehicleIcon = L.divIcon({
        html: vehicleHtml,
        className: 'custom-vehicle-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (!miniMapVehicleMarkerRef.current) {
        miniMapVehicleMarkerRef.current = L.marker([lat, lng], {
          icon: vehicleIcon,
          zIndexOffset: 500,
        }).addTo(miniMapInstanceRef.current);
      } else {
        miniMapVehicleMarkerRef.current.setLatLng([lat, lng]);
        miniMapVehicleMarkerRef.current.setIcon(vehicleIcon);
      }

      miniMapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.4 });
    }

    // Update Mini-Map Pothole Pins
    miniMapHazardsLayerRef.current.clearLayers();
    hazards.forEach((h) => {
      const isCritical = h.severity === 'critical';
      const spotColor = isCritical ? '#ef4444' : '#f59e0b';

      L.circle([h.lat, h.lng], {
        radius: isCritical ? 9 : 6,
        color: spotColor,
        fillColor: spotColor,
        fillOpacity: 0.5,
        weight: 1.5,
      }).addTo(miniMapHazardsLayerRef.current);
    });
  }, [currentGps, hazards]);

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
        } with GPS location in ${elapsed}s`,
        'success'
      );

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

  // Initialize Camera Stream
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

  // Autonomous Live Inference Loop & Real-Time GPS Pinning (Ultra-Fast)
  useEffect(() => {
    if (scanMode !== 'camera' || !cameraActive) return;

    let isRunning = true;
    let isProcessing = false;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    async function streamInference() {
      if (!isRunning || isProcessing) return;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        isProcessing = true;
        const frameStart = performance.now();
        try {
          const offCanvas = document.createElement('canvas');
          // High-speed 480x360 resolution for fast AI inference
          offCanvas.width = 480;
          offCanvas.height = 360;
          const ctx = offCanvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, 480, 360);

          const blob = await new Promise((res) => offCanvas.toBlob(res, 'image/jpeg', 0.55));
          if (!blob) {
            isProcessing = false;
            return;
          }

          const formData = new FormData();
          formData.append('image', blob, 'frame.jpg');

          const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
          const res = await fetch(`${targetUrl}/api/stream_detect`, {
            method: 'POST',
            headers: {
              'ngrok-skip-browser-warning': 'true',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: formData,
            signal: AbortSignal.timeout(1500),
          });

          if (res.ok) {
            const data = await res.json();
            // Scale bbox back to original 640x480 coordinate space for overlay canvas
            const scaleX = 640 / 480;
            const scaleY = 480 / 360;

            const filteredBoxes = (data.detections || [])
              .filter((b) => b.confidence >= confidenceThreshold)
              .map((b) => ({
                ...b,
                x1: b.x1 * scaleX,
                y1: b.y1 * scaleY,
                x2: b.x2 * scaleX,
                y2: b.y2 * scaleY,
              }));

            setLiveBoxes(filteredBoxes);
            setIsConnected(true);
            const latency = Math.round(performance.now() - frameStart);
            setLiveLatency(latency);

            // Autonomous GPS Hazard Pinning (Zero Clicks Required)
            if (filteredBoxes.length > 0) {
              const now = Date.now();
              if (now - lastAutoLogTimeRef.current > 3200) {
                lastAutoLogTimeRef.current = now;
                const topBox = filteredBoxes[0];
                const confPercent = Math.round(topBox.confidence * 100);

                setTaggedPotholesCount((c) => c + 1);

                setRecentDetectionAlert({
                  text: `Pothole Pinned (${confPercent}%)`,
                  address: currentGps?.address || 'Current Road Coordinate',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                });

                // Spoken Audio Alert
                if (isVoiceAlertEnabled) {
                  speakAlert(
                    `Pothole detected ahead on ${currentGps?.address?.split(',')[0] || 'the road'}`
                  );
                }

                // Push to global Map & History
                if (onAutoLogHazard) {
                  const snapshotUrl = offCanvas.toDataURL('image/jpeg', 0.65);
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
        } finally {
          isProcessing = false;
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
        // Fast dynamic throttle for high frame rate (sub-100ms)
        setTimeout(streamInference, 70);
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

  // Draw Bounding Boxes on Overlay Canvas
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

      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(px, py, bw, bh);

      const cornerLength = Math.min(14, bw / 3, bh / 3);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#f87171';
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.moveTo(px, py + cornerLength);
      ctx.lineTo(px, py);
      ctx.lineTo(px + cornerLength, py);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px + bw, py + bh - cornerLength);
      ctx.lineTo(px + bw, py + bh);
      ctx.lineTo(px + bw - cornerLength, py + bh);
      ctx.stroke();

      const labelText = `⚠️ ${name.toUpperCase()} ${Math.round(confidence * 100)}%`;
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(px, Math.max(0, py - 22), textWidth + 14, 22);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, px + 6, Math.max(15, py - 6));
    });
  }, [liveBoxes, scanMode]);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-2.5 sm:px-4 md:px-8 py-2.5 sm:py-4 flex flex-col gap-3 sm:gap-4 animate-in fade-in duration-300">
      {/* Top Banner / Mode Switcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex-shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">radar</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-100 font-heading">
              Real-Time Road Hazard Dashcam
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Autonomous GPS tracking & live pothole pinning
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 w-full md:w-auto">
          <button
            onClick={() => setScanMode('camera')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              scanMode === 'camera'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm sm:text-base">videocam</span>
            Live Dashcam
          </button>
          <button
            onClick={() => setScanMode('upload')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              scanMode === 'upload'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm sm:text-base">cloud_upload</span>
            Upload Photo
          </button>
        </div>
      </div>

      {/* Live GPS Telemetry Ribbon */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 flex-shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                isSimulating
                  ? 'bg-blue-400 animate-pulse'
                  : isGpsTracking
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-200">
              {isSimulating ? '🚗 SIMULATING' : isGpsTracking ? '📡 GPS LIVE' : '📍 GPS READY'}
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-100 flex items-center gap-1 truncate">
              <span className="material-symbols-outlined text-xs text-cyan-400 flex-shrink-0">location_on</span>
              <span className="truncate">{currentGps?.address || 'Surveying Roadway'}</span>
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 truncate">
              {currentGps?.lat?.toFixed(4)}°N, {currentGps?.lng?.toFixed(4)}°W • {currentGps?.speed || 0} km/h • Head {currentGps?.heading || 0}°
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-1.5">
          {taggedPotholesCount > 0 && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-2 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 animate-pulse">
              <span className="material-symbols-outlined text-xs">crisis_alert</span>
              {taggedPotholesCount} Logged
            </div>
          )}

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
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
              isSimulating
                ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-sm">directions_car</span>
            {isSimulating ? 'Stop Sim' : 'Simulate Drive'}
          </button>

          <button
            onClick={() => {
              setIsVoiceAlertEnabled(!isVoiceAlertEnabled);
              showToast?.(isVoiceAlertEnabled ? 'Voice muted' : 'Voice alert active', 'info');
            }}
            className={`p-1.5 rounded-xl border transition-colors ${
              isVoiceAlertEnabled
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
            title="Toggle Voice Alerts"
          >
            <span className="material-symbols-outlined text-base">
              {isVoiceAlertEnabled ? 'volume_up' : 'volume_off'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Screen Layout */}
      <div className="w-full">
        {scanMode === 'camera' ? (
          /* ================= LIVE DASHCAM MODE WITH EMBEDDED MINI-MAP ================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left/Top: Live Camera Feed */}
            <div className="lg:col-span-8 relative aspect-[4/3] md:aspect-video bg-black rounded-3xl overflow-hidden border border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)] flex items-center justify-center">
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

                  {/* Real-Time Auto-Pinning Flash Notification */}
                  {recentDetectionAlert && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600/95 border border-red-400 text-white px-4 py-2 rounded-2xl shadow-[0_0_25px_rgba(239,68,68,0.8)] flex items-center gap-2 animate-bounce pointer-events-none">
                      <span className="material-symbols-outlined text-lg">crisis_alert</span>
                      <div>
                        <p className="text-xs font-bold">{recentDetectionAlert.text}</p>
                        <p className="text-[10px] text-red-100 font-mono">
                          📍 Auto-pinned on map at {recentDetectionAlert.address}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Camera Telemetry Overlay */}
                  <div className="absolute inset-0 pointer-events-none border border-amber-500/10 m-3 rounded-2xl flex flex-col justify-between p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-slate-950/85 border border-slate-800 backdrop-blur-md px-2.5 py-1 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span className="font-mono text-xs font-bold text-slate-200">LIVE FEED</span>
                        <span className="text-slate-600">|</span>
                        <span className="font-mono text-xs text-amber-400">{liveFps} FPS</span>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-950/85 border border-slate-800 backdrop-blur-md px-2.5 py-1 rounded-xl">
                        <span className="material-symbols-outlined text-sm text-red-400">warning</span>
                        <span className="font-mono text-xs font-bold text-red-400">
                          {liveBoxes.length} POTHOLE{liveBoxes.length === 1 ? '' : 'S'} IN VIEW
                        </span>
                      </div>
                    </div>

                    {/* Reticle */}
                    <div className="self-center flex flex-col items-center justify-center opacity-40">
                      <div className="w-10 h-10 border border-dashed border-amber-400 rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pointer-events-auto">
                      <button
                        onClick={() =>
                          setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                        }
                        className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl flex items-center gap-1 text-xs font-semibold backdrop-blur-md transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm text-amber-400">
                          flip_camera_ios
                        </span>
                        Flip Cam
                      </button>

                      <div className="bg-slate-950/80 px-3 py-1 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300">
                        ⚡ Autonomous Road Scan Active
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center p-6 gap-3 max-w-md">
                  <span className="material-symbols-outlined text-3xl text-red-400">videocam_off</span>
                  <p className="text-xs text-slate-300">{cameraError}</p>
                  <button
                    onClick={() => setScanMode('upload')}
                    className="px-4 py-1.5 bg-slate-800 text-slate-200 rounded-xl text-xs"
                  >
                    Switch to File Upload
                  </button>
                </div>
              )}
            </div>

            {/* Right/Bottom: Live Synchronized GPS Mini-Map HUD */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col gap-3 shadow-xl h-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-400 text-sm">map</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                      Live GPS Road Tracker
                    </h3>
                  </div>
                  {onNavigateToMap && (
                    <button
                      onClick={onNavigateToMap}
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5"
                    >
                      Full Map <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </button>
                  )}
                </div>

                {/* Leaflet Mini-Map Viewport */}
                <div
                  ref={miniMapContainerRef}
                  className="w-full h-56 lg:h-72 rounded-2xl overflow-hidden border border-slate-800 z-10"
                />

                {/* Road telemetry footer */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-slate-300 text-[11px]">Speed: {currentGps?.speed || 0} km/h</span>
                  </div>
                  <span className="text-amber-400 text-[11px]">
                    {hazards.length} Potholes on Map
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= UPLOAD PHOTO MODE ================= */
          <div className="flex flex-col gap-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isLoading && fileInputRef.current?.click()}
              className={`relative cursor-pointer group rounded-3xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-all min-h-[260px] bg-slate-900/60 overflow-hidden ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/10 scale-[1.01]'
                  : 'border-slate-700/80 hover:border-amber-500/60 hover:bg-slate-900/90'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3 z-10"
                  >
                    <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
                    <p className="text-sm font-bold text-slate-100 font-heading">
                      Analyzing Road Photo & Geotagging...
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3 z-10"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 font-heading">
                        Drop Road Photo Here or <span className="text-amber-400 underline">Browse</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Auto-attaches current GPS location & updates the live road map
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Test Samples */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {sampleImages.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => !isLoading && handleSelectSample(sample)}
                  className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3 flex flex-col gap-2 cursor-pointer transition-all"
                >
                  <div className="w-full h-24 rounded-xl overflow-hidden relative">
                    <img
                      src={sample.url}
                      alt={sample.title}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[9px] font-bold font-mono border backdrop-blur-md ${sample.badgeColor}`}
                    >
                      {sample.badge}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 truncate">{sample.title}</h4>
                    <p className="text-[10px] font-mono text-cyan-400 truncate mt-0.5">
                      {sample.gps.address}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer System Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3">
        <div className="flex flex-col">
          <span className="text-[9px] font-mono uppercase text-slate-400">AI Model</span>
          <span className="text-xs font-bold text-slate-200 font-mono">YOLOv8 Ultralytics</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] font-mono uppercase text-slate-400">Confidence Threshold</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              className="w-16 accent-amber-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-bold text-amber-400 font-mono">
              {Math.round(confidenceThreshold * 100)}%
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] font-mono uppercase text-slate-400">AI Edge Node</span>
          <span className="text-xs font-mono text-cyan-400 font-bold truncate text-left">
            YOLOv8 Cloud Tunnel
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] font-mono uppercase text-slate-400">API Status</span>
          <span className={`text-xs font-bold font-mono flex items-center gap-1 ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </main>
  );
}
