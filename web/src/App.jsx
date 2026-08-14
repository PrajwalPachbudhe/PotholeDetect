import { useState, useCallback } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ScanView from './components/ScanView';
import ResultsView from './components/ResultsView';
import HistoryView from './components/HistoryView';
import LoginView from './components/LoginView';
import SignupView from './components/SignupView';
import ForgotPasswordView from './components/ForgotPasswordView';
import MapView from './components/MapView';
import Toast from './components/Toast';
import ClickSpark from './components/ClickSpark';

function App() {
  const [currentView, setCurrentView] = useState('scan');
  const [results, setResults] = useState(null);
  const [analysisTime, setAnalysisTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Auth state
  const [user, setUser] = useState({
    name: 'Inspector Alex',
    email: 'officer@city.gov',
    role: 'Road Safety Officer',
  });

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const handleCloseToast = useCallback(() => {
    setToast(null);
  }, []);

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
    const timestamp = now.toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric' 
    }) + ', ' + now.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit' 
    });

    setHistory(prev => [{
      ...data,
      analysisTime: elapsed,
      timestamp,
    }, ...prev]);

    showToast('Saved to scan history!', 'success');
    setCurrentView('history');
  }, [showToast]);

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
      <div className="min-h-screen flex flex-col pb-[80px] md:pb-0 bg-[#0a0e17] text-slate-100 relative selection:bg-amber-500 selection:text-slate-950">
        <Toast toast={toast} onClose={handleCloseToast} />

        <Header 
          user={user}
          onLogout={handleLogout}
          currentView={currentView === 'results' ? 'scan' : currentView} 
          onNavigate={handleNavigate} 
        />

        {currentView === 'scan' && (
          <ScanView
            onDetectionComplete={handleDetectionComplete}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        )}

        {currentView === 'results' && (
          <ResultsView
            results={results}
            analysisTime={analysisTime}
            onBack={handleBack}
            onSaveToHistory={handleSaveToHistory}
          />
        )}

        {currentView === 'history' && (
          <HistoryView history={history} />
        )}

        {currentView === 'map' && (
          <MapView showToast={showToast} />
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
