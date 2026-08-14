import { useState } from 'react';

export default function SignupView({ onSignup, onNavigate, showToast }) {
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-700' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 25, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 50, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score: 75, label: 'Good', color: 'bg-yellow-400' };
    return { score: 100, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Please enter your full name', 'error');
      return;
    }
    if (!contact.trim()) {
      showToast('Please enter your phone number or email', 'error');
      return;
    }
    if (!password || password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (!agreeTerms) {
      showToast('You must agree to the Terms of Service', 'error');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const user = {
        name: fullName.trim(),
        email: contact.includes('@') ? contact : `${fullName.toLowerCase().replace(/\s+/g, '')}@city.gov`,
        role: 'Community Reporter',
      };
      onSignup(user);
      showToast('Account created successfully! Welcome aboard.', 'success');
    }, 1000);
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full max-w-md mx-auto relative z-10 my-auto">
      {/* Background glow elements */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="w-full bg-[#111827]/85 backdrop-blur-xl border border-slate-800 hover:border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all relative overflow-hidden">
        {/* Top Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-amber-400 to-amber-500" />

        {/* Logo / Header */}
        <div className="flex flex-col items-center pt-2 pb-6 text-center">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-amber-400 text-3xl">
              person_add
            </span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-slate-100 tracking-tight">
            Create <span className="text-amber-400">Account</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 px-2">
            Join the movement to fix our streets.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block" htmlFor="fullName">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-xl">person</span>
              </div>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Contact (Phone / Email) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block" htmlFor="contact">
              Phone Number or Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-xl">contact_mail</span>
              </div>
              <input
                id="contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone Number or Email"
                className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block" htmlFor="signup-password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-xl">lock</span>
              </div>
              <input
                id="signup-password"
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
            {/* Strength indicator */}
            {password && (
              <div className="pt-1.5 space-y-1">
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400">
                  <span>Password Strength</span>
                  <span className={strength.color.replace('bg-', 'text-')}>{strength.label}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${strength.color} transition-all duration-300`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Terms checkbox */}
          <div className="flex items-center pt-2">
            <input
              id="terms"
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="h-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="terms" className="ml-2.5 text-xs text-slate-400 cursor-pointer select-none">
              I agree to the <span className="text-slate-200 underline font-medium hover:text-amber-400">Terms of Service</span> and <span className="text-slate-200 underline font-medium hover:text-amber-400">Privacy Policy</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-base py-3.5 px-4 rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.5)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Sign In link */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="font-bold text-amber-400 hover:text-amber-300 transition-colors ml-1"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
