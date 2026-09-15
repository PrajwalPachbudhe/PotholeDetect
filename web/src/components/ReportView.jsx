import { useState, useMemo } from 'react';
import { groupHistoryByLocation } from '../utils/clusterHazards';

export default function ReportView({ history = [], hazards = [], user, onNavigateToMap, showToast }) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [inspectorName, setInspectorName] = useState(user?.name || 'Civil Road Inspector');
  const [agencyName, setAgencyName] = useState('Department of Transportation & Municipal Infrastructure');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState(null);
  const [reportId] = useState(() => `AUD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [generatedDate] = useState(() => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }));

  // Group items by location
  const clusteredRecords = useMemo(() => {
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
  const safeClusters = filteredClusters.filter((c) => c.severity === 'safe').length;
  const totalPhotos = filteredClusters.reduce((sum, c) => sum + (c.photos?.length || 1), 0);

  // Road Health Score calculation (0 - 100)
  const roadHealthScore = Math.max(
    25,
    Math.min(99, 100 - (criticalClusters * 8 + moderateClusters * 3))
  );

  const getHealthBadge = (score) => {
    if (score >= 80) return { label: 'Optimal Condition', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (score >= 60) return { label: 'Moderate Deterioration', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { label: 'Critical Structural Hazard', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
  };

  const healthBadge = getHealthBadge(roadHealthScore);

  // Export CSV Work Order
  const handleExportCSV = () => {
    try {
      const headers = [
        'Item #',
        'Work Order ID',
        'Road Name / Location',
        'Latitude',
        'Longitude',
        'Potholes Count',
        'Severity Level',
        'Confidence Rate',
        'Last Inspected',
        'Engineering Action',
        'Status'
      ];
      const rows = filteredClusters.map((c, i) => [
        i + 1,
        `"WO-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}"`,
        `"${(c.address || 'Road Corridor').replace(/"/g, '""')}"`,
        c.lat != null ? c.lat.toFixed(5) : 'N/A',
        c.lng != null ? c.lng.toFixed(5) : 'N/A',
        c.pothole_count || 1,
        c.severity ? c.severity.toUpperCase() : 'MODERATE',
        `"${c.photos?.[0]?.confidence || '92%'}"`,
        `"${c.lastSeen || c.timestamp || 'Recent'}"`,
        c.severity === 'critical'
          ? '"Emergency Asphalt Resurfacing & Deep Patching"'
          : '"Standard Bituminous Crack Sealing & Leveling"',
        '"PENDING DISPATCH"'
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Pothole_Engineering_Work_Orders_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast?.('Official CSV Work Order exported successfully!', 'success');
    } catch (err) {
      showToast?.('Failed to export CSV', 'error');
    }
  };

  // Export JSON Audit Log
  const handleExportJSON = () => {
    try {
      const reportData = {
        report_id: reportId,
        generated_at: new Date().toISOString(),
        inspector: inspectorName,
        authority: agencyName,
        road_condition_index: roadHealthScore,
        summary: {
          total_clusters: filteredClusters.length,
          total_potholes: totalPotholes,
          critical_hazards: criticalClusters,
          moderate_hazards: moderateClusters,
          safe_inspections: safeClusters,
          total_evidence_photos: totalPhotos,
        },
        work_orders: filteredClusters.map((c, i) => ({
          work_order_id: `WO-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
          location: c.address || 'Road Corridor',
          coordinates: { lat: c.lat, lng: c.lng },
          pothole_count: c.pothole_count || 1,
          severity: c.severity || 'moderate',
          detected_at: c.lastSeen || c.timestamp || 'Recent',
          recommended_action: c.severity === 'critical'
            ? 'Emergency Asphalt Resurfacing & Deep Patching'
            : 'Standard Bituminous Crack Sealing & Leveling',
          photos_count: c.photos?.length || 1,
        })),
        defect_clusters: filteredClusters,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `Pothole_Audit_Data_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast?.('JSON Engineering log exported successfully!', 'success');
    } catch (err) {
      showToast?.('Failed to export JSON', 'error');
    }
  };

  // Print PDF
  const handlePrintPDF = () => {
    showToast?.('Opening print dialog for official report PDF...', 'info');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300 print:p-0 print:m-0 print:max-w-full">
      {/* Top Action & Control Header (Hidden in Print) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-xl shadow-xl print:hidden">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex-shrink-0">
            <span className="material-symbols-outlined text-2xl">assignment</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-100 font-heading">
                Municipal Road Defect & Hazard Report
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase">
                Official Audit
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400">
              Civil engineering inspection summary, defect work orders, and photographic evidence.
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
            Export CSV Work Orders
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono uppercase tracking-wider pl-1">Severity Filter:</span>
          {['all', 'critical', 'moderate'].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                severityFilter === s
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-mono">Inspector:</span>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-1 text-xs text-slate-200 outline-none w-40 font-mono"
              placeholder="Inspector Name"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-mono">Agency:</span>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-1 text-xs text-slate-200 outline-none w-48 font-mono"
              placeholder="Department / Agency"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINTABLE OFFICIAL REPORT DOCUMENT CONTAINER                              */}
      {/* ========================================================================= */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black print:p-0">
        
        {/* Official Header Block */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-slate-800 pb-6 print:border-black">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-2xl print:border-black print:text-black print:bg-transparent">
              <span className="material-symbols-outlined text-3xl">verified</span>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-100 font-heading uppercase tracking-wide print:text-black">
                MUNICIPAL ROAD DEFECT & HAZARD AUDIT
              </h2>
              <p className="text-xs font-mono text-slate-300 font-medium mt-0.5 print:text-black">
                Department: <span className="text-amber-300 font-bold print:text-black">{agencyName}</span>
              </p>
              <p className="text-xs font-mono text-slate-400 print:text-gray-700">
                Lead Inspector: <span className="text-slate-200 font-semibold print:text-black">{inspectorName}</span>
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right font-mono text-xs text-slate-300 bg-slate-900/80 border border-slate-800 p-3 rounded-xl print:bg-transparent print:border-none print:p-0 print:text-black">
            <p className="font-bold text-amber-400 print:text-black">Report Ref: {reportId}</p>
            <p className="text-slate-400 print:text-gray-700">Generated: {generatedDate}</p>
            <p className="text-slate-400 print:text-gray-700">Detection Engine: YOLOv8 Deep Learning</p>
          </div>
        </div>

        {/* Executive Scorecard Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between print:border-gray-400 print:bg-gray-50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-700">
              Road Health Index
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-100 font-heading print:text-black">
                {roadHealthScore}
              </span>
              <span className="text-xs font-mono text-slate-400 print:text-gray-700">/ 100</span>
            </div>
            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full mt-2 inline-block border ${healthBadge.bg} ${healthBadge.color} print:border-black print:text-black print:bg-transparent`}>
              {healthBadge.label}
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between print:border-gray-400 print:bg-gray-50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-700">
              Total Defect Clusters
            </span>
            <span className="text-3xl font-black text-cyan-400 font-heading mt-1 print:text-black">
              {filteredClusters.length}
            </span>
            <span className="text-[10px] font-mono text-slate-400 print:text-gray-700">
              Surveyed Road Segments
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between print:border-gray-400 print:bg-gray-50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-700">
              Total Potholes Detected
            </span>
            <span className="text-3xl font-black text-amber-400 font-heading mt-1 print:text-black">
              {totalPotholes}
            </span>
            <span className="text-[10px] font-mono text-slate-400 print:text-gray-700">
              {criticalClusters} Critical • {moderateClusters} Moderate
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between print:border-gray-400 print:bg-gray-50">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-700">
              Photo Evidence Matrix
            </span>
            <span className="text-3xl font-black text-emerald-400 font-heading mt-1 print:text-black">
              {totalPhotos}
            </span>
            <span className="text-[10px] font-mono text-slate-400 print:text-gray-700">
              Geotagged Visual Captures
            </span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* SECTION 1: STRUCTURED DEFECT WORK ORDERS & ACTION TABLE               */}
        {/* ===================================================================== */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 print:border-black">
            <h3 className="text-base font-bold text-slate-100 font-heading flex items-center gap-2 print:text-black">
              <span className="material-symbols-outlined text-amber-400 print:text-black">engineering</span>
              Defect Work Orders & Remediation Schedule
            </h3>
            <span className="text-xs font-mono text-slate-400 print:text-gray-700">
              {filteredClusters.length} Action Items
            </span>
          </div>

          {filteredClusters.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
              No road hazards match this filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-gray-400">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 font-mono text-[10px] uppercase border-b border-slate-800 print:bg-gray-200 print:text-black print:border-gray-400">
                    <th className="py-2.5 px-3 font-bold">#</th>
                    <th className="py-2.5 px-3 font-bold">Work Order ID</th>
                    <th className="py-2.5 px-3 font-bold">Location / Street</th>
                    <th className="py-2.5 px-3 font-bold">GPS Coordinates</th>
                    <th className="py-2.5 px-3 font-bold text-center">Potholes</th>
                    <th className="py-2.5 px-3 font-bold">Severity</th>
                    <th className="py-2.5 px-3 font-bold">Recommended Engineering Action</th>
                    <th className="py-2.5 px-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-body print:divide-gray-300">
                  {filteredClusters.map((cluster, idx) => {
                    const isCritical = cluster.severity === 'critical';
                    const woId = `WO-${new Date().getFullYear()}-${String(idx + 1).padStart(3, '0')}`;
                    const coords = cluster.lat != null && cluster.lng != null
                      ? `${cluster.lat.toFixed(4)}°, ${cluster.lng.toFixed(4)}°`
                      : 'N/A';

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors print:hover:bg-transparent">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-400 print:text-black">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400 print:text-black">{woId}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-200 max-w-[200px] truncate print:text-black print:max-w-none">
                          📍 {cluster.address || 'Road Segment'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 print:text-black">{coords}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-center text-slate-200 print:text-black">
                          {cluster.pothole_count || cluster.total_detections || 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              isCritical
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            } print:border-black print:text-black print:bg-transparent`}
                          >
                            {cluster.severity || 'Moderate'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[11px] text-slate-300 print:text-black">
                          {isCritical
                            ? '⚡ High Priority: Emergency Cold Patch & Resurfacing'
                            : '🔧 Standard: Bituminous Crack Sealing & Leveling'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 print:border-black print:text-black print:bg-transparent">
                            PENDING
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* SECTION 2: GEOGRAPHIC DEFECT CLUSTERS & PHOTO EVIDENCE                */}
        {/* ===================================================================== */}
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 print:border-black">
            <h3 className="text-base font-bold text-slate-100 font-heading flex items-center gap-2 print:text-black">
              <span className="material-symbols-outlined text-amber-400 print:text-black">photo_camera</span>
              Geotagged Photographic Evidence Appendix
            </h3>
            <span className="text-xs font-mono text-slate-400 print:text-gray-700">
              Grouped Proximity Clusters (~45m Radius)
            </span>
          </div>

          {filteredClusters.length > 0 && (
            <div className="flex flex-col gap-4">
              {filteredClusters.map((cluster, idx) => {
                const photos = cluster.photos || [];
                const isCritical = cluster.severity === 'critical';

                return (
                  <div
                    key={idx}
                    className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 md:p-5 flex flex-col gap-3 print:border-gray-400 print:bg-white print:page-break-inside-avoid"
                  >
                    {/* Cluster Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono font-bold print:border print:border-gray-400 print:text-black">
                            Segment #{idx + 1}
                          </span>
                          <h4 className="text-sm md:text-base font-bold text-slate-100 print:text-black">
                            📍 {cluster.address || 'Road Corridor Corridor'}
                          </h4>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mt-0.5 print:text-gray-700">
                          Coordinates: {cluster.lat != null ? cluster.lat.toFixed(5) : 'N/A'}°N, {cluster.lng != null ? cluster.lng.toFixed(5) : 'N/A'}°W • Recorded: {cluster.lastSeen || cluster.timestamp || 'Recent'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Pothole Count Pill */}
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold flex items-center gap-1 print:border-black print:text-black">
                          <span className="material-symbols-outlined text-sm">warning</span>
                          {cluster.pothole_count} Pothole{cluster.pothole_count === 1 ? '' : 's'}
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
                        <span className="material-symbols-outlined text-xs">camera</span>
                        Visual Defect Captures ({photos.length} item{photos.length === 1 ? '' : 's'}):
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
                    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono print:border-gray-400 print:bg-gray-50">
                      <span className="text-slate-400 print:text-gray-700">
                        Recommended Action:
                      </span>
                      <span className={`font-bold ${isCritical ? 'text-red-400' : 'text-amber-400'} print:text-black`}>
                        {isCritical
                          ? '⚡ High Priority: Emergency Asphalt Resurfacing & Deep Patching'
                          : '🔧 Standard Priority: Routine Bituminous Crack Sealing & Leveling'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* SECTION 3: MUNICIPAL SIGN-OFF & CERTIFICATION BLOCK                   */}
        {/* ===================================================================== */}
        <div className="border-t-2 border-slate-800 pt-6 mt-4 flex flex-col sm:flex-row items-center justify-between gap-6 font-mono text-xs text-slate-300 print:border-black print:text-black print:mt-8">
          <div className="w-full sm:w-1/2 flex flex-col gap-2">
            <p className="font-bold text-slate-200 print:text-black">FIELD INSPECTION CERTIFICATION</p>
            <div className="border-b border-slate-700 w-48 mt-4 print:border-black" />
            <p className="text-[11px] text-slate-400 print:text-gray-700">
              Inspector: <strong className="text-slate-200 print:text-black">{inspectorName}</strong>
            </p>
            <p className="text-[10px] text-slate-500 print:text-gray-600">Certified Road Safety Inspector</p>
          </div>

          <div className="w-full sm:w-1/2 flex flex-col sm:items-end gap-2 text-left sm:text-right">
            <p className="font-bold text-slate-200 print:text-black">MUNICIPAL ENGINEERING APPROVAL</p>
            <div className="border-b border-slate-700 w-48 mt-4 print:border-black" />
            <p className="text-[11px] text-slate-400 print:text-gray-700">
              Civil Works Supervisor Sign-off
            </p>
            <p className="text-[10px] text-slate-500 print:text-gray-600">PotholeDetect AI Road Infrastructure Framework</p>
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
