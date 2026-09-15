import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDashboardView({ apiUrl, user, showToast, onNavigateToMap, onDeleteHazard }) {
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [allHazards, setAllHazards] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState(true);

  // Live Multi-Device Feed State & Filters
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState('all');
  const [feedSeverityFilter, setFeedSeverityFilter] = useState('all');
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [feedTab, setFeedTab] = useState('hazards'); // 'hazards' | 'scans'

  // Photo & Defect Inspection Modal State
  const [inspectedItem, setInspectedItem] = useState(null);

  // Delete Hazard / Scan State
  const [hazardToDelete, setHazardToDelete] = useState(null);
  const [scanToDelete, setScanToDelete] = useState(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);

  // Multi-Select Batch Delete State
  const [selectedHazardIds, setSelectedHazardIds] = useState([]);
  const [selectedScanIds, setSelectedScanIds] = useState([]);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(null); // { type: 'hazards' | 'scans', ids: [...] }
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Add User State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('officer');
  const [isCreating, setIsCreating] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('officer');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete User State
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAdminData = async () => {
    setIsLoading(true);
    const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
    try {
      const [statsRes, usersRes, hazardsRes, historyRes] = await Promise.all([
        fetch(`${targetUrl}/api/admin/stats`, {
          headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' }
        }),
        fetch(`${targetUrl}/api/auth/users`, {
          headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' }
        }),
        fetch(`${targetUrl}/api/hazards?all=true`, {
          headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' }
        }),
        fetch(`${targetUrl}/api/history`, {
          headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' }
        })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsersList(usersData.users || []);
      }
      if (hazardsRes.ok) {
        const hazardsData = await hazardsRes.json();
        setAllHazards(hazardsData.hazards || []);
      }
      if (historyRes.ok) {
        const histData = await historyRes.json();
        setAllHistory(histData.history || []);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      showToast?.('Could not fetch latest telemetry from server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 8000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const handleManualPurge = async () => {
    setIsPurging(true);
    const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
    try {
      const res = await fetch(`${targetUrl}/api/admin/purge_old`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' }
      });
      if (res.ok) {
        showToast?.('7-Day retention purge executed successfully!', 'success');
        await fetchAdminData();
      } else {
        showToast?.('Failed to run purge', 'error');
      }
    } catch (err) {
      showToast?.('Error triggering purge', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  // Delete Hazard Handler (False Positive removal)
  const handleConfirmDeleteHazard = async () => {
    if (!hazardToDelete) return;
    const deletingId = hazardToDelete.id;
    setIsDeletingReport(true);
    const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
    try {
      const res = await fetch(`${targetUrl}/api/hazards/${deletingId}`, {
        method: 'DELETE',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true',
        },
      });
      if (res.ok) {
        showToast?.(`Hazard report ${deletingId} removed from database & map!`, 'success');
        setAllHazards((prev) => prev.filter((h) => h.id !== deletingId));
        if (onDeleteHazard) {
          onDeleteHazard(deletingId);
        }
        if (inspectedItem?.id === deletingId) {
          setInspectedItem(null);
        }
        setHazardToDelete(null);
        await fetchAdminData();
      } else {
        showToast?.('Failed to delete hazard', 'error');
      }
    } catch (err) {
      showToast?.('Error deleting hazard', 'error');
    } finally {
      setIsDeletingReport(false);
    }
  };

  // Delete Scan History Handler
  const handleConfirmDeleteScan = async () => {
    if (!scanToDelete) return;
    setIsDeletingReport(true);
    const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
    try {
      const res = await fetch(`${targetUrl}/api/history/${scanToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true',
        },
      });
      if (res.ok) {
        showToast?.(`Scan record #${scanToDelete.id} deleted from database!`, 'success');
        setAllHistory((prev) => prev.filter((s) => s.id !== scanToDelete.id));
        if (inspectedItem?.id === scanToDelete.id) {
          setInspectedItem(null);
        }
        setScanToDelete(null);
        await fetchAdminData();
      } else {
        showToast?.('Failed to delete scan record', 'error');
      }
    } catch (err) {
      showToast?.('Error deleting scan record', 'error');
    } finally {
      setIsDeletingReport(false);
    }
  };

  // Multi-Select Toggle Functions
  const toggleSelectHazard = (id) => {
    setSelectedHazardIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllHazards = () => {
    const currentFilteredIds = filteredHazards.map((h) => h.id);
    const allSelected = currentFilteredIds.length > 0 && currentFilteredIds.every((id) => selectedHazardIds.includes(id));
    if (allSelected) {
      setSelectedHazardIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedHazardIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const toggleSelectScan = (id) => {
    setSelectedScanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllScans = () => {
    const currentFilteredIds = filteredHistory.map((s) => s.id);
    const allSelected = currentFilteredIds.length > 0 && currentFilteredIds.every((id) => selectedScanIds.includes(id));
    if (allSelected) {
      setSelectedScanIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedScanIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  // Batch Delete Confirmation Handler
  const handleConfirmBatchDelete = async () => {
    if (!batchDeleteConfirm || !batchDeleteConfirm.ids?.length) return;
    const { type, ids } = batchDeleteConfirm;
    setIsBatchDeleting(true);
    const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');

    try {
      if (type === 'hazards') {
        const res = await fetch(`${targetUrl}/api/hazards/batch-delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: JSON.stringify({ ids }),
        });

        if (res.ok) {
          showToast?.(`Successfully deleted ${ids.length} hazard report(s) and cleared map pins!`, 'success');
          setAllHazards((prev) => prev.filter((h) => !ids.includes(h.id)));
          if (onDeleteHazard) {
            ids.forEach((id) => onDeleteHazard(id));
          }
          setSelectedHazardIds((prev) => prev.filter((id) => !ids.includes(id)));
          if (inspectedItem && ids.includes(inspectedItem.id)) {
            setInspectedItem(null);
          }
          setBatchDeleteConfirm(null);
          await fetchAdminData();
        } else {
          showToast?.('Failed to batch delete hazards', 'error');
        }
      } else if (type === 'scans') {
        const res = await fetch(`${targetUrl}/api/history/batch-delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: JSON.stringify({ ids }),
        });

        if (res.ok) {
          showToast?.(`Successfully deleted ${ids.length} scan history record(s)!`, 'success');
          setAllHistory((prev) => prev.filter((s) => !ids.includes(s.id)));
          setSelectedScanIds((prev) => prev.filter((id) => !ids.includes(id)));
          if (inspectedItem && ids.includes(inspectedItem.id)) {
            setInspectedItem(null);
          }
          setBatchDeleteConfirm(null);
          await fetchAdminData();
        } else {
          showToast?.('Failed to batch delete scan records', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error processing batch delete request', 'error');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Create User Handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      showToast?.('Please fill out all fields', 'error');
      return;
    }

    setIsCreating(true);
    const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
    try {
      const res = await fetch(`${targetUrl}/api/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast?.(`User ${newName} created successfully!`, 'success');
        setIsAddModalOpen(false);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('officer');
        await fetchAdminData();
      } else {
        showToast?.(data.error || 'Failed to create user', 'error');
      }
    } catch (err) {
      showToast?.('Error creating user account', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (targetUser) => {
    setEditingUser(targetUser);
    setEditName(targetUser.name);
    setEditEmail(targetUser.email);
    setEditPassword(targetUser.password || '');
    setEditRole(targetUser.role || 'officer');
  };

  // Update User Credentials Handler
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim() || !editPassword.trim()) {
      showToast?.('Name, email, and password are required', 'error');
      return;
    }

    setIsUpdating(true);
    const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
    try {
      const res = await fetch(`${targetUrl}/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          password: editPassword,
          role: editRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast?.(`Credentials for ${editName} updated successfully!`, 'success');
        setEditingUser(null);
        await fetchAdminData();
      } else {
        showToast?.(data.error || 'Failed to update user', 'error');
      }
    } catch (err) {
      showToast?.('Error updating credentials', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete User Handler
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    const targetUrl = (apiUrl || 'http://localhost:5000').replace(/\/+$/, '');
    try {
      const res = await fetch(`${targetUrl}/api/auth/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true',
        },
      });

      const data = await res.json();
      if (res.ok) {
        showToast?.(`User ${userToDelete.name} deleted from database!`, 'success');
        setUserToDelete(null);
        await fetchAdminData();
      } else {
        showToast?.(data.error || 'Failed to delete user', 'error');
      }
    } catch (err) {
      showToast?.('Error deleting user', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Users for Credentials Table
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [usersList, searchTerm]);

  // Filtered Hazards for Multi-Device Feed
  const filteredHazards = useMemo(() => {
    return allHazards.filter(hazard => {
      // Filter by device / user
      if (selectedDeviceFilter !== 'all') {
        const matchesUser = hazard.userEmail === selectedDeviceFilter || 
                            hazard.userId?.toString() === selectedDeviceFilter ||
                            hazard.userName?.toLowerCase() === selectedDeviceFilter.toLowerCase();
        if (!matchesUser) return false;
      }

      // Filter by severity
      if (feedSeverityFilter !== 'all') {
        if (hazard.severity !== feedSeverityFilter) return false;
      }

      // Search query
      if (feedSearchQuery.trim()) {
        const q = feedSearchQuery.toLowerCase();
        const matchTitle = hazard.title?.toLowerCase().includes(q);
        const matchCoords = hazard.coordsText?.toLowerCase().includes(q);
        const matchId = hazard.id?.toLowerCase().includes(q);
        const matchUser = hazard.userName?.toLowerCase().includes(q);
        return matchTitle || matchCoords || matchId || matchUser;
      }

      return true;
    });
  }, [allHazards, selectedDeviceFilter, feedSeverityFilter, feedSearchQuery]);

  // Filtered Scans for Multi-Device Feed
  const filteredHistory = useMemo(() => {
    return allHistory.filter(scan => {
      // Filter by device / user
      if (selectedDeviceFilter !== 'all') {
        const matchesUser = scan.userEmail === selectedDeviceFilter || 
                            scan.userId?.toString() === selectedDeviceFilter ||
                            scan.userName?.toLowerCase() === selectedDeviceFilter.toLowerCase();
        if (!matchesUser) return false;
      }

      // Filter by severity
      if (feedSeverityFilter !== 'all') {
        const isCritical = (scan.total_detections || 0) >= 3;
        if (feedSeverityFilter === 'critical' && !isCritical) return false;
        if (feedSeverityFilter === 'moderate' && isCritical) return false;
      }

      // Search query
      if (feedSearchQuery.trim()) {
        const q = feedSearchQuery.toLowerCase();
        const matchTitle = scan.title?.toLowerCase().includes(q);
        const matchAddr = scan.gps?.address?.toLowerCase().includes(q);
        const matchUser = scan.userName?.toLowerCase().includes(q);
        return matchTitle || matchAddr || matchUser;
      }

      return true;
    });
  }, [allHistory, selectedDeviceFilter, feedSeverityFilter, feedSearchQuery]);

  // ================= REPORT EXPORT HANDLERS =================
  const handleExportMultiDeviceCSV = () => {
    try {
      const itemsToExport = feedTab === 'hazards' ? filteredHazards : filteredHistory;
      if (itemsToExport.length === 0) {
        showToast?.('No detection records to export for this filter', 'info');
        return;
      }

      const headers = [
        'Record ID',
        'Device / Inspector',
        'User Email',
        'Location / Address',
        'Latitude',
        'Longitude',
        'Pothole Detections',
        'Severity',
        'Confidence',
        'Timestamp',
        'Municipal Priority Action'
      ];

      const rows = itemsToExport.map((item, idx) => {
        const id = item.id || `SCAN-${idx + 1}`;
        const deviceName = item.userName || 'Field Device';
        const userEmail = item.userEmail || '';
        const title = (item.title || item.gps?.address || 'City Road').replace(/"/g, '""');
        const lat = item.lat || item.gps?.lat || '';
        const lng = item.lng || item.gps?.lng || '';
        const count = item.total_detections ?? 1;
        const severity = item.severity ? item.severity.toUpperCase() : (count >= 3 ? 'CRITICAL' : 'MODERATE');
        const conf = item.confidence || '92%';
        const time = item.detectedTime || item.timestamp || item.createdAt || 'Recent';
        const action = severity === 'CRITICAL' ? '"Emergency Dispatch Resurfacing"' : '"Scheduled Patch Repair"';

        return [
          `"${id}"`,
          `"${deviceName}"`,
          `"${userEmail}"`,
          `"${title}"`,
          lat,
          lng,
          count,
          `"${severity}"`,
          `"${conf}"`,
          `"${time}"`,
          action
        ];
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const deviceTag = selectedDeviceFilter === 'all' ? 'All_Devices' : selectedDeviceFilter.replace(/[@.]/g, '_');
      link.setAttribute('download', `Pothole_Audit_Report_${deviceTag}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast?.('Multi-device CSV report downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast?.('Failed to generate CSV report', 'error');
    }
  };

  const handleExportMultiDeviceJSON = () => {
    try {
      const exportData = {
        report_title: 'Multi-Device Pothole & Road Hazard Audit',
        generated_at: new Date().toISOString(),
        generated_by: user?.name || 'Administrator',
        selected_device: selectedDeviceFilter,
        total_records: feedTab === 'hazards' ? filteredHazards.length : filteredHistory.length,
        system_stats: stats,
        records: feedTab === 'hazards' ? filteredHazards : filteredHistory,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      const deviceTag = selectedDeviceFilter === 'all' ? 'All_Devices' : selectedDeviceFilter.replace(/[@.]/g, '_');
      link.setAttribute('download', `Pothole_Audit_Data_${deviceTag}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast?.('Multi-device JSON audit data downloaded!', 'success');
    } catch (err) {
      showToast?.('Failed to generate JSON data', 'error');
    }
  };

  const handlePrintDeviceReport = () => {
    showToast?.('Preparing printable multi-device report...', 'info');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const handleDownloadPhoto = (photoSrc, filename) => {
    if (!photoSrc) return;
    const link = document.createElement('a');
    link.href = photoSrc.startsWith('data:') || photoSrc.startsWith('http') ? photoSrc : `data:image/jpeg;base64,${photoSrc}`;
    link.download = filename || `pothole_inspection_${Date.now()}.jpg`;
    link.click();
    showToast?.('Photo downloaded successfully!', 'success');
  };

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300 print:p-0 print:m-0 print:max-w-full">
      {/* Top Admin Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-amber-500/30 rounded-3xl p-6 relative overflow-hidden shadow-2xl print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              admin_panel_settings
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-100 font-heading">
                Admin Command Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-mono uppercase font-bold tracking-wider">
                Full Database & RBAC Control
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Live multi-device detections feed, report & photo deletion, and device report generation.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 z-10">
          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Sync Live DB</span>
          </button>

          <button
            onClick={handleManualPurge}
            disabled={isPurging}
            title="Purge all hazards and detection history older than 7 days"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500/20 to-amber-500/20 hover:from-red-500/30 hover:to-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base text-amber-400">
              auto_delete
            </span>
            <span>{isPurging ? 'Purging...' : 'Force 7-Day Purge'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Accounts</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">group</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">
              {usersList.length || stats?.total_users || 2}
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold font-mono">SQLite DB</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Multi-user auth & credentials stored</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Map Dots (7D)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">location_on</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">
              {allHazards.length || stats?.active_hazards || 0}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Live Pins</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">From all connected devices</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Scans (7D)</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">radar</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-cyan-400">
              {allHistory.length || stats?.total_scans_7d || 0}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Scans</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Potholes detected: {stats?.total_potholes_found ?? allHazards.length}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Latency / Speed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">speed</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
              {stats?.avg_latency ? `${stats.avg_latency}s` : '~0.12s'}
            </span>
            <span className="text-[11px] text-emerald-400 font-mono font-semibold">Real-Time</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Model: {stats?.model_info?.path ? 'best.pt' : 'YOLOv8'}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 LIVE MULTI-DEVICE POTHOLE FEED & REPORT GENERATOR (ALL DEVICES)       */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="text-lg font-bold text-slate-100 font-heading">
                Live Multi-Device Pothole Feed & Reports
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                {feedTab === 'hazards' ? filteredHazards.length : filteredHistory.length} Recorded
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any photo to inspect full detection details. Delete false positives, filter by device, or export work orders.
            </p>
          </div>

          {/* Report Download Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportMultiDeviceCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm active:scale-95 transition-all"
              title="Download filtered device detection report as CSV"
            >
              <span className="material-symbols-outlined text-sm text-emerald-400">table_view</span>
              <span>CSV Work Order</span>
            </button>

            <button
              onClick={handleExportMultiDeviceJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm active:scale-95 transition-all"
              title="Download structured JSON telemetry"
            >
              <span className="material-symbols-outlined text-sm text-cyan-400">data_object</span>
              <span>JSON Log</span>
            </button>

            <button
              onClick={handlePrintDeviceReport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 transition-all"
              title="Print formatted municipal road defect report"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Print / PDF Report</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
          {/* Feed Tab Switcher */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setFeedTab('hazards')}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                feedTab === 'hazards'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hazard Pins ({allHazards.length})
            </button>
            <button
              onClick={() => setFeedTab('scans')}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                feedTab === 'scans'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Scan Logs ({allHistory.length})
            </button>
          </div>

          {/* Filter by Device / Inspector */}
          <div className="relative">
            <select
              value={selectedDeviceFilter}
              onChange={(e) => setSelectedDeviceFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            >
              <option value="all">📱 All Devices & Users</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.email}>
                  👤 {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Severity */}
          <div className="relative">
            <select
              value={feedSeverityFilter}
              onChange={(e) => setFeedSeverityFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            >
              <option value="all">⚠️ All Severities</option>
              <option value="critical">🔴 Critical Defects Only</option>
              <option value="moderate">🟡 Moderate Defects Only</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-2">
              search
            </span>
            <input
              type="text"
              value={feedSearchQuery}
              onChange={(e) => setFeedSearchQuery(e.target.value)}
              placeholder="Search location, user, ID..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Multi-Select Batch Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-2xl">
          <div className="flex items-center gap-3">
            {feedTab === 'hazards' ? (
              <button
                onClick={toggleSelectAllHazards}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={
                    filteredHazards.length > 0 &&
                    filteredHazards.every((h) => selectedHazardIds.includes(h.id))
                  }
                  className="rounded border-slate-600 text-amber-500 focus:ring-0 cursor-pointer pointer-events-none"
                />
                <span>
                  {filteredHazards.length > 0 &&
                  filteredHazards.every((h) => selectedHazardIds.includes(h.id))
                    ? 'Deselect All'
                    : `Select All Filtered (${filteredHazards.length})`}
                </span>
              </button>
            ) : (
              <button
                onClick={toggleSelectAllScans}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={
                    filteredHistory.length > 0 &&
                    filteredHistory.every((s) => selectedScanIds.includes(s.id))
                  }
                  className="rounded border-slate-600 text-cyan-500 focus:ring-0 cursor-pointer pointer-events-none"
                />
                <span>
                  {filteredHistory.length > 0 &&
                  filteredHistory.every((s) => selectedScanIds.includes(s.id))
                    ? 'Deselect All'
                    : `Select All Filtered (${filteredHistory.length})`}
                </span>
              </button>
            )}

            {/* Selected Count Badge */}
            {(feedTab === 'hazards' ? selectedHazardIds.length : selectedScanIds.length) > 0 && (
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 animate-in fade-in">
                <span className="material-symbols-outlined text-sm">checklist</span>
                {feedTab === 'hazards' ? selectedHazardIds.length : selectedScanIds.length} Selected
              </span>
            )}
          </div>

          {/* Delete Selected Button */}
          {(feedTab === 'hazards' ? selectedHazardIds.length : selectedScanIds.length) > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (feedTab === 'hazards') setSelectedHazardIds([]);
                  else setSelectedScanIds([]);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Clear Selection
              </button>
              <button
                onClick={() => {
                  if (feedTab === 'hazards') {
                    setBatchDeleteConfirm({
                      type: 'hazards',
                      ids: [...selectedHazardIds],
                      count: selectedHazardIds.length,
                    });
                  } else {
                    setBatchDeleteConfirm({
                      type: 'scans',
                      ids: [...selectedScanIds],
                      count: selectedScanIds.length,
                    });
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                <span>
                  Delete Selected ({feedTab === 'hazards' ? selectedHazardIds.length : selectedScanIds.length})
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Feed Cards Grid */}
        {feedTab === 'hazards' ? (
          filteredHazards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[520px] overflow-y-auto pr-1">
              {filteredHazards.map((hazard) => {
                const photoSrc = hazard.image?.startsWith('data:') || hazard.image?.startsWith('http')
                  ? hazard.image
                  : hazard.image ? `data:image/jpeg;base64,${hazard.image}` : null;
                const isSelected = selectedHazardIds.includes(hazard.id);

                return (
                  <div
                    key={hazard.id}
                    onClick={() => setInspectedItem({ ...hazard, type: 'hazard' })}
                    className={`border rounded-2xl p-3.5 flex flex-col gap-2.5 transition-all shadow-md cursor-pointer group relative ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Multi-Select Checkbox */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectHazard(hazard.id);
                          }}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold shadow-sm'
                              : 'bg-slate-900 border-slate-700 hover:border-amber-500/80 text-transparent'
                          }`}
                          title={isSelected ? 'Deselect hazard' : 'Select hazard for batch action'}
                        >
                          <span className="material-symbols-outlined text-sm leading-none font-bold">check</span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                            hazard.severity === 'critical'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {hazard.severity || 'Moderate'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {hazard.detectedTime || hazard.createdAt || 'Recent'}
                        </span>
                        {/* Quick Single Delete Button on Card */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setHazardToDelete(hazard);
                          }}
                          title="Delete this hazard report / false positive"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-700/60 hover:border-red-500/40 transition-all ml-1"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 items-center">
                      {photoSrc ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-black border border-slate-800 flex-shrink-0 relative group-hover:scale-105 transition-transform">
                          <img
                            src={photoSrc}
                            alt={hazard.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="material-symbols-outlined text-white text-base">zoom_in</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 flex-shrink-0">
                          <span className="material-symbols-outlined text-xl">broken_image</span>
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
                          {hazard.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {hazard.coordsText || `${hazard.lat?.toFixed(4)}°, ${hazard.lng?.toFixed(4)}°`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-amber-300 font-mono font-bold">
                            {hazard.confidence || '94%'} Conf
                          </span>
                          {hazard.userName && (
                            <span className="text-[9px] text-cyan-400 font-mono truncate">
                              • 👤 {hazard.userName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Quick Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
                      <span>ID: {hazard.id}</span>
                      <span className="text-amber-400 font-semibold group-hover:underline flex items-center gap-0.5">
                        Inspect & Actions <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl text-slate-600">radar</span>
              <p className="text-xs">No active hazard pins match your selected filters.</p>
            </div>
          )
        ) : (
          filteredHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[520px] overflow-y-auto pr-1">
              {filteredHistory.map((scan) => {
                const photoSrc = scan.annotated?.startsWith('data:') || scan.annotated?.startsWith('http')
                  ? scan.annotated
                  : scan.annotated ? `data:image/jpeg;base64,${scan.annotated}` : null;
                const isCritical = (scan.total_detections || 0) >= 3;
                const isSelected = selectedScanIds.includes(scan.id);

                return (
                  <div
                    key={scan.id}
                    onClick={() => setInspectedItem({ ...scan, type: 'scan' })}
                    className={`border rounded-2xl p-3.5 flex flex-col gap-2.5 transition-all shadow-md cursor-pointer group relative ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-500/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Multi-Select Checkbox */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectScan(scan.id);
                          }}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold shadow-sm'
                              : 'bg-slate-900 border-slate-700 hover:border-cyan-500/80 text-transparent'
                          }`}
                          title={isSelected ? 'Deselect scan' : 'Select scan for batch action'}
                        >
                          <span className="material-symbols-outlined text-sm leading-none font-bold">check</span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                            isCritical
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {scan.total_detections} Pothole{scan.total_detections === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {scan.timestamp || 'Recent'}
                        </span>
                        {/* Quick Delete Button on Scan Card */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setScanToDelete(scan);
                          }}
                          title="Delete this scan history log"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-700/60 hover:border-red-500/40 transition-all ml-1"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 items-center">
                      {photoSrc ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-black border border-slate-800 flex-shrink-0 relative group-hover:scale-105 transition-transform">
                          <img
                            src={photoSrc}
                            alt={scan.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="material-symbols-outlined text-white text-base">zoom_in</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 flex-shrink-0">
                          <span className="material-symbols-outlined text-xl">camera_indoor</span>
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-400 transition-colors">
                          {scan.gps?.address || scan.title || 'Road Inspection Scan'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {scan.gps?.lat ? `${scan.gps.lat.toFixed(4)}°, ${scan.gps.lng.toFixed(4)}°` : 'Field Scan'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-cyan-300 font-mono">
                            ⚡ {scan.analysisTime || '0.12'}s
                          </span>
                          {scan.userName && (
                            <span className="text-[9px] text-slate-400 font-mono truncate">
                              • by {scan.userName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
                      <span>Scan #{scan.id}</span>
                      <span className="text-cyan-400 font-semibold group-hover:underline flex items-center gap-0.5">
                        Inspect & Actions <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl text-slate-600">history</span>
              <p className="text-xs">No scan history records match your selected filters.</p>
            </div>
          )
        )}
      </div>

      {/* ========================================================================= */}
      {/* 👥 USER ACCOUNTS & CREDENTIALS MANAGEMENT (EDIT / DELETE / ADD)          */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100 font-heading">User Accounts & Login Credentials</h2>
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-mono font-semibold flex items-center gap-1 ml-2 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20"
              >
                <span className="material-symbols-outlined text-xs">
                  {showPasswords ? 'visibility_off' : 'visibility'}
                </span>
                <span>{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">Admin can create, change credentials, or delete user accounts directly.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-2.5">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search user, email..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full sm:w-48"
              />
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              <span>Add Account</span>
            </button>
          </div>
        </div>

        {/* Mobile View: Clean Responsive Cards */}
        <div className="md:hidden flex flex-col gap-3">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => {
              const isPrimaryAdmin = u.email === 'admin@city.gov';
              return (
                <div
                  key={u.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs uppercase border border-amber-500/30 flex-shrink-0">
                        {u.name ? u.name[0] : 'U'}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-200 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{u.email}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-bold uppercase flex-shrink-0 ${
                        u.role === 'admin'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {u.role || 'Officer'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-900/90 rounded-xl px-2.5 py-1.5 border border-slate-800 text-[11px] font-mono">
                    <span className="text-slate-400 text-[10px]">Password:</span>
                    <span className="text-amber-300 font-semibold truncate max-w-[150px]">
                      {showPasswords ? (u.password || '••••••••') : '••••••••'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                      <span>Pins: <strong className="text-amber-400">{u.hazard_count ?? 0}</strong></span>
                      <span>Scans: <strong className="text-cyan-400">{u.scan_count ?? 0}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        title="Edit User Credentials"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 border border-slate-700/60 text-xs font-semibold flex items-center gap-1 transition-all"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                        Edit
                      </button>

                      <button
                        onClick={() => setUserToDelete(u)}
                        disabled={isPrimaryAdmin}
                        title={isPrimaryAdmin ? 'Master Admin cannot be deleted' : 'Delete User and Credentials'}
                        className={`p-1 rounded-lg transition-all ${
                          isPrimaryAdmin
                            ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 border border-slate-700/60'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs">
              No users found in database.
            </div>
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                <th className="pb-3 font-semibold">User</th>
                <th className="pb-3 font-semibold">Email / Login ID</th>
                <th className="pb-3 font-semibold">Password Credential</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold text-center">Hazards Pinned</th>
                <th className="pb-3 font-semibold text-center">Scans</th>
                <th className="pb-3 font-semibold text-right">Actions (Edit / Delete)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-body">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isPrimaryAdmin = u.email === 'admin@city.gov';
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 font-semibold text-slate-200 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[11px] uppercase border border-amber-500/30">
                          {u.name ? u.name[0] : 'U'}
                        </div>
                        <span className="truncate max-w-[130px]">{u.name}</span>
                      </td>
                      <td className="py-3 text-slate-300 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3 font-mono text-amber-300 font-semibold text-[11px]">
                        {showPasswords ? (u.password || '••••••••') : '••••••••'}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase ${
                          u.role === 'admin' 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {u.role || 'Officer'}
                        </span>
                      </td>
                      <td className="py-3 text-center font-mono text-amber-300 font-bold">{u.hazard_count ?? 0}</td>
                      <td className="py-3 text-center font-mono text-slate-300">{u.scan_count ?? 0}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            title="Edit User Credentials"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 border border-slate-700/60 hover:border-amber-500/40 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setUserToDelete(u)}
                            disabled={isPrimaryAdmin}
                            title={isPrimaryAdmin ? 'Master Admin cannot be deleted' : 'Delete User and Credentials'}
                            className={`p-1.5 rounded-lg transition-all ${
                              isPrimaryAdmin
                                ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                                : 'bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 border border-slate-700/60 hover:border-red-500/40'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No users found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model & System Health Info */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-100 font-heading">Active Deep Learning Weights</h2>
          <p className="text-xs font-mono text-cyan-400 mt-0.5">
            {stats?.model_info?.path || 'runs/detect/train-3/weights/best.pt'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">Device: <b className="text-emerald-400">{stats?.model_info?.device === '0' ? 'NVIDIA GPU (CUDA)' : 'Torch CPU'}</b></span>
          <span className="text-slate-400">Retention: <b className="text-amber-400">7 Days Auto-Prune</b></span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🔍 PHOTO & DEFECT INSPECTION MODAL (AUDIT DETAIL & EVIDENCE VIEWER)      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {inspectedItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setInspectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl bg-[#111827] border border-amber-500/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <span className="material-symbols-outlined text-xl">crisis_alert</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 font-heading">
                      {inspectedItem.title || inspectedItem.gps?.address || 'Multi-Device Pothole Inspection'}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {inspectedItem.id || `SCAN-${inspectedItem.id}`} • Detected: {inspectedItem.detectedTime || inspectedItem.timestamp || inspectedItem.createdAt || 'Recent'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setInspectedItem(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              {/* Large High-Res Photo Display */}
              {(() => {
                const photoSrc = inspectedItem.image || inspectedItem.annotated || inspectedItem.original;
                const fullSrc = photoSrc?.startsWith('data:') || photoSrc?.startsWith('http')
                  ? photoSrc
                  : photoSrc ? `data:image/jpeg;base64,${photoSrc}` : null;

                return (
                  <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video relative flex items-center justify-center">
                    {fullSrc ? (
                      <img
                        src={fullSrc}
                        alt="Detection Evidence"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <span className="material-symbols-outlined text-4xl">broken_image</span>
                        <span className="text-xs font-mono">No raw photo attached to this record</span>
                      </div>
                    )}

                    {/* Photo Top Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase shadow-lg ${
                        inspectedItem.severity === 'critical' || (inspectedItem.total_detections || 0) >= 3
                          ? 'bg-red-500 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }`}>
                        {inspectedItem.severity || `${inspectedItem.total_detections || 1} Potholes`}
                      </span>
                      {inspectedItem.confidence && (
                        <span className="px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur text-amber-300 text-xs font-mono font-bold">
                          {inspectedItem.confidence} Confidence
                        </span>
                      )}
                    </div>

                    {/* Quick Download Image Button */}
                    {fullSrc && (
                      <button
                        onClick={() => handleDownloadPhoto(fullSrc, `pothole_${inspectedItem.id || 'scan'}.jpg`)}
                        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 hover:bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold backdrop-blur shadow-lg active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm text-amber-400">download</span>
                        <span>Download Photo</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Inspector & Geotag Details Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">
                    Field Device & Inspector
                  </span>
                  <p className="text-sm font-bold text-slate-200 mt-0.5">
                    👤 {inspectedItem.userName || 'Field Inspector'}
                  </p>
                  <p className="text-xs font-mono text-cyan-400 mt-0.5">
                    {inspectedItem.userEmail || 'Field Device ID'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">
                    GPS Geotag Location
                  </span>
                  <p className="text-xs font-bold text-amber-300 mt-0.5">
                    {inspectedItem.coordsText || (inspectedItem.lat ? `${inspectedItem.lat.toFixed(5)}°N, ${inspectedItem.lng.toFixed(5)}°W` : (inspectedItem.gps?.lat ? `${inspectedItem.gps.lat.toFixed(5)}°N, ${inspectedItem.gps.lng.toFixed(5)}°W` : 'GPS Coordinates Attached'))}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {inspectedItem.title || inspectedItem.gps?.address || 'City Road Section'}
                  </p>
                </div>
              </div>

              {/* Detections List (if scan object) */}
              {inspectedItem.detections && inspectedItem.detections.length > 0 && (
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-200 mb-2 block font-heading">
                    AI Vision Box Identifications ({inspectedItem.detections.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {inspectedItem.detections.map((d, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-mono text-slate-200 flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span>{d.name || d.class || 'Pothole'}</span>
                        <span className="text-amber-400 font-bold">
                          {typeof d.confidence === 'number' && d.confidence <= 1 ? Math.round(d.confidence * 100) : d.confidence}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Modal Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {/* Google Maps Button */}
                  {(inspectedItem.lat || inspectedItem.gps?.lat) && (
                    <button
                      onClick={() => {
                        const lat = inspectedItem.lat || inspectedItem.gps?.lat;
                        const lng = inspectedItem.lng || inspectedItem.gps?.lng;
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm text-cyan-400">directions</span>
                      <span>Google Maps Route</span>
                    </button>
                  )}

                  {onNavigateToMap && (
                    <button
                      onClick={() => {
                        setInspectedItem(null);
                        onNavigateToMap();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold"
                    >
                      <span className="material-symbols-outlined text-sm">map</span>
                      <span>View on Global Map</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Delete Report Button in Modal */}
                  <button
                    onClick={() => {
                      if (inspectedItem.type === 'scan') {
                        setScanToDelete(inspectedItem);
                      } else {
                        setHazardToDelete(inspectedItem);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Delete Record (False Positive)</span>
                  </button>

                  <button
                    onClick={() => setInspectedItem(null)}
                    className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Close Inspection
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 🗑️ DELETE HAZARD CONFIRMATION MODAL                                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {hazardToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#111827] border border-red-500/30 rounded-3xl p-6 shadow-2xl relative text-center flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
                <span className="material-symbols-outlined text-3xl">delete_sweep</span>
              </div>

              <h3 className="text-base font-bold text-slate-100 font-heading">
                Delete Pothole Report?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-200">{hazardToDelete.title || hazardToDelete.id}</strong>? This hazard pin will be permanently removed from the map and SQLite database.
              </p>

              <div className="flex items-center gap-3 mt-6 w-full">
                <button
                  type="button"
                  onClick={() => setHazardToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteHazard}
                  disabled={isDeletingReport}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-colors disabled:opacity-50"
                >
                  {isDeletingReport ? 'Deleting...' : 'Delete Report'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 🗑️ DELETE SCAN HISTORY CONFIRMATION MODAL                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {scanToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#111827] border border-red-500/30 rounded-3xl p-6 shadow-2xl relative text-center flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
                <span className="material-symbols-outlined text-3xl">delete</span>
              </div>

              <h3 className="text-base font-bold text-slate-100 font-heading">
                Delete Scan History Log?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Delete scan record <strong className="text-slate-200">#{scanToDelete.id}</strong> ({scanToDelete.title || 'Road Scan'})? This log and its photo evidence will be removed.
              </p>

              <div className="flex items-center gap-3 mt-6 w-full">
                <button
                  type="button"
                  onClick={() => setScanToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteScan}
                  disabled={isDeletingReport}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-colors disabled:opacity-50"
                >
                  {isDeletingReport ? 'Deleting...' : 'Delete Log'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 🗑️ BATCH DELETE MULTI-SELECT CONFIRMATION MODAL                            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {batchDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#111827] border border-red-500/40 rounded-3xl p-6 shadow-2xl relative text-center flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400 mb-3 shadow-lg shadow-red-500/20">
                <span className="material-symbols-outlined text-4xl">delete_sweep</span>
              </div>

              <h3 className="text-lg font-bold text-slate-100 font-heading">
                Delete {batchDeleteConfirm.count} Selected {batchDeleteConfirm.type === 'hazards' ? 'Hazard Reports' : 'Scan Records'}?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                You are about to permanently delete <strong className="text-red-400">{batchDeleteConfirm.count}</strong> {batchDeleteConfirm.type === 'hazards' ? 'hazard pins from the map and SQLite database' : 'scan history logs and photo records'}. This action cannot be undone.
              </p>

              <div className="flex items-center gap-3 mt-6 w-full">
                <button
                  type="button"
                  onClick={() => setBatchDeleteConfirm(null)}
                  disabled={isBatchDeleting}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchDelete}
                  disabled={isBatchDeleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isBatchDeleting ? 'Deleting...' : `Delete ${batchDeleteConfirm.count} Items`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 📝 USER ACCOUNT MODALS (ADD, EDIT, DELETE)                                */}
      {/* ========================================================================= */}

      {/* 1. ADD USER MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-3xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">person_add</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 font-heading">Add New Account</h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Officer Marcus"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email / Login ID</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. marcus@city.gov"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Password</label>
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Set secure password"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Role Permission</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="officer">Officer / Inspector (Cannot view Admin Dashboard)</option>
                    <option value="admin">Administrator (Full Admin Access)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md disabled:opacity-50"
                  >
                    {isCreating ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. EDIT USER CREDENTIALS MODAL */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-3xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">manage_accounts</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 font-heading">Edit User Credentials</h3>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email / Login ID</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Password Credential (Edit / Update)
                  </label>
                  <input
                    type="text"
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 text-amber-300 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Role Permission</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="officer">Officer / Inspector (No Admin Dashboard access)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md disabled:opacity-50"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. DELETE USER CONFIRMATION MODAL */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#111827] border border-red-500/30 rounded-3xl p-6 shadow-2xl relative text-center flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>

              <h3 className="text-base font-bold text-slate-100 font-heading">
                Delete User Account?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-200">{userToDelete.name}</strong> ({userToDelete.email})? Their credentials will be permanently removed from the database.
              </p>

              <div className="flex items-center gap-3 mt-6 w-full">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
