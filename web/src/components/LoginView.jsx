import { useState } from 'react';

export default function LoginView({ onLogin, onNavigate, showToast }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      showToast('Please enter your email or ID', 'error');
      return;
    }
    if (!password) {
      showToast('Please enter your password', 'error');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const user = {
        name: identifier.includes('@') ? identifier.split('@')[0] : identifier,
        email: identifier.includes('@') ? identifier : `${identifier}@city.gov`,
        role: 'Road Safety Officer',
      };
      onLogin(user);
      showToast(`Welcome back, ${user.name}!`, 'success');
    }, 800);
  };

  const handleQuickDemo = () => {
    setIdentifier('officer@city.gov');
    setPassword('demo1234');
    showToast('Demo credentials filled!', 'info');
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full max-w-md mx-auto relative z-10 my-auto">
      {/* Glow background backdrop */}
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="w-full bg-[#111827]/85 backdrop-blur-xl border border-slate-800 hover:border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all relative overflow-hidden">
        {/* Subtle accent bar at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-500" />

        {/* Header / Logo */}
        <div className="flex flex-col items-center pt-2 pb-6 text-center">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-amber-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              analytics
            </span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-slate-100 tracking-tight">
            Pothole<span className="text-amber-400">Detect</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Improve your city, together
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email / ID Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block" htmlFor="identifier">
              Email or ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-xl">person</span>
              </div>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter ID or Email"
                className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-xl">lock</span>
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-11 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-base py-3.5 px-4 rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.5)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </>
            )}
          </button>

          {/* Nav Links */}
          <div className="flex items-center justify-between pt-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-slate-400 hover:text-amber-400 transition-colors"
            >
              Forgot Password?
            </button>
            <button
              type="button"
              onClick={() => onNavigate('signup')}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              Create Account
            </button>
          </div>
        </form>

        {/* Quick Demo Login Option */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={handleQuickDemo}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-cyan-500/30"
          >
            <span className="material-symbols-outlined text-sm text-cyan-400">bolt</span>
            Fill Demo Credentials
          </button>
        </div>
      </div>
    </main>
  );
}
