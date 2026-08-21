import { useState } from 'react';
import { motion } from 'framer-motion';

export default function ResultsView({ results, analysisTime, onBack, onSaveToHistory, onNavigateToMap, showToast }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState(null);

  if (!results) return null;

  const { original, annotated, detections = [], total_detections = 0, image_size = { width: 0, height: 0 } } = results;

  const avgConfidence = total_detections > 0
    ? (detections.reduce((sum, d) => sum + (parseFloat(d.confidence) || 0), 0) / total_detections).toFixed(1)
    : 0;

  const getSeverity = (count) => {
    if (count >= 3) return { label: 'Critical Hazard', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', badge: 'bg-red-500' };
    if (count >= 1) return { label: 'Moderate Hazard', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', badge: 'bg-amber-500' };
    return { label: 'Pavement Clear', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', badge: 'bg-emerald-500' };
  };

  const severity = getSeverity(total_detections);

  const handleDownloadImage = () => {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${annotated}`;
    link.download = `pothole_detection_${Date.now()}.jpg`;
    link.click();
    showToast?.('Annotated detection image downloaded', 'success');
  };

  const handleSave = () => {
    if (isSaved) return;
    onSaveToHistory?.(results, analysisTime);
    setIsSaved(true);
  };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Top Action & Status Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors shadow-md"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-100 font-heading">
                AI Detection Inspection
              </h1>
              <span className={`px-3 py-0.5 rounded-full text-xs font-bold font-mono border ${severity.bg} ${severity.color}`}>
                {severity.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Inference finished in <strong className="text-amber-400 font-mono">{analysisTime || '0.12'}s</strong> • {total_detections} hazard{total_detections === 1 ? '' : 's'} identified
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleDownloadImage}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-500/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <span className="material-symbols-outlined text-base text-amber-400">download</span>
            Export Image
          </button>
          <button
            onClick={handleSave}
            disabled={isSaved}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
              isSaved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {isSaved ? 'check_circle' : 'bookmark'}
            </span>
            {isSaved ? 'Saved to Audit' : 'Save to History'}
          </button>
        </div>
      </div>

      {/* Main Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Before/After Comparison */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 md:p-6 overflow-hidden flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-base">compare</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Before / After AI Segmentation Slider
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Drag center line to compare</span>
            </div>

            {/* Split Comparison Viewport */}
            <div className="relative w-full aspect-[4/3] md:aspect-video rounded-2xl overflow-hidden select-none bg-black border border-slate-800">
              {/* Original Image Layer (Background) */}
              <img
                src={`data:image/jpeg;base64,${original || annotated}`}
                alt="Original road capture"
                className="absolute inset-0 w-full h-full object-contain"
              />

              {/* Annotated Image Layer (Foreground Clipped) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)` }}
              >
                <img
                  src={`data:image/jpeg;base64,${annotated}`}
                  alt="YOLOv8 Annotated"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>

              {/* Slider Divider Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_15px_#f59e0b] pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-500 border-2 border-slate-950 flex items-center justify-center text-slate-950 shadow-xl">
                  <span className="material-symbols-outlined text-base">code</span>
                </div>
              </div>

              {/* Range Input for Scrubbing */}
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(e) => setSliderPosition(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-20"
              />

              {/* HUD Tags */}
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-300 pointer-events-none">
                ORIGINAL (CLEAN)
              </div>
              <div className="absolute top-3 right-3 bg-amber-500/20 backdrop-blur-md px-2.5 py-1 rounded-lg border border-amber-500/40 text-[10px] font-mono text-amber-400 font-bold pointer-events-none">
                YOLOv8 AI DETECTIONS
              </div>
            </div>

            {/* Sub-image Info Strip */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
              <span>Resolution: {image_size.width} × {image_size.height}px</span>
              <span>Inference Device: PyTorch CUDA / CPU</span>
            </div>
          </div>
        </div>

        {/* Right Column: Detections & Hazard Telemetry */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Severity & Stats Tile */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Hazard Metrics
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold">{avgConfidence}% Avg Conf</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Total Count</span>
                <span className="text-2xl font-extrabold text-slate-100 font-heading mt-1">
                  {total_detections}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Severity Score</span>
                <span className={`text-2xl font-extrabold font-heading mt-1 ${severity.color}`}>
                  {total_detections > 0 ? `${Math.min(10, total_detections * 2.5)}/10` : '0/10'}
                </span>
              </div>
            </div>

            {/* Severity Progress */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Pavement Risk Level</span>
                <span className={severity.color}>{severity.label}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${severity.badge}`}
                  style={{ width: `${Math.min(100, Math.max(10, total_detections * 30))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Detections List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-xl flex-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Detected Objects ({total_detections})
              </h3>
              <span className="text-[10px] text-slate-500">Bounding boxes</span>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {detections.length > 0 ? (
                detections.map((det, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedDetection(det)}
                    className="p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-xl cursor-pointer transition-all flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs font-bold text-slate-200 uppercase font-mono">
                          {det.name || det.class || 'Pothole'}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {det.confidence}%
                      </span>
                    </div>
                    {det.bbox && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Box: [{det.bbox.x1}, {det.bbox.y1}] → [{det.bbox.x2}, {det.bbox.y2}]
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <span className="material-symbols-outlined text-emerald-400 text-3xl mb-1">
                    check_circle
                  </span>
                  <p className="font-bold text-slate-200">Zero Road Hazards</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Smooth asphalt surface detected</p>
                </div>
              )}
            </div>

            {/* Map Jump Button */}
            {onNavigateToMap && (
              <button
                onClick={onNavigateToMap}
                className="w-full mt-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-base text-cyan-400">pin_drop</span>
                View Road on GIS Map
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
