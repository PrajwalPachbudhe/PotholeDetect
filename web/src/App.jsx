import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ScanView from './components/ScanView';
import ResultsView from './components/ResultsView';
import AnalyticsView from './components/AnalyticsView';
import HistoryView from './components/HistoryView';
import ReportView from './components/ReportView';
import MapView from './components/MapView';
import LoginView from './components/LoginView';
import SignupView from './components/SignupView';
import ForgotPasswordView from './components/ForgotPasswordView';
import Toast from './components/Toast';
import ClickSpark from './components/ClickSpark';
import { useGeolocation } from './utils/useGeolocation';
import { getDistanceMeters } from './utils/clusterHazards';

const FIXED_API_URL = 'https://oversleep-relic-stubbed.ngrok-free.dev';

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
  },
  {
    id: 'PTH-650D',
    title: 'Wilshire & Hope Intersection',
    lat: 34.0498,
    lng: -118.2580,
    severity: 'moderate',
    detectedTime: 'Yesterday, 4:20 PM',
    coordsText: '34.0498° N, 118.2580° W',
    confidence: '82.0%',
    image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'PTH-512E',
    title: 'Sunset Highway Mile 12',
    lat: 34.0570,
    lng: -118.2400,
    severity: 'critical',
    detectedTime: 'Yesterday, 2:10 PM',
    coordsText: '34.0570° N, 118.2400° W',
    confidence: '97.1%',
    image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'PTH-403F',
    title: 'Olympic Blvd Overpass',
    lat: 34.0420,
    lng: -118.2550,
    severity: 'moderate',
    detectedTime: '2 Days Ago',
    coordsText: '34.0420° N, 118.2550° W',
    confidence: '89.4%',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600&auto=format&fit=crop',
  },
];

function App() {
  const [currentView, setCurrentView] = useState('scan');
  const [results, setResults] = useState(null);
  const [analysisTime, setAnalysisTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Global Hazards State (synced across Map, Scanner, and localStorage)
  const [hazards, setHazards] = useState(() => {
    try {
      const saved = localStorage.getItem('pothole_hazards_list');
      return saved ? JSON.parse(saved) : DEFAULT_HAZARDS;
    } catch {
      return DEFAULT_HAZARDS;
    }
  });

  // History State
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('pothole_scan_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Hardcoded production AI Backend URL
  const apiUrl = FIXED_API_URL;
  const [isApiOnline, setIsApiOnline] = useState(true);

  // Auth state
  const [user, setUser] = useState({
    name: 'Inspector Alex',
    email: 'officer@city.gov',
    role: 'Road Safety Officer',
  });

  // Toast state
  const [toast, setToast] = useState(null);

  // Geolocation & Road Simulation Engine
  const {
    coords: currentGps,
    isTracking: isGpsTracking,
    isSimulating,
    startTracking: startGpsTracking,
    stopTracking: stopGpsTracking,
    toggleSimulation,
  } = useGeolocation();

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const handleCloseToast = useCallback(() => {
    setToast(null);
  }, []);

  // Periodic Backend Health Check & Fetch Remote Hazards
  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const clean = apiUrl.replace(/\/+$/, '');
        const res = await fetch(`${clean}/api/health`, {
          method: 'GET',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
          },
          signal: AbortSignal.timeout(4000),
        });
        if (isMounted) {
          setIsApiOnline(res.ok);
        }

        // Fetch remote hazards if available
        if (res.ok) {
          try {
            const hRes = await fetch(`${clean}/api/hazards`, {
              headers: {
                'ngrok-skip-browser-warning': 'true',
                'Bypass-Tunnel-Reminder': 'true',
              },
              signal: AbortSignal.timeout(3000),
            });
            if (hRes.ok) {
              const hData = await hRes.json();
              if (hData.hazards && hData.hazards.length > 0 && isMounted) {
                setHazards((prev) => {
                  const existingIds = new Set(prev.map((h) => h.id));
                  const newItems = hData.hazards.filter((h) => !existingIds.has(h.id));
                  return [...newItems, ...prev];
                });
              }
            }
          } catch {
            // Non-blocking
          }
        }
      } catch {
        if (isMounted) {
          setIsApiOnline(false);
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl]);

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

  const handleLogin = useCallback((loggedInUser) => {
    setUser(loggedInUser);
    setCurrentView('scan');
  }, []);

  const handleSignup = useCallback((newUser) => {
    setUser(newUser);
    setCurrentView('scan');
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
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

    setHistory((prev) => [
      {
        ...data,
        analysisTime: elapsed,
        timestamp,
      },
      ...prev,
    ]);

    showToast('Saved to scan history!', 'success');
  }, [showToast]);

  // Automated Geotagged Pothole Logging (Called when a pothole is detected during live camera or upload)
  const handleAutoLogHazard = useCallback((detectionData) => {
    if (!detectionData || detectionData.total_detections === 0) return;

    const gps = detectionData.gps || currentGps;
    const isCritical = (detectionData.total_detections || 0) >= 3;
    const topConfidence = detectionData.detections?.[0]?.confidence || 92;
    const photoBase64 = detectionData.annotated || detectionData.original;

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newHazard = {
      id: `PTH-${randomSuffix}`,
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
        timestamp: `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        analysisTime: '0.12',
      },
      ...prev,
    ]);

    // Send to backend API if online
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
      } catch {
        // Non-blocking
      }
    }
  }, [currentGps, isApiOnline, apiUrl]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('pothole_scan_history');
  }, []);

  const handleNavigate = useCallback((view) => {
    if (view === 'scan') {
      setResults(null);
    }
    setCurrentView(view);
  }, []);

  return (
    <ClickSpark
      sparkColor="#f59e0b"
      sparkSize={10}
      sparkRadius={22}
      sparkCount={8}
      duration={400}
    >
      <div className="min-h-screen flex flex-col pb-[80px] md:pb-0 bg-[#0a0e17] text-slate-100 relative selection:bg-amber-500 selection:text-slate-950 font-body">
        <Toast toast={toast} onClose={handleCloseToast} />

        <Header
          user={user}
          onLogout={handleLogout}
          currentView={currentView === 'results' ? 'scan' : currentView}
          onNavigate={handleNavigate}
          isApiOnline={isApiOnline}
          apiUrl={apiUrl}
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

        {currentView === 'analytics' && (
          <AnalyticsView
            history={history}
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
            showToast={showToast}
          />
        )}

        {currentView === 'login' && (
          <LoginView
            onLogin={handleLogin}
            onNavigate={handleNavigate}
            showToast={showToast}
          />
        )}

        {currentView === 'signup' && (
          <SignupView
            onSignup={handleSignup}
            onNavigate={handleNavigate}
            showToast={showToast}
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
      </div>
    </ClickSpark>
  );
}

export default App;
