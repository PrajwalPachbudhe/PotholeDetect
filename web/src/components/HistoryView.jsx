import { useState, useMemo } from 'react';
import { groupHistoryByLocation } from '../utils/clusterHazards';

export default function HistoryView({
  history = [],
  hazards = [],
  onInspectItem,
  onClearHistory,
  onNavigateToMap,
  onNavigateToReport,
  showToast,
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'critical' | 'moderate' | 'safe'
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'raw'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Group history items by location (within ~45m)
  const clusteredHistory = useMemo(() => {
    return groupHistoryByLocation(history, 45);
  }, [history]);

  const totalDetections = history.reduce((sum, item) => sum + (item.total_detections || 0), 0);

  const getSeverity = (count) => {
    if (count >= 3)
      return { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
    if (count >= 1)
      return { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' };
    return { label: 'Safe', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' };
  };

  // Filter for Grouped View
  const filteredClusters = useMemo(() => {
    return clusteredHistory.filter((cluster) => {
      const sev =
        (cluster.pothole_count || cluster.total_detections || 0) >= 3
          ? 'critical'
          : (cluster.pothole_count || cluster.total_detections || 0) >= 1
          ? 'moderate'
          : 'safe';
      if (filter !== 'all' && sev !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTimestamp = cluster.timestamp?.toLowerCase().includes(q);
        const matchAddress = cluster.address?.toLowerCase().includes(q);
        return matchTimestamp || matchAddress;
      }
      return true;
    });
  }, [clusteredHistory, filter, searchQuery]);

  // Filter for Raw Individual View
  const filteredRawHistory = useMemo(() => {
    return history.filter((item) => {
      const sev =
        (item.total_detections || 0) >= 3
          ? 'critical'
          : (item.total_detections || 0) >= 1
          ? 'moderate'
          : 'safe';
      if (filter !== 'all' && sev !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTimestamp = item.timestamp?.toLowerCase().includes(q);
        const matchAddress = item.gps?.address?.toLowerCase().includes(q);
        const matchDetections = item.detections?.some((d) =>
          (d.name || d.class || '').toLowerCase().includes(q)
        );
        return matchTimestamp || matchAddress || matchDetections;
      }
      return true;
    });
  }, [history, filter, searchQuery]);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-2xl">history</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-100 font-heading">
                Road Hazard Audit Log
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase">
                7-Day History
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Active detections linked to your user login • Auto-pruned after 7 days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Direct Report Generator Button */}
          {onNavigateToReport && (
            <button
              onClick={onNavigateToReport}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">description</span>
              Generate Report
            </button>
          )}

          {history.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear your local scan history?')) {
                  onClearHistory?.();
                  showToast?.('History cleared', 'info');
                }
              }}
              className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Clear Log
            </button>
          )}
        </div>
      </div>

      {/* Metric Summary Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Defect Area Clusters
          </span>
          <span className="text-3xl font-extrabold text-cyan-400 font-heading mt-2">
            {clusteredHistory.length}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Total Scans Recorded
          </span>
          <span className="text-3xl font-extrabold text-slate-100 font-heading mt-2">
            {history.length}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Total Identified Hazards
          </span>
          <span className="text-3xl font-extrabold text-amber-400 font-heading mt-2">
            {totalDetections}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Avg Processing Time
          </span>
          <span className="text-3xl font-extrabold text-emerald-400 font-heading mt-2">
            {history.length > 0
              ? (
                  history.reduce((sum, h) => sum + parseFloat(h.analysisTime || 0.1), 0) /
                  history.length
                ).toFixed(2)
              : '0.00'}
            s
          </span>
        </div>
      </div>

      {/* Filter & View Mode Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* View Mode Switcher: Grouped vs Raw */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex mr-2">
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'grouped'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">filter_center_focus</span>
              Grouped Areas
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'raw'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">list</span>
              Raw Scans
            </button>
          </div>

          {['all', 'critical', 'moderate', 'safe'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === s
                  ? 'bg-slate-800 text-amber-400 border border-amber-500/40 font-bold'
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
            placeholder="Search by date, street, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none transition-colors"
          />
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
            search
          </span>
        </div>
      </div>

      {/* History Content */}
      {viewMode === 'grouped' ? (
        // GROUPED AREA CLUSTERS VIEW
        filteredClusters.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
              <span className="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <h3 className="text-base font-bold text-slate-300">No Defect Clusters Match Criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {history.length === 0
                ? 'Perform your first AI road scan to start logging road quality data.'
                : 'Try adjusting your search filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredClusters.map((cluster, idx) => {
              const sev = getSeverity(cluster.pothole_count || cluster.total_detections || 0);
              const photos = cluster.photos || [];
              const primaryPhoto = photos[0];
              const primaryImgSrc = primaryPhoto?.image?.startsWith('data:') || primaryPhoto?.image?.startsWith('http')
                ? primaryPhoto?.image
                : `data:image/jpeg;base64,${primaryPhoto?.image}`;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveModalItem(cluster);
                    setSelectedPhotoIndex(0);
                  }}
                  className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all group shadow-lg"
                >
                  <div className="flex gap-4">
                    {/* Primary Thumbnail with Photo Count Badge */}
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-black flex-shrink-0 relative border border-slate-800">
                      <img
                        src={primaryImgSrc}
                        alt={`Cluster ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[9px] font-mono text-slate-200">
                        <span className="bg-black/70 px-1 rounded flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px] text-amber-400">photo_library</span>
                          {photos.length}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
                            {cluster.address || `Area Cluster #${idx + 1}`}
                          </h4>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            {cluster.lastSeen || cluster.timestamp}
                          </p>
                          <p className="text-[10px] font-mono text-cyan-400 truncate mt-0.5">
                            📍 {cluster.lat?.toFixed(4)}°N, {cluster.lng?.toFixed(4)}°W
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${sev.bg} ${sev.color} flex-shrink-0`}
                        >
                          {sev.label}
                        </span>
                      </div>

                      {/* Defect Count & Photos Strip */}
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <span className="material-symbols-outlined text-sm">warning</span>
                          {cluster.pothole_count} Pothole{cluster.pothole_count === 1 ? '' : 's'} in Area
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md">
                          {photos.length} capture{photos.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Photo Micro-Strip if more than 1 photo */}
                  {photos.length > 1 && (
                    <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                      <span className="text-[10px] font-mono text-slate-500 uppercase flex-shrink-0">Captures:</span>
                      {photos.slice(0, 5).map((p, pIdx) => {
                        const thumbSrc = p.image?.startsWith('data:') || p.image?.startsWith('http')
                          ? p.image
                          : `data:image/jpeg;base64,${p.image}`;
                        return (
                          <div
                            key={pIdx}
                            className="w-10 h-7 rounded-lg overflow-hidden bg-black border border-slate-800 flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
                          >
                            <img src={thumbSrc} alt="Thumb" className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                      {photos.length > 5 && (
                        <span className="text-[10px] font-mono text-amber-400">+{photos.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        // RAW SCANS VIEW
        filteredRawHistory.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
              <span className="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <h3 className="text-base font-bold text-slate-300">No Audits Match Criteria</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRawHistory.map((item, idx) => {
              const sev = getSeverity(item.total_detections || 0);
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveModalItem({
                      ...item,
                      photos: [{ ...item, image: item.annotated || item.original }],
                      pothole_count: item.total_detections || 1,
                    });
                    setSelectedPhotoIndex(0);
                  }}
                  className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 flex gap-4 cursor-pointer transition-all group shadow-lg"
                >
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-black flex-shrink-0 relative border border-slate-800">
                    <img
                      src={`data:image/jpeg;base64,${item.annotated || item.original}`}
                      alt={`Scan ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
                          Scan #{history.length - idx}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">{item.timestamp}</p>
                        {item.gps?.address && (
                          <p className="text-[10px] font-mono text-cyan-400 truncate mt-0.5">
                            📍 {item.gps.address}
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${sev.bg} ${sev.color} flex-shrink-0`}
                      >
                        {sev.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                      <span className="flex items-center gap-1 text-amber-400">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        {item.total_detections} hazard{item.total_detections === 1 ? '' : 's'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {item.analysisTime || '0.12'}s
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Cluster & Photo Inspection Modal */}
      {activeModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveModalItem(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#111827] border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100 font-heading">
                    {activeModalItem.address || 'Road Defect Cluster Inspector'}
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold">
                    {activeModalItem.pothole_count || activeModalItem.total_detections} Potholes
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {activeModalItem.lastSeen || activeModalItem.timestamp}
                </span>
              </div>
              <button
                onClick={() => setActiveModalItem(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Active Selected Photo Preview */}
            {activeModalItem.photos && activeModalItem.photos.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video relative">
                  <img
                    src={
                      activeModalItem.photos[selectedPhotoIndex]?.image?.startsWith('data:') ||
                      activeModalItem.photos[selectedPhotoIndex]?.image?.startsWith('http')
                        ? activeModalItem.photos[selectedPhotoIndex]?.image
                        : `data:image/jpeg;base64,${activeModalItem.photos[selectedPhotoIndex]?.image}`
                    }
                    alt="Active cluster capture"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-amber-400">
                    Photo {selectedPhotoIndex + 1} of {activeModalItem.photos.length}
                  </div>
                </div>

                {/* Photo Gallery Selector Strip */}
                {activeModalItem.photos.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {activeModalItem.photos.map((p, idx) => {
                      const thumb = p.image?.startsWith('data:') || p.image?.startsWith('http')
                        ? p.image
                        : `data:image/jpeg;base64,${p.image}`;
                      const isSel = idx === selectedPhotoIndex;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedPhotoIndex(idx)}
                          className={`w-16 h-12 rounded-xl overflow-hidden bg-black border cursor-pointer flex-shrink-0 transition-all ${
                            isSel ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={thumb} alt="Thumb" className="w-full h-full object-cover" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeModalItem.gps && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">
                    GPS Geotag Location
                  </span>
                  <p className="text-xs font-bold text-cyan-400 mt-0.5">
                    {activeModalItem.gps.address ||
                      `${activeModalItem.lat?.toFixed(5)}°N, ${activeModalItem.lng?.toFixed(5)}°W`}
                  </p>
                </div>
                {onNavigateToMap && (
                  <button
                    onClick={() => {
                      setActiveModalItem(null);
                      onNavigateToMap();
                    }}
                    className="px-3 py-1.5 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1 shadow"
                  >
                    <span className="material-symbols-outlined text-sm">map</span>
                    View on Map
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Potholes in Zone</span>
                <span className="text-xl font-bold text-amber-400">
                  {activeModalItem.pothole_count || activeModalItem.total_detections}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Photos Stored</span>
                <span className="text-xl font-bold text-cyan-400">
                  {activeModalItem.photos?.length || 1}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Severity</span>
                <span className="text-sm font-bold text-slate-200 mt-1 uppercase">
                  {activeModalItem.severity}
                </span>
              </div>
            </div>

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
