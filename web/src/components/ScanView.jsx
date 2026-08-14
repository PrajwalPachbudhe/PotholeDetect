import { useState, useRef, useCallback } from 'react';
import BorderGlow from './BorderGlow';

export default function ScanView({ onDetectionComplete, isLoading, setIsLoading }) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [analysisTime, setAnalysisTime] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setIsLoading(true);
    setAnalysisTime(null);

    const startTime = Date.now();
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:5000/api/detect', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Detection failed (${response.status})`);
      const data = await response.json();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      setAnalysisTime(elapsed);
      onDetectionComplete(data, elapsed);
    } catch (err) {
      setError(
        err.message.includes('Failed to fetch')
          ? 'Cannot connect to server. Make sure Flask backend is running on port 5000.'
          : err.message
      );
      setIsLoading(false);
    }
  }, [onDetectionComplete, setIsLoading]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); };
  const handleClick = () => { if (!isLoading) fileInputRef.current?.click(); };
  const handleFileChange = (e) => { handleFile(e.target.files[0]); e.target.value = ''; };

  return (
    <main className="flex-grow flex flex-col w-full max-w-4xl mx-auto px-container-padding py-6 gap-section-gap">
      {/* Camera Viewfinder / Upload Area */}
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
        className="w-full aspect-[4/5] md:aspect-video"
      >
        <div
          className={`upload-zone relative w-full h-full cursor-pointer rounded-xl overflow-hidden ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

        {previewUrl ? (
          <img className="absolute inset-0 w-full h-full object-cover opacity-60" src={previewUrl} alt="Uploaded preview" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-ai-cyan/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-ai-cyan text-3xl">cloud_upload</span>
            </div>
            <div className="text-center">
              <p className="font-headline-lg-mobile text-lg text-on-surface mb-1">Drop image here or click to upload</p>
              <p className="font-label-mono text-label-mono text-on-surface-variant">Supports JPG, PNG, WebP</p>
            </div>
          </div>
        )}

        <div className="hud-overlay absolute inset-0 pointer-events-none" />

        {/* Scanning Animation */}
        {isLoading && <div className="scan-line" />}

        {/* Reticle */}
        {previewUrl && (
          <div className="absolute inset-0 border-[1px] border-dashed border-ai-cyan/30 pointer-events-none m-8 rounded-lg flex items-center justify-center">
            <div className="w-12 h-12 border-2 border-ai-cyan rounded-full opacity-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-ai-cyan text-sm">target</span>
            </div>
          </div>
        )}

        {/* YOLOv8 Badge */}
        <div className="absolute top-4 right-4 glass-panel px-3 py-1.5 rounded flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-ai-cyan animate-pulse' : 'bg-asphalt-gray'}`} />
          <span className="font-label-mono text-label-mono text-ai-cyan uppercase text-xs tracking-wider">YOLOv8 Powered</span>
        </div>

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-deep-navy/60 flex flex-col items-center justify-center z-20">
              <div className="w-12 h-12 border-3 border-asphalt-gray border-t-ai-cyan rounded-full animate-spin mb-4" />
              <span className="font-label-mono text-label-mono text-ai-cyan uppercase tracking-wider">Analyzing...</span>
            </div>
          )}
        </div>
      </BorderGlow>

      {/* Primary Action */}
      <section className="flex flex-col gap-4 items-center">
        <button
          onClick={handleClick}
          disabled={isLoading}
          className="w-full md:w-auto min-w-[280px] bg-gradient-to-r from-primary-container to-primary text-on-primary font-headline-lg-mobile text-headline-lg-mobile rounded-lg py-4 px-8 shadow-[0_4px_14px_rgba(240,137,34,0.3)] hover:shadow-[0_6px_20px_rgba(240,137,34,0.5)] transition-all active:scale-95 duration-150 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <span className="material-symbols-outlined">{isLoading ? 'hourglass_top' : 'radar'}</span>
          {isLoading ? 'Analyzing...' : 'Upload & Analyze'}
        </button>
        <p className="font-label-mono text-label-mono text-on-surface-variant text-center opacity-70">
          Upload a road image to detect potholes and road hazards.
        </p>
      </section>

      {/* Error */}
      {error && (
        <div className="bg-error-container/20 border border-error rounded-lg p-4 text-error text-sm text-center fade-in">
          ⚠️ {error}
        </div>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-card border border-asphalt-gray rounded-xl p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">speed</span>
            <span className="font-label-mono text-xs uppercase tracking-wider">Latency</span>
          </div>
          <div className="font-data-metric text-data-metric text-primary">
            {analysisTime || '—'}<span className="text-sm text-on-surface-variant ml-1">s</span>
          </div>
        </div>
        <div className="bg-surface-card border border-asphalt-gray rounded-xl p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">verified</span>
            <span className="font-label-mono text-xs uppercase tracking-wider">Model</span>
          </div>
          <div className="font-data-metric text-[16px] leading-[24px] font-bold text-on-surface">YOLOv8</div>
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
          <div className="font-data-metric text-data-metric text-ai-cyan">Ready</div>
        </div>
      </section>
    </main>
  );
}
