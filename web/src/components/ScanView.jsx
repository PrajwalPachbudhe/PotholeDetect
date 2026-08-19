import { useState } from 'react';
import BorderGlow from './BorderGlow';

export default function ScanView({ onDetectionComplete, isLoading, setIsLoading }) {
  const [streamError, setStreamError] = useState(false);

  return (
    <main className="flex-grow flex flex-col w-full max-w-4xl mx-auto px-container-padding py-6 gap-section-gap">
      <div className="flex flex-col items-center gap-4 mb-4">
        <h2 className="text-2xl font-headline-lg-mobile text-on-surface">Live Pothole Detection</h2>
        <p className="text-on-surface-variant text-center max-w-2xl">
          Real-time video feed powered by your local YOLOv8 model. Make sure your Python backend is running.
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
        <div className="w-full h-full flex items-center justify-center bg-black">
          {!streamError ? (
            <img 
              src="http://localhost:5000/video_feed" 
              alt="Live Detection Stream" 
              className="w-full h-full object-contain"
              onError={() => setStreamError(true)}
            />
          ) : (
            <div className="flex flex-col items-center text-center p-6 gap-4">
              <span className="material-symbols-outlined text-error text-5xl">videocam_off</span>
              <p className="text-error font-bold">Cannot connect to the video stream.</p>
              <p className="text-on-surface-variant text-sm">Please ensure that `server.py` is running on your machine.</p>
              <button 
                className="mt-4 px-6 py-2 bg-surface-card border border-asphalt-gray rounded-full hover:bg-asphalt-gray transition-colors"
                onClick={() => setStreamError(false)}
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
          <div className="font-data-metric text-[16px] leading-[24px] font-bold text-on-surface">YOLOv8 PyTorch</div>
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
          <div className="font-data-metric text-data-metric text-ai-cyan">
            {streamError ? 'Disconnected' : 'Connected'}
          </div>
        </div>
      </section>
    </main>
  );
}
