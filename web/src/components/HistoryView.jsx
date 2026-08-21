import { useState } from 'react';

export default function HistoryView({ history = [], onInspectItem, onClearHistory, showToast }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'critical' | 'moderate' | 'safe'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalItem, setActiveModalItem] = useState(null);

  const totalDetections = history.reduce((sum, item) => sum + (item.total_detections || 0), 0);

  const getSeverity = (count) => {
    if (count >= 3) return { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
    if (count >= 1) return { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' };
    return { label: 'Safe', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' };
  };

  const filteredHistory = history.filter((item) => {
    const sev = (item.total_detections || 0) >= 3 ? 'critical' : (item.total_detections || 0) >= 1 ? 'moderate' : 'safe';
    if (filter !== 'all' && sev !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTimestamp = item.timestamp?.toLowerCase().includes(q);
      const matchDetections = item.detections?.some(d => (d.name || d.class || '').toLowerCase().includes(q));
      return matchTimestamp || matchDetections;
    }
    return true;
  });

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-2xl">history</span>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100 font-heading">
              Road Hazard Audit Log
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Persistent archive of captured scans, timestamps, and AI inference metadata
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear your local scan history?')) {
                onClearHistory?.();
                showToast?.('History cleared', 'info');
              }
            }}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            Clear Log
          </button>
        )}
      </div>

      {/* Metric Summary Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Scans Recorded</span>
          <span className="text-3xl font-extrabold text-slate-100 font-heading mt-2">{history.length}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Identified Hazards</span>
          <span className="text-3xl font-extrabold text-amber-400 font-heading mt-2">{totalDetections}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Average Processing Time</span>
          <span className="text-3xl font-extrabold text-cyan-400 font-heading mt-2">
            {history.length > 0
              ? (history.reduce((sum, h) => sum + parseFloat(h.analysisTime || 0.1), 0) / history.length).toFixed(2)
              : '0.00'}s
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['all', 'critical', 'moderate', 'safe'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === s
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search by date or class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none transition-colors"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
            search
          </span>
        </div>
      </div>

      {/* History Grid / List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
            <span className="material-symbols-outlined text-3xl">inbox</span>
          </div>
          <h3 className="text-base font-bold text-slate-300">No Audits Match Criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            {history.length === 0
              ? 'Perform your first AI road scan to start logging road quality data.'
              : 'Try changing your search filter to see other scan results.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHistory.map((item, idx) => {
            const sev = getSeverity(item.total_detections || 0);
            return (
              <div
                key={idx}
                onClick={() => setActiveModalItem(item)}
                className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 flex gap-4 cursor-pointer transition-all group shadow-lg"
              >
                {/* Thumbnail */}
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-black flex-shrink-0 relative border border-slate-800">
                  <img
                    src={`data:image/jpeg;base64,${item.annotated}`}
                    alt={`Scan ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
                        Audit #{history.length - idx}
                      </h4>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">{item.timestamp}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${sev.bg} ${sev.color}`}>
                      {sev.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="material-symbols-outlined text-sm">warning</span>
                      {item.total_detections} hazard{item.total_detections === 1 ? '' : 's'}
                    </span>
                    <span className="text-[11px] text-slate-500">{item.analysisTime || '0.12'}s</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Inspection Modal */}
      {activeModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveModalItem(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#111827] border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100 font-heading">
                  Audit Snapshot Details
                </h3>
                <span className="text-xs font-mono text-slate-400">{activeModalItem.timestamp}</span>
              </div>
              <button
                onClick={() => setActiveModalItem(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video relative">
              <img
                src={`data:image/jpeg;base64,${activeModalItem.annotated}`}
                alt="Audit annotated capture"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Detections</span>
                <span className="text-xl font-bold text-amber-400">{activeModalItem.total_detections}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Analysis Time</span>
                <span className="text-xl font-bold text-cyan-400">{activeModalItem.analysisTime}s</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Dimensions</span>
                <span className="text-sm font-bold text-slate-200 mt-1">
                  {activeModalItem.image_size?.width}x{activeModalItem.image_size?.height}px
                </span>
              </div>
            </div>

            {activeModalItem.detections && activeModalItem.detections.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Object Coordinate Breakdown
                </span>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                  {activeModalItem.detections.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-950 rounded-lg text-xs font-mono">
                      <span className="text-amber-400 font-bold uppercase">{d.name || d.class || 'Pothole'}</span>
                      <span className="text-slate-400">Conf: {d.confidence}%</span>
                      {d.bbox && <span className="text-slate-500">[{d.bbox.x1},{d.bbox.y1},{d.bbox.x2},{d.bbox.y2}]</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setActiveModalItem(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors mt-2"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
