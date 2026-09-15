import { useState, useMemo } from 'react';
import { groupHistoryByLocation } from '../utils/clusterHazards';

export default function ReportView({ history = [], hazards = [], user, onNavigateToMap, showToast }) {
  const [timeRange, setTimeRange] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [inspectorName, setInspectorName] = useState(user?.name || 'Road Safety Inspector');
  const [agencyName, setAgencyName] = useState('Department of Transportation & Municipal Infrastructure');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState(null);

  // Group history items by location (within 45 meters)
  const clusteredRecords = useMemo(() => {
    // Combine history items with hazards list if history is empty
    const sourceItems = history.length > 0 ? history : hazards;
    return groupHistoryByLocation(sourceItems, 45);
  }, [history, hazards]);

  // Apply filters
  const filteredClusters = useMemo(() => {
    return clusteredRecords.filter((cluster) => {
      if (severityFilter !== 'all' && cluster.severity !== severityFilter) return false;
      return true;
    });
  }, [clusteredRecords, severityFilter]);

  // Aggregate statistics
  const totalPotholes = filteredClusters.reduce((sum, c) => sum + (c.pothole_count || c.total_detections || 0), 0);
  const criticalClusters = filteredClusters.filter((c) => c.severity === 'critical').length;
  const moderateClusters = filteredClusters.filter((c) => c.severity === 'moderate').length;
  const totalPhotos = filteredClusters.reduce((sum, c) => sum + (c.photos?.length || 1), 0);

  // Road Health Score calculation (0 - 100)
  const roadHealthScore = Math.max(
    30,
    Math.min(98, 100 - (criticalClusters * 7 + moderateClusters * 3))
  );

  const getHealthBadge = (score) => {
    if (score >= 80) return { label: 'Good / Optimal', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (score >= 60) return { label: 'Moderate Deterioration', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { label: 'Critical / High Hazard', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
  };

  const healthBadge = getHealthBadge(roadHealthScore);

  // Export CSV Work Order
  const handleExportCSV = () => {
    try {
      const headers = ['Cluster ID', 'Road Address / Title', 'Latitude', 'Longitude', 'Pothole Count', 'Severity', 'Photo Evidence Count', 'Timestamp', 'Recommended Action'];
      const rows = filteredClusters.map((c, i) => [
        `CLU-${i + 1}`,
        `"${(c.address || 'Road Section').replace(/"/g, '""')}"`,
        c.lat?.toFixed(5) || '',
        c.lng?.toFixed(5) || '',
        c.pothole_count || 1,
        c.severity?.toUpperCase() || 'MODERATE',
        c.photos?.length || 1,
        `"${c.timestamp || 'Recent'}"`,
        c.severity === 'critical' ? '"Emergency Cold Patch / Resurfacing Required"' : '"Standard Routine Maintenance Patch"'
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Pothole_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast?.('CSV Work Order exported successfully!', 'success');
    } catch (err) {
      showToast?.('Failed to export CSV', 'error');
    }
  };

  // Export JSON Audit Log
  const handleExportJSON = () => {
    try {
      const reportData = {
        report_id: `RPT-${Date.now()}`,
        generated_at: new Date().toISOString(),
        inspector: inspectorName,
        agency: agencyName,
        road_condition_index: roadHealthScore,
        summary: {
          total_clusters: filteredClusters.length,
          total_potholes: totalPotholes,
          critical_hazards: criticalClusters,
          moderate_hazards: moderateClusters,
          total_photos_captured: totalPhotos,
        },
        defect_clusters: filteredClusters,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `Pothole_Audit_Data_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast?.('JSON Audit log exported successfully!', 'success');
    } catch (err) {
      showToast?.('Failed to export JSON', 'error');
    }
  };

  // Print PDF
  const handlePrintPDF = () => {
    showToast?.('Preparing printable report...', 'info');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300 print:p-0 print:m-0 print:max-w-full">
      {/* Top Action & Control Header (Hidden in Print) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-xl print:hidden">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex-shrink-0">
            <span className="material-symbols-outlined text-2xl">description</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-100 font-heading">
                Road Defect & Hazard Assessment Report
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase">
                Official Audit
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400">
              Aggregated area defect clusters, count metrics, photographic evidence, and work orders
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-emerald-400">table_view</span>
            Export CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-cyan-400">data_object</span>
            Export JSON
          </button>
          <button
            onClick={handlePrintPDF}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Filter / Customization Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono uppercase tracking-wider pl-2">Filter Severity:</span>
          {['all', 'critical', 'moderate', 'safe'].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                severityFilter === s
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-mono uppercase">Inspector:</span>
          <input
            type="text"
            value={inspectorName}
            onChange={(e) => setInspectorName(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-1 text-xs text-slate-200 outline-none w-48 font-mono"
            placeholder="Inspector Name"
          />
        </div>
      </div>

      {/* Printable Official Report Document Container */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black print:p-2">
        {/* Official Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b border-slate-800 pb-6 print:border-black">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-2xl print:text-black">
                shield
              </span>
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-100 font-heading print:text-black">
                CIVIL INFRASTRUCTURE AUDIT REPORT
              </h2>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1 print:text-gray-700">
              Department: <span className="text-slate-200 font-semibold print:text-black">{agencyName}</span>
            </p>
            <p className="text-xs font-mono text-slate-400 print:text-gray-700">
              Lead Officer: <span className="text-slate-200 font-semibold print:text-black">{inspectorName}</span>
            </p>
          </div>

          <div className="text-left sm:text-right font-mono text-xs text-slate-400 print:text-gray-700">
            <p className="font-bold text-slate-200 print:text-black">Report Ref: AUD-{new Date().getFullYear()}-{Math.floor(1000 + Math.random() * 9000)}</p>
            <p>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>Analysis Engine: YOLOv8 Object Detection</p>
          </div>
        </div>

        {/* Executive Scorecard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between print:border-gray-300 print:bg-gray-50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-600">
              Road Health Index
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-100 font-heading print:text-black">
                {roadHealthScore}
              </span>
              <span className="text-xs font-mono text-slate-400 print:text-gray-600">/ 100</span>
            </div>
            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full mt-2 inline-block border ${healthBadge.bg} ${healthBadge.color} print:border-black print:text-black`}>
              {healthBadge.label}
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between print:border-gray-300 print:bg-gray-50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-600">
              Total Defect Clusters
            </span>
            <span className="text-3xl font-extrabold text-cyan-400 font-heading mt-1 print:text-black">
              {filteredClusters.length}
            </span>
            <span className="text-[10px] font-mono text-slate-400 print:text-gray-600">
              Geotagged Road Segments
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between print:border-gray-300 print:bg-gray-50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-600">
              Total Potholes
            </span>
            <span className="text-3xl font-extrabold text-amber-400 font-heading mt-1 print:text-black">
              {totalPotholes}
            </span>
            <span className="text-[10px] font-mono text-slate-400 print:text-gray-600">
              Identified Road Hazards
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between print:border-gray-300 print:bg-gray-50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-600">
              Photo Evidence
            </span>
            <span className="text-3xl font-extrabold text-emerald-400 font-heading mt-1 print:text-black">
              {totalPhotos}
            </span>
            <span className="text-[10px] font-mono text-slate-400 print:text-gray-600">
              Visual Captures Stored
            </span>
          </div>
        </div>

        {/* Grouped Area Breakdown & Photo Evidence Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 print:border-black">
            <h3 className="text-base font-bold text-slate-100 font-heading flex items-center gap-2 print:text-black">
              <span className="material-symbols-outlined text-amber-400 print:text-black">location_city</span>
              Geographic Defect Clusters & Photo Evidence
            </h3>
            <span className="text-xs font-mono text-slate-400 print:text-gray-600">
              Grouped by ~45m Proximity Radius
            </span>
          </div>

          {filteredClusters.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
              No road hazards found for this filter criteria.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredClusters.map((cluster, idx) => {
                const photos = cluster.photos || [];
                const isCritical = cluster.severity === 'critical';

                return (
                  <div
                    key={idx}
                    className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 md:p-5 flex flex-col gap-3 print:border-gray-300 print:bg-white print:page-break-inside-avoid"
                  >
                    {/* Cluster Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono font-bold print:border print:border-gray-400 print:text-black">
                            Cluster #{idx + 1}
                          </span>
                          <h4 className="text-sm md:text-base font-bold text-slate-100 print:text-black">
                            📍 {cluster.address || 'Road Segment Corridor'}
                          </h4>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mt-0.5 print:text-gray-600">
                          Coordinates: {cluster.lat?.toFixed(5)}°N, {cluster.lng?.toFixed(5)}°W • Last Detected: {cluster.lastSeen || cluster.timestamp}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Pothole Count Pill */}
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold flex items-center gap-1 print:border-black print:text-black">
                          <span className="material-symbols-outlined text-sm">warning</span>
                          {cluster.pothole_count} Pothole{cluster.pothole_count === 1 ? '' : 's'} in Area
                        </span>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border ${
                            isCritical
                              ? 'bg-red-500/15 border-red-500/30 text-red-400'
                              : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          } print:border-black print:text-black`}
                        >
                          {cluster.severity}
                        </span>

                        {onNavigateToMap && (
                          <button
                            onClick={onNavigateToMap}
                            className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold print:hidden"
                          >
                            <span className="material-symbols-outlined text-sm text-cyan-400">map</span>
                            View on Map
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Multi-Photo Evidence Gallery for this Cluster */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1 print:text-gray-700">
                        <span className="material-symbols-outlined text-xs">photo_camera</span>
                        Captured Photo Evidence ({photos.length} capture{photos.length === 1 ? '' : 's'}):
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {photos.map((photo, pIdx) => {
                          const imgSrc = photo.image?.startsWith('data:') || photo.image?.startsWith('http')
                            ? photo.image
                            : `data:image/jpeg;base64,${photo.image}`;

                          return (
                            <div
                              key={pIdx}
                              onClick={() => setSelectedPhotoModal(photo)}
                              className="group relative rounded-xl overflow-hidden bg-black border border-slate-800 hover:border-amber-500/60 aspect-video cursor-pointer transition-all print:border-gray-400"
                            >
                              <img
                                src={imgSrc}
                                alt={`Capture ${pIdx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-90" />
                              <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[9px] font-mono text-slate-300">
                                <span className="bg-black/60 px-1 rounded truncate">
                                  #{pIdx + 1} ({photo.confidence || '92%'})
                                </span>
                                <span className="material-symbols-outlined text-[12px] text-amber-400 print:hidden">
                                  zoom_in
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recommended Maintenance Action */}
                    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono print:border-gray-300 print:bg-gray-50">
                      <span className="text-slate-400 print:text-gray-700">
                        Recommended Action:
                      </span>
                      <span className={`font-bold ${isCritical ? 'text-red-400' : 'text-amber-400'} print:text-black`}>
                        {isCritical
                          ? '⚡ High Priority: Emergency Cold Patch / Structural Milling'
                          : '🔧 Standard Priority: Routine Asphalt Crack Sealing & Fill'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Municipal Sign-off Section (Print-friendly) */}
        <div className="border-t border-slate-800 pt-6 mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-slate-400 print:border-black print:text-black">
          <div>
            <p>Verified by: ________________________ (Signature)</p>
            <p className="text-[11px] text-slate-500 mt-0.5 print:text-gray-600">Road Maintenance Supervisor</p>
          </div>
          <div className="text-left sm:text-right">
            <p>Work Order Execution Status: [ ] PENDING  [ ] IN PROGRESS  [ ] COMPLETED</p>
            <p className="text-[11px] text-slate-500 mt-0.5 print:text-gray-600">PotholeDetect AI Road Management System</p>
          </div>
        </div>
      </div>

      {/* Full Photo Inspector Modal */}
      {selectedPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 print:hidden"
          onClick={() => setSelectedPhotoModal(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#111827] border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100 font-heading">
                  High-Resolution Evidence Capture
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {selectedPhotoModal.timestamp} • Confidence: {selectedPhotoModal.confidence}
                </span>
              </div>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video relative">
              <img
                src={
                  selectedPhotoModal.image?.startsWith('data:') || selectedPhotoModal.image?.startsWith('http')
                    ? selectedPhotoModal.image
                    : `data:image/jpeg;base64,${selectedPhotoModal.image}`
                }
                alt="High-resolution road hazard"
                className="w-full h-full object-contain"
              />
            </div>

            {selectedPhotoModal.gps && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">
                    GPS Geotag Location
                  </span>
                  <p className="text-xs font-bold text-cyan-400 mt-0.5">
                    {selectedPhotoModal.gps.address ||
                      `${selectedPhotoModal.gps.lat?.toFixed(5)}°N, ${selectedPhotoModal.gps.lng?.toFixed(5)}°W`}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedPhotoModal(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              Close Photo Inspector
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
