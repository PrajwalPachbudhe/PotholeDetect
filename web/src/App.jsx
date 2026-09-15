import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ScanView from './components/ScanView';
import ResultsView from './components/ResultsView';
import AnalyticsView from './components/AnalyticsView';
import HistoryView from './components/HistoryView';
import ReportView from './components/ReportView';
import MapView from './components/MapView';
import AdminDashboardView from './components/AdminDashboardView';
import LoginView from './components/LoginView';
import SignupView from './components/SignupView';
import ForgotPasswordView from './components/ForgotPasswordView';
import InstallModal from './components/InstallModal';
import Toast from './components/Toast';
import ClickSpark from './components/ClickSpark';
import { useGeolocation } from './utils/useGeolocation';
import { getDistanceMeters } from './utils/clusterHazards';

// Fast dynamic API address: connects Render/Vercel/mobile to your live PC backend
const getInitialApiUrl = () => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin || '';
    const host = window.location.hostname || '';
    
    // Local development
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://127.0.0.1:5000';
    }
    // Direct ngrok domain
    if (origin.includes('ngrok')) {
      return origin;
    }
  }
  // External deployments (e.g. onrender.com, Vercel, or mobile devices)
  return 'https://oversleep-relic-stubbed.ngrok-free.dev';
};

const DEFAULT_HAZARDS = [
  {
    id: 'PTH-992A',
    title: '1400 Main St Bridge',
    lat: 34.0522,
    lng: -118.2437,
    severity: 'critical',
    detectedTime: '10:42 AM Today',
    coordsText: '34.0522° N, 118.2437° W',
    confidence: '94.5%',
    image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'PTH-884B',
    title: 'Grand Ave & 5th St',
    lat: 34.0545,
    lng: -118.2520,
    severity: 'critical',
    detectedTime: '11:15 AM Today',
    coordsText: '34.0545° N, 118.2520° W',
    confidence: '91.2%',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'PTH-771C',
    title: 'Broadway Boulevard #42',
    lat: 34.0485,
    lng: -118.2495,
    severity: 'moderate',
    detectedTime: '08:30 AM Today',
    coordsText: '34.0485° N, 118.2495° W',
    confidence: '86.8%',
    image: 'https://images.unsplash.com/photo-1578637387939-43c525550085?q=80&w=600&auto=format&fit=crop',
  }
];

