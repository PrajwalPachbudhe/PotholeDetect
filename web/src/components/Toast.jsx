import { useEffect } from 'react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';

  const iconName = isError ? 'error' : isInfo ? 'info' : 'check_circle';
  const borderColor = isError
    ? 'border-red-500/40'
    : isInfo
    ? 'border-cyan-500/40'
    : 'border-amber-500/40';
  const iconColor = isError
    ? 'text-red-400'
    : isInfo
    ? 'text-cyan-400'
    : 'text-amber-400';
  const glowShadow = isError
    ? 'shadow-[0_0_25px_rgba(239,68,68,0.25)]'
    : isInfo
    ? 'shadow-[0_0_25px_rgba(6,182,212,0.25)]'
    : 'shadow-[0_0_25px_rgba(245,158,11,0.25)]';

  return (
    <div className="fixed top-4 sm:top-20 left-4 right-4 sm:left-auto sm:right-6 z-[9999] animate-bounce-in max-w-sm sm:max-w-md mx-auto pointer-events-auto shadow-2xl">
      <div className={`flex items-center gap-3 bg-[#111827]/98 backdrop-blur-2xl text-slate-100 border ${borderColor} px-4 py-3 rounded-xl ${glowShadow} shadow-2xl transition-all`}>
        <span className={`material-symbols-outlined ${iconColor} text-xl flex-shrink-0`}>
          {iconName}
        </span>
        <div className="flex-1 text-xs sm:text-sm font-semibold pr-2 select-text">
          {toast.message}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/60 flex-shrink-0"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  );
}
