import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDashboardView({ apiUrl, user, showToast, onNavigateToMap }) {
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [allHazards, setAllHazards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState(true);

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
      const [statsRes, usersRes, hazardsRes] = await Promise.all([
        fetch(`${targetUrl}/api/admin/stats`, {
          headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' }
        }),
        fetch(`${targetUrl}/api/auth/users`, {
          headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' }
        }),
        fetch(`${targetUrl}/api/hazards?all=true`, {
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

  const filteredUsers = usersList.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Top Admin Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-amber-500/30 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
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
              Live multi-device detections feed, user credentials management (edit/delete), and real-time telemetry.
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              {stats?.total_scans_7d ?? 0}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Scans</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Potholes detected: {stats?.total_potholes_found ?? 0}</span>
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

      {/* User Accounts & Credentials Management Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
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

        <div className="overflow-x-auto">
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

      {/* Live Multi-Device Detections Feed (All Users & Devices) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <h2 className="text-lg font-bold text-slate-100 font-heading">
                Live Multi-Device Pothole Feed (All Devices)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Real-time potholes detected by inspectors and field devices across all routes (Last 7 Days).
            </p>
          </div>
          <button
            onClick={onNavigateToMap}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">map</span>
            <span>View All on Global Map</span>
          </button>
        </div>

        {allHazards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[480px] overflow-y-auto pr-1">
            {allHazards.map((hazard) => (
              <div
                key={hazard.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col gap-2.5 transition-all shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                    hazard.severity === 'critical'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {hazard.severity || 'Moderate'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {hazard.detectedTime || hazard.createdAt || 'Recent'}
                  </span>
                </div>

                <div className="flex gap-3 items-center">
                  {hazard.image ? (
                    <img
                      src={hazard.image.startsWith('data:') ? hazard.image : hazard.image}
                      alt={hazard.title}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 flex-shrink-0">
                      <span className="material-symbols-outlined text-xl">broken_image</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-100 truncate">{hazard.title}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                      {hazard.coordsText || `${hazard.lat?.toFixed(4)}°, ${hazard.lng?.toFixed(4)}°`}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-amber-300 font-mono font-bold">
                        {hazard.confidence || '94%'} Conf
                      </span>
                      {hazard.userName && (
                        <span className="text-[9px] text-slate-400 truncate">
                          • by {hazard.userName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-slate-600">radar</span>
            <p className="text-xs">No active pothole hazards in the last 7 days. Start scanning to populate the feed.</p>
          </div>
        )}
      </div>

      {/* Model & System Health Info */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

      {/* ================= MODALS ================= */}

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
