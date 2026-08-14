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
    <div className="fixed top-20 right-6 z-[100] animate-bounce-in max-w-sm">
      <div className={`flex items-center gap-3 bg-[#111827]/95 backdrop-blur-md text-slate-100 border ${borderColor} px-4 py-3.5 rounded-xl ${glowShadow} shadow-2xl transition-all`}>
        <span className={`material-symbols-outlined ${iconColor} text-xl flex-shrink-0`}>
          {iconName}
        </span>
        <div className="flex-1 text-sm font-medium pr-2">
          {toast.message}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/60"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  );
}
