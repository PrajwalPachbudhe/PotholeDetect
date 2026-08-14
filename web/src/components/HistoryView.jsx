export default function HistoryView({ history }) {
  const totalDetections = history.reduce((sum, item) => sum + item.total_detections, 0);

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-container-padding py-section-gap flex flex-col gap-6 pb-[100px] md:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-stack-gap md:flex-row md:items-center justify-between fade-in">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-background">Scan History</h2>
      </div>

      {/* Metric Summary */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 fade-in">
        <div className="bg-surface-card border border-asphalt-gray rounded-lg p-3 md:p-4 flex flex-col gap-1">
          <span className="font-label-mono text-[10px] md:text-[12px] text-on-surface-variant uppercase">Total Scans</span>
          <span className="font-data-metric text-data-metric text-on-background">{history.length}</span>
        </div>
        <div className="bg-surface-card border border-asphalt-gray rounded-lg p-3 md:p-4 flex flex-col gap-1">
          <span className="font-label-mono text-[10px] md:text-[12px] text-on-surface-variant uppercase">Hazards Found</span>
          <span className="font-data-metric text-data-metric text-warning-amber">{totalDetections}</span>
        </div>
        <div className="bg-surface-card border border-asphalt-gray rounded-lg p-3 md:p-4 flex flex-col gap-1">
          <span className="font-label-mono text-[10px] md:text-[12px] text-on-surface-variant uppercase">Avg Time</span>
          <span className="font-data-metric text-data-metric text-ai-cyan">
            {history.length > 0
              ? (history.reduce((sum, h) => sum + parseFloat(h.analysisTime || 0), 0) / history.length).toFixed(1)
              : '—'}
            <span className="text-xs text-on-surface-variant ml-0.5">s</span>
          </span>
        </div>
      </div>

      {/* History List */}
      <div className="flex flex-col gap-2">
        {history.length === 0 ? (
          <div className="bg-surface-card border border-asphalt-gray rounded-lg p-8 text-center fade-in">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">history</span>
            <p className="font-body-md text-on-surface-variant">No scans yet. Upload an image to get started!</p>
          </div>
        ) : (
          history.map((item, i) => {
            const getSeverity = (count) => {
              if (count >= 3) return { label: 'Critical', color: 'danger-orange' };
              if (count >= 1) return { label: 'Moderate', color: 'warning-amber' };
              return { label: 'Safe', color: 'ai-cyan' };
            };
            const sev = getSeverity(item.total_detections);

            return (
              <div key={i} className="bg-surface-card border border-asphalt-gray hover:border-primary group rounded-lg p-3 flex items-center gap-4 cursor-pointer transition-all slide-up">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-md overflow-hidden flex-shrink-0 bg-surface-variant relative">
                  <img
                    className="w-full h-full object-cover"
                    src={`data:image/jpeg;base64,${item.annotated}`}
                    alt={`Scan ${i + 1}`}
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-sm md:text-base text-on-background truncate">
                      Scan #{history.length - i}
                    </h3>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-${sev.color}/20 text-${sev.color} border border-${sev.color}/50 uppercase tracking-wider`}>
                      {sev.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-on-surface-variant font-label-mono">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {item.timestamp}
                    </span>
                    <span className={`flex items-center gap-1 text-${sev.color}`}>
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      {item.total_detections} Detection{item.total_detections !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