function App() {
  // Login page appears first whenever opening website
  const [currentView, setCurrentView] = useState('login');
  const [results, setResults] = useState(null);
  const [analysisTime, setAnalysisTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Global Hazards State (synced across Map, Scanner, and SQLite backend with 7-day expiry)
  const [hazards, setHazards] = useState(() => {
    try {
      const saved = localStorage.getItem('pothole_hazards_list');
      return saved ? JSON.parse(saved) : DEFAULT_HAZARDS;
    } catch {
      return DEFAULT_HAZARDS;
    }
  });

  // History State (per-user detection logs)
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('pothole_scan_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [apiUrl, setApiUrl] = useState(getInitialApiUrl);
  const [isApiOnline, setIsApiOnline] = useState(true);

  // Auth state
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pothole_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Toast state
  const [toast, setToast] = useState(null);

  // Chrome PWA / WebAPK Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const handleCloseToast = useCallback(() => {
    setToast(null);
  }, []);

  const handleInstallApp = useCallback(() => {
    setIsInstallModalOpen(true);
  }, []);

  const handlePwaInstallDirect = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Installing PotholeDetect App...', 'success');
        setDeferredPrompt(null);
      }
    } else {
      showToast('📱 Tap Chrome menu (⋮) > "Install app" or "Add to Home screen"', 'info');
    }
  }, [deferredPrompt, showToast]);

  // Geolocation & Road Simulation Engine
  const {
    coords: currentGps,
    isTracking: isGpsTracking,
    isSimulating,
    startTracking: startGpsTracking,
    stopTracking: stopGpsTracking,
    toggleSimulation,
  } = useGeolocation();

  // Periodic Backend Health Check & Fetch SQLite 7-Day Active Hazards & History
  useEffect(() => {
    let isMounted = true;
    async function syncBackendData() {
      try {
        const clean = apiUrl.replace(/\/+$/, '');
        const res = await fetch(`${clean}/api/health`, {
          method: 'GET',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
          },
          signal: AbortSignal.timeout(3000),
        });
        
        if (isMounted) {
          setIsApiOnline(res.ok);
        }

        if (res.ok) {
          // Fetch active hazards (< 7 days old)
          try {
            const hRes = await fetch(`${clean}/api/hazards?all=true`, {
              headers: {
                'ngrok-skip-browser-warning': 'true',
                'Bypass-Tunnel-Reminder': 'true',
              },
              signal: AbortSignal.timeout(3000),
            });
            if (hRes.ok) {
              const hData = await hRes.json();
              if (Array.isArray(hData.hazards) && isMounted) {
                setHazards(hData.hazards);
              }
            }
          } catch {
            // Non-blocking
          }

          // Fetch user-scoped history if logged in
          if (user?.email) {
            try {
              const histRes = await fetch(`${clean}/api/history?user_email=${encodeURIComponent(user.email)}`, {
                headers: {
                  'ngrok-skip-browser-warning': 'true',
                  'Bypass-Tunnel-Reminder': 'true',
                },
                signal: AbortSignal.timeout(3000),
              });
              if (histRes.ok) {
                const histData = await histRes.json();
                if (histData.history && isMounted) {
                  setHistory(histData.history);
                }
              }
            } catch {
              // Non-blocking
            }
          }
        }
      } catch {
        if (isMounted) {
          setIsApiOnline(false);
        }
      }
    }

    syncBackendData();
    const interval = setInterval(syncBackendData, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl, user?.email]);

  // Persist hazards to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pothole_hazards_list', JSON.stringify(hazards));
    } catch (err) {
      console.warn('Could not persist hazards', err);
    }
  }, [hazards]);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pothole_scan_history', JSON.stringify(history));
    } catch (err) {
      console.warn('Could not persist history to localStorage', err);
    }
  }, [history]);

  // Persist active user to localStorage
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('pothole_active_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('pothole_active_user');
      }
    } catch (err) {
      console.warn('Could not persist user to localStorage', err);
    }
  }, [user]);

  const handleLogin = useCallback((loggedInUser) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('scan');
    }
  }, []);

  const handleSignup = useCallback((newUser) => {
    setUser(newUser);
    setCurrentView('scan');
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setCurrentView('login');
    showToast('Signed out successfully', 'info');
  }, [showToast]);

  const handleDetectionComplete = useCallback((data, elapsed) => {
    setResults(data);
    setAnalysisTime(elapsed);
    setIsLoading(false);
    setCurrentView('results');
  }, []);

  const handleBack = useCallback(() => {
    setResults(null);
    setCurrentView('scan');
  }, []);

  const handleSaveToHistory = useCallback((data, elapsed) => {
    const now = new Date();
    const timestamp =
      now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }) +
      ', ' +
      now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

    const newScanEntry = {
      ...data,
      user_id: user?.id,
      user_email: user?.email,
      analysisTime: elapsed,
      timestamp,
    };

    setHistory((prev) => [newScanEntry, ...prev]);

    // Send to backend SQLite
    if (isApiOnline && apiUrl) {
      try {
        const clean = apiUrl.replace(/\/+$/, '');
        fetch(`${clean}/api/history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: JSON.stringify(newScanEntry),
        }).catch(() => {});
      } catch {
        // Non-blocking
      }
    }

    showToast('Saved to scan history in database!', 'success');
  }, [showToast, user, isApiOnline, apiUrl]);

  // Automated Geotagged Pothole Logging (Linked to Logged-in User with 7-Day Expiry)
  const handleAutoLogHazard = useCallback((detectionData) => {
    if (!detectionData || detectionData.total_detections === 0) return;

    const gps = detectionData.gps || currentGps;
    const isCritical = (detectionData.total_detections || 0) >= 3;
    const topConfidence = detectionData.detections?.[0]?.confidence || 92;
    const photoBase64 = detectionData.annotated || detectionData.original;

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newHazard = {
      id: `PTH-${randomSuffix}`,
      user_id: user?.id || 1,
      user_email: user?.email || 'officer@city.gov',
      user_name: user?.name || 'Inspector',
      title: gps.address || `Pothole at ${gps.lat.toFixed(4)}°N, ${gps.lng.toFixed(4)}°W`,
      lat: gps.lat,
      lng: gps.lng,
      severity: isCritical ? 'critical' : 'moderate',
      detectedTime: 'Just now',
      coordsText: `${gps.lat.toFixed(4)}° N, ${gps.lng.toFixed(4)}° W`,
      confidence: `${typeof topConfidence === 'number' && topConfidence <= 1 ? Math.round(topConfidence * 100) : topConfidence}%`,
      image: photoBase64
        ? `data:image/jpeg;base64,${photoBase64}`
        : 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Smart Clustering: update existing nearby hazard if within 45m, else add new
    setHazards((prev) => {
      const nearbyIdx = prev.findIndex(
        (h) => getDistanceMeters(h.lat, h.lng, gps.lat, gps.lng) <= 45
      );
      if (nearbyIdx >= 0) {
        const updated = [...prev];
        const existing = updated[nearbyIdx];
        updated[nearbyIdx] = {
          ...existing,
          title: gps.address || existing.title,
          detectedTime: 'Just now',
          confidence: `${typeof topConfidence === 'number' && topConfidence <= 1 ? Math.round(topConfidence * 100) : topConfidence}%`,
          image: photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : existing.image,
          severity: isCritical || existing.severity === 'critical' ? 'critical' : 'moderate',
        };
        return updated;
      }
      return [newHazard, ...prev];
    });

    // Also auto-append to scan history
    setHistory((prev) => [
      {
        ...detectionData,
        user_id: user?.id,
        user_email: user?.email,
        timestamp: `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        analysisTime: '0.08',
      },
      ...prev,
    ]);

    // Send to backend SQLite API
    if (isApiOnline && apiUrl) {
      try {
        const clean = apiUrl.replace(/\/+$/, '');
        fetch(`${clean}/api/hazards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: JSON.stringify(newHazard),
        }).catch(() => {});

        fetch(`${clean}/api/history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: JSON.stringify({
            ...detectionData,
            user_id: user?.id,
            user_email: user?.email,
            analysisTime: '0.08',
            gps: currentGps,
          }),
        }).catch(() => {});
      } catch {
        // Non-blocking
      }
    }
  }, [currentGps, isApiOnline, apiUrl, user]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('pothole_scan_history');
    if (isApiOnline && apiUrl && user?.email) {
      const clean = apiUrl.replace(/\/+$/, '');
      fetch(`${clean}/api/history?user_email=${encodeURIComponent(user.email)}`, {
        method: 'DELETE',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true',
        },
      }).catch(() => {});
    }
    showToast('Scan history cleared!', 'info');
  }, [isApiOnline, apiUrl, user, showToast]);

  const handleDeleteHazard = useCallback(async (hazardId) => {
    setHazards((prev) => prev.filter((h) => h.id !== hazardId));
    if (isApiOnline && apiUrl) {
      try {
        const clean = apiUrl.replace(/\/+$/, '');
        const res = await fetch(`${clean}/api/hazards/${hazardId}`, {
          method: 'DELETE',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
          },
        });
        if (res.ok) {
          showToast('Hazard pin deleted from map & database!', 'success');
        } else {
          showToast('Pin removed locally.', 'info');
        }
      } catch (err) {
        console.error('Failed to delete hazard pin on backend:', err);
        showToast('Pin removed locally.', 'info');
      }
    } else {
      showToast('Hazard pin removed from map!', 'success');
    }
  }, [isApiOnline, apiUrl, showToast]);

  const handleNavigate = useCallback((view) => {
    if (view === 'admin' && user?.role !== 'admin') {
      showToast('Access Denied: Administrator role required', 'error');
      return;
    }
    if (view === 'scan') {
      setResults(null);
    }
    setCurrentView(view);
  }, [user?.role, showToast]);

  return (
    <ClickSpark
      sparkColor="#f59e0b"
      sparkSize={10}
      sparkRadius={22}
      sparkCount={8}
      duration={400}
    >
      <div className={`min-h-screen flex flex-col ${currentView === 'map' ? 'h-screen overflow-hidden pb-[60px] md:pb-0' : 'pb-[80px] md:pb-0'} bg-[#0a0e17] text-slate-100 relative selection:bg-amber-500 selection:text-slate-950 font-body`}>
        <Toast toast={toast} onClose={handleCloseToast} />

        <Header
          user={user}
          onLogout={handleLogout}
          currentView={currentView === 'results' ? 'scan' : currentView}
          onNavigate={handleNavigate}
          isApiOnline={isApiOnline}
          apiUrl={apiUrl}
          onInstallApp={handleInstallApp}
        />

        {currentView === 'scan' && (
          <ScanView
            onDetectionComplete={handleDetectionComplete}
            onAutoLogHazard={handleAutoLogHazard}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            apiUrl={apiUrl}
            currentGps={currentGps}
            isGpsTracking={isGpsTracking}
            isSimulating={isSimulating}
            onStartGps={startGpsTracking}
            onStopGps={stopGpsTracking}
            onToggleSimulation={toggleSimulation}
            hazards={hazards}
            onNavigateToMap={() => handleNavigate('map')}
            showToast={showToast}
          />
        )}

        {currentView === 'results' && (
          <ResultsView
            results={results}
            analysisTime={analysisTime}
            onBack={handleBack}
            onSaveToHistory={handleSaveToHistory}
            onNavigateToMap={() => handleNavigate('map')}
            showToast={showToast}
          />
        )}

        {currentView === 'admin' && user?.role === 'admin' && (
          <AdminDashboardView
            apiUrl={apiUrl}
            user={user}
            showToast={showToast}
            onNavigateToMap={() => handleNavigate('map')}
            onDeleteHazard={handleDeleteHazard}
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            history={history}
            hazards={hazards}
            apiUrl={apiUrl}
            user={user}
            onNavigateToReport={() => handleNavigate('report')}
            showToast={showToast}
          />
        )}

        {currentView === 'report' && (
          <ReportView
            history={history}
            hazards={hazards}
            user={user}
            onNavigateToMap={() => handleNavigate('map')}
            showToast={showToast}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            history={history}
            hazards={hazards}
            onClearHistory={handleClearHistory}
            onNavigateToMap={() => handleNavigate('map')}
            onNavigateToReport={() => handleNavigate('report')}
            showToast={showToast}
          />
        )}

        {currentView === 'map' && (
          <MapView
            hazards={hazards}
            currentGps={currentGps}
            isGpsTracking={isGpsTracking}
            isSimulating={isSimulating}
            onStartGps={startGpsTracking}
            onStopGps={stopGpsTracking}
            onToggleSimulation={toggleSimulation}
            onDeleteHazard={handleDeleteHazard}
            user={user}
            showToast={showToast}
          />
        )}

        {currentView === 'login' && (
          <LoginView
            onLogin={handleLogin}
            onNavigate={handleNavigate}
            showToast={showToast}
            apiUrl={apiUrl}
          />
        )}

        {currentView === 'signup' && (
          <SignupView
            onSignup={handleSignup}
            onNavigate={handleNavigate}
            showToast={showToast}
            apiUrl={apiUrl}
          />
        )}

        {currentView === 'forgot-password' && (
          <ForgotPasswordView
            onNavigate={handleNavigate}
            showToast={showToast}
          />
        )}

        <BottomNav
          user={user}
          currentView={currentView === 'results' ? 'scan' : currentView}
          onNavigate={handleNavigate}
        />

        {/* Mobile APK & App Install Modal */}
        <InstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
          deferredPrompt={deferredPrompt}
          onPwaInstall={handlePwaInstallDirect}
          showToast={showToast}
        />
      </div>
    </ClickSpark>
  );
}

export default App;

