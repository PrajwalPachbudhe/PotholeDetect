import { useState } from 'react';

export default function ForgotPasswordView({ onNavigate, showToast }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
      showToast('Password reset link sent to your email!', 'success');
    }, 1000);
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full max-w-md mx-auto relative z-10 my-auto">
      {/* Glow effect */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="w-full bg-[#111827]/85 backdrop-blur-xl border border-slate-800 hover:border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all relative overflow-hidden flex flex-col items-center text-center">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-cyan-400 to-amber-500" />

        {/* Icon Header */}
        <div className="w-20 h-20 mb-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.2)]">
          <span className="material-symbols-outlined text-4xl text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isSent ? 'mark_email_read' : 'lock_reset'}
          </span>
        </div>

        <h1 className="font-heading text-2xl md:text-3xl font-bold text-slate-100 mb-2">
          {isSent ? 'Check Your Inbox' : 'Reset Password'}
        </h1>

        <p className="text-sm text-slate-400 mb-6 px-2">
          {isSent
            ? `We sent a password reset link to ${email}. Please check your email to create a new password.`
            : "Enter your email address below and we'll send you instructions to reset your password."}
        </p>

        {!isSent ? (
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block" htmlFor="reset-email">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-xl">mail</span>
                </div>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@city.gov"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-base py-3.5 px-4 rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.5)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <span className="material-symbols-outlined text-xl">send</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="w-full space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">verified</span>
              Reset instructions dispatched successfully.
            </div>

            <button
              type="button"
              onClick={() => setIsSent(false)}
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors underline"
            >
              Didn't receive email? Try again
            </button>
          </div>
        )}

        {/* Back to Login */}
        <div className="mt-8 pt-4 border-t border-slate-800 w-full">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Login
          </button>
        </div>
      </div>
    </main>
  );
}
