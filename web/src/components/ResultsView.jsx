export default function ResultsView({ results, analysisTime, onBack, onSaveToHistory }) {
  if (!results) return null;

  const { annotated, detections, total_detections, image_size } = results;
  const avgConfidence = total_detections > 0
    ? (detections.reduce((sum, d) => sum + d.confidence, 0) / total_detections).toFixed(1)
    : 0;

  const getSeverity = (count) => {
    if (count >= 3) return { label: 'Critical', color: 'danger-orange' };
    if (count >= 1) return { label: 'Moderate', color: 'warning-amber' };
    return { label: 'Safe', color: 'ai-cyan' };
  };

  const severity = getSeverity(total_detections);

  return (
    <main className="flex-1 px-container-padding pt-6 flex flex-col gap-section-gap max-w-4xl mx-auto w-full pb-[100px] md:pb-6">
      {/* Status Header */}
      <section className="flex justify-between items-end fade-in">
        <div>
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Detection Complete</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Analysis finished in {analysisTime}s</p>
        </div>
        <div className={`bg-${severity.color}/20 border border-${severity.color} rounded-full px-3 py-1 flex items-center gap-1.5`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1", color: `var(--tw-${severity.color})` }}>
            {total_detections > 0 ? 'warning' : 'check_circle'}
          </span>
          <span className={`font-label-mono text-label-mono text-${severity.color} uppercase`}>
            {total_detections > 0 ? 'Hazard Found' : 'Safe'}
          </span>
        </div>
      </section>

      {/* Image with Bounding Boxes */}
      <section className="relative w-full rounded-xl overflow-hidden border border-asphalt-gray bg-surface-card slide-up">
        <img
          className="w-full h-auto object-contain"
          src={`data:image/jpeg;base64,${annotated}`}
          alt="Detection result"
        />
        <div className="absolute inset-0 bg-secondary/5 pointer-events-none" />
        <div className="ai-scan-line" />
      </section>

      {/* Metrics Card */}
      <section className="bg-surface-card rounded-xl border border-asphalt-gray p-4 flex flex-col gap-stack-gap slide-up">
        <h3 className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider mb-2">Analysis Data</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Severity */}
          <div className="flex flex-col gap-1">
            <span className="font-body-md text-sm text-on-surface-variant">Hazard Severity</span>
            <div className="flex items-center gap-2">
              <span className={`font-data-metric text-data-metric text-${severity.color}`}>{severity.label.toUpperCase()}</span>
              <div className="flex gap-1 h-3">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`w-2 rounded-sm ${i < Math.min(total_detections, 4) ? `bg-${severity.color}` : 'bg-surface-variant'}`} />
                ))}
              </div>
            </div>
          </div>
          {/* Confidence */}
          <div className="flex flex-col gap-1">
            <span className="font-body-md text-sm text-on-surface-variant">AI Confidence</span>
            <span className="font-data-metric text-data-metric text-primary">{avgConfidence}%</span>
          </div>
          {/* Image Info */}
          <div className="col-span-2 flex flex-col gap-1 mt-2 p-3 bg-background rounded-lg border border-surface-variant">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-on-surface-variant text-sm">straighten</span>
              <span className="font-body-md text-sm text-on-surface-variant">Image Dimensions</span>
            </div>
            <span className="font-data-metric text-data-metric text-inverse-surface">
              {image_size?.width} × {image_size?.height}px
            </span>
          </div>
        </div>
      </section>

      {/* Detections List */}
      {total_detections > 0 && (
        <section className="bg-surface-card rounded-xl border border-asphalt-gray p-4 flex flex-col gap-3 slide-up">
          <h3 className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
            Detections ({total_detections})
          </h3>
          {detections.map((det, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-background rounded-lg border border-surface-variant hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-danger-orange/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-danger-orange text-sm">crisis_alert</span>
                </div>
                <div>
                  <span className="font-data-metric text-sm text-on-surface">{det.class}</span>
                  <p className="font-label-mono text-[10px] text-on-surface-variant">
                    ({det.bbox.x1}, {det.bbox.y1}) → ({det.bbox.x2}, {det.bbox.y2})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-container to-primary rounded-full transition-all duration-1000"
                    style={{ width: `${det.confidence}%` }}
                  />
                </div>
                <span className="font-data-metric text-sm text-primary min-w-[40px] text-right">{det.confidence}%</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Actions */}
      <section className="flex flex-col gap-stack-gap pt-2 slide-up">
        <button
          onClick={() => {
            if (onSaveToHistory) onSaveToHistory(results, analysisTime);
          }}
          className="w-full bg-primary hover:bg-primary-container text-on-primary font-headline-lg-mobile text-lg font-bold py-4 rounded-xl transition-colors active:scale-95 duration-150 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(255,183,125,0.1)]"
        >
          <span className="material-symbols-outlined">save</span>
          Save to History
        </button>
        <button
          onClick={onBack}
          className="w-full bg-transparent border border-asphalt-gray hover:border-primary text-on-surface font-body-md text-body-md py-4 rounded-xl transition-colors active:scale-95 duration-150 flex justify-center items-center gap-2"
        >
          <span className="material-symbols-outlined">radar</span>
          New Scan
        </button>
      </section>
    </main>
  );
}
