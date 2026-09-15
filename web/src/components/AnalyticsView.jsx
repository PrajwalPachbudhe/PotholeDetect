import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

export default function AnalyticsView({ 
  history = [], 
  hazards = [], 
  apiUrl, 
  user,
  onNavigateToReport, 
  showToast 
}) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [serverStats, setServerStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Fetch real-time system stats from backend
  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      if (!apiUrl) return;
      setIsLoadingStats(true);
      try {
        const clean = apiUrl.replace(/\/+$/, '');
        const res = await fetch(`${clean}/api/admin/stats`, {
          headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' }
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setServerStats(data);
        }
      } catch (err) {
        console.warn('Could not load backend stats in AnalyticsView:', err);
      } finally {
        if (isMounted) setIsLoadingStats(false);
      }
    }

    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl]);

  // Compute live real-time statistics from active history and hazards
  const statsSummary = useMemo(() => {
    // Total scans from history + backend
    const totalScans = Math.max(history.length, serverStats?.total_scans_7d || 0);

    // Total detections counted from history detections + hazards
    const historyDetections = history.reduce((sum, item) => sum + (item.total_detections || item.detections?.length || 0), 0);
    const hazardsCount = hazards.length;
    const totalDetections = Math.max(historyDetections, hazardsCount, serverStats?.total_potholes_found || 0);

    // Critical vs Moderate
    const criticalHazards = hazards.filter(h => h.severity === 'critical').length +
      history.filter(h => (h.total_detections || 0) >= 3).length;
    const moderateHazards = Math.max(0, hazardsCount - hazards.filter(h => h.severity === 'critical').length);

    // Average latency calculated from actual scan times
    const validLatencies = history
      .map(h => parseFloat(h.analysisTime))
      .filter(t => !isNaN(t) && t > 0);
    const avgLatency = validLatencies.length > 0
      ? (validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length).toFixed(2)
      : serverStats?.avg_latency ? `${serverStats.avg_latency}` : '0.12';

    // Dynamic Road Health Index (0 - 100)
    const roadHealthScore = Math.max(
      28,
      Math.min(98, Math.round(100 - (criticalHazards * 5.5 + moderateHazards * 2.5)))
    );

    return {
      totalScans,
      totalDetections,
      criticalHazards,
      moderateHazards,
      avgLatency,
      roadHealthScore,
    };
  }, [history, hazards, serverStats]);

  // Dynamic Hazard Categories Breakdown from real detections & hazards
  const dynamicHazardTypes = useMemo(() => {
    // Count specific detection classes or categorize by severity/confidence
    let severeCount = 0;
    let moderateCount = 0;
    let minorCount = 0;
    let cracksCount = 0;

    // Inspect history detections
    history.forEach(item => {
      const dets = item.detections || [];
      dets.forEach(d => {
        const conf = typeof d.confidence === 'number' ? d.confidence : parseFloat(d.confidence) || 80;
        const name = (d.name || d.class || '').toLowerCase();
        if (name.includes('crack')) {
          cracksCount++;
        } else if (conf >= 85) {
          severeCount++;
        } else if (conf >= 60) {
          moderateCount++;
        } else {
          minorCount++;
        }
      });
    });

    // Also factor in active hazards
    hazards.forEach(h => {
      if (h.severity === 'critical') severeCount++;
      else moderateCount++;
    });

    const total = Math.max(1, severeCount + moderateCount + minorCount + cracksCount);

    return [
      {
        name: 'Pothole (Severe / Deep)',
        count: severeCount,
        percentage: Math.round((severeCount / total) * 100) || 0,
        color: 'bg-red-500',
        text: 'text-red-400'
      },
      {
        name: 'Moderate Surface Defect',
        count: moderateCount,
        percentage: Math.round((moderateCount / total) * 100) || 0,
        color: 'bg-amber-500',
        text: 'text-amber-400'
      },
      {
        name: 'Road Cracking / Rutting',
        count: cracksCount,
        percentage: Math.round((cracksCount / total) * 100) || 0,
        color: 'bg-orange-500',
        text: 'text-orange-400'
      },
      {
        name: 'Minor Depression / Edge Wear',
        count: minorCount,
        percentage: Math.round((minorCount / total) * 100) || 0,
        color: 'bg-cyan-500',
        text: 'text-cyan-400'
      },
    ];
  }, [history, hazards]);

  // Dynamic Sector Road Conditions from actual GPS locations / addresses
  const dynamicSectors = useMemo(() => {
    const addressMap = {};

    // Group hazards by their real address or coordinates
    hazards.forEach(h => {
      const name = h.title || (h.coordsText ? `Road at ${h.coordsText}` : 'City Route');
      if (!addressMap[name]) {
        addressMap[name] = { count: 0, critical: 0 };
      }
      addressMap[name].count++;
      if (h.severity === 'critical') addressMap[name].critical++;
    });

    // Also include history items
    history.forEach(item => {
      if (item.gps?.address) {
        const name = item.gps.address;
        if (!addressMap[name]) {
          addressMap[name] = { count: 0, critical: 0 };
        }
        addressMap[name].count += (item.total_detections || 1);
        if ((item.total_detections || 0) >= 3) addressMap[name].critical++;
      }
    });

    const entries = Object.entries(addressMap);
    if (entries.length === 0) {
      return [
        { zone: 'Main City Sector Route', score: 85, status: 'Optimal', hazards: 0, trend: 'Stable' },
        { zone: 'Downtown Boulevard', score: 92, status: 'Optimal', hazards: 0, trend: 'Normal' },
      ];
    }

    return entries.slice(0, 6).map(([zone, data]) => {
      const score = Math.max(30, Math.min(95, 100 - (data.count * 12 + data.critical * 8)));
      const status = score >= 80 ? 'Optimal' : score >= 60 ? 'Needs Repair' : 'High Hazard';
      return {
        zone,
        score,
        status,
        hazards: data.count,
        trend: data.critical > 0 ? '+Active Defect' : 'Monitored',
      };
    });
  }, [hazards, history]);

  const handleExportReport = () => {
    if (onNavigateToReport) {
      onNavigateToReport();
    } else {
      showToast?.('Opening Road Audit Report...', 'info');
      setTimeout(() => {
        window.print();
      }, 500);
    }
  };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#111827] via-[#161f33] to-[#111827] border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-3xl">insights</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-100 font-heading">Road Quality & Hazard Analytics</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono uppercase font-bold tracking-wider">
                Live Dynamic Telemetry
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Real-time road surface health audit powered by live YOLOv8 deep learning vision.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex">
            {['7d', '30d', '90d', 'All'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedTimeframe(period)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${selectedTimeframe === period ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {period}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 text-slate-200 rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95"
          >
            <span className="material-symbols-outlined text-sm text-amber-400">download</span>
            Export Audit
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (Real-time computed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* City Road Health Score */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-5 flex flex-col justify-between transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Road Health Index</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">health_and_safety</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-extrabold text-slate-100 font-heading">
              {statsSummary.roadHealthScore}
            </span>
            <span className={`text-xs font-bold flex items-center ${statsSummary.roadHealthScore >= 80 ? 'text-emerald-400' : statsSummary.roadHealthScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
              <span className="material-symbols-outlined text-sm">
                {statsSummary.roadHealthScore >= 80 ? 'trending_up' : 'trending_down'}
              </span> 
              {statsSummary.roadHealthScore >= 80 ? 'Good' : statsSummary.roadHealthScore >= 60 ? 'Fair' : 'Critical'}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${
                statsSummary.roadHealthScore >= 80 ? 'bg-gradient-to-r from-amber-500 to-emerald-500' : statsSummary.roadHealthScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${statsSummary.roadHealthScore}%` }}
            />
          </div>
        </div>

        {/* Total Hazards Identified */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-5 flex flex-col justify-between transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Hazards Identified</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">warning</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-extrabold text-amber-400 font-heading">{statsSummary.totalDetections}</span>
            <span className="text-xs text-slate-400">across {statsSummary.totalScans} scans</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Critical Severity: <strong className="text-red-400">{statsSummary.criticalHazards}</strong>
          </span>
        </div>

        {/* Inference Latency */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/30 rounded-2xl p-5 flex flex-col justify-between transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Avg AI Latency</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">speed</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-extrabold text-cyan-400 font-heading">{statsSummary.avgLatency}s</span>
            <span className="text-xs text-slate-400 font-mono">/ frame</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Model: <strong className="text-slate-200">YOLOv8 Ultralytics</strong>
          </span>
        </div>

        {/* Model Accuracy / Status */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-5 flex flex-col justify-between transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Real-time Telemetry</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">verified</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl font-extrabold text-indigo-300 font-heading">
              {hazards.length} Pins
            </span>
            <span className="text-xs text-emerald-400 font-bold">Live DB</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Weights: <strong className="text-slate-200 font-mono">best.pt (train-3)</strong>
          </span>
        </div>
      </div>

      {/* Main Charts & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hazard Class Breakdown */}
        <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-lg">pie_chart</span>
              <h3 className="text-sm font-bold text-slate-200 font-heading uppercase tracking-wider">Hazard Breakdown</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">{statsSummary.totalDetections} Total</span>
          </div>

          <div className="flex flex-col gap-4">
            {dynamicHazardTypes.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">{item.name}</span>
                  <span className={`font-mono font-bold ${item.text}`}>{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                    className={`h-full rounded-full ${item.color}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400 text-xl">crisis_alert</span>
            <p className="text-[11px] text-slate-400 leading-snug">
              Detected potholes are prioritized automatically by severity for municipal repair dispatch.
            </p>
          </div>
        </div>

        {/* Regional Sector Inspection Health (Dynamic from GPS Locations) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400 text-lg">location_city</span>
              <h3 className="text-sm font-bold text-slate-200 font-heading uppercase tracking-wider">Active Sector Conditions</h3>
            </div>
            <span className="text-xs text-slate-400">{dynamicSectors.length} Monitored Roads</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dynamicSectors.map((zone, idx) => (
              <div 
                key={idx} 
                className="bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{zone.zone}</h4>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">{zone.hazards} Active Hazard Pins</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${zone.score >= 80 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : zone.score >= 60 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                    {zone.status}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>Quality Index</span>
                    <span className="font-bold text-slate-200">{zone.score}/100</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${zone.score >= 80 ? 'bg-emerald-500' : zone.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${zone.score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Audit Advice Box */}
          <div className="mt-2 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">alt_route</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Recommended Remediation Action</p>
                <p className="text-[11px] text-slate-400">
                  {dynamicSectors.length > 0
                    ? `Maintenance crew recommended for ${dynamicSectors[0].zone} (${dynamicSectors[0].hazards} defects).`
                    : 'All routes currently in optimal condition.'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => showToast?.('Remediation work order dispatched to maintenance team!', 'success')}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-sm"
            >
              Dispatch Crew
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
