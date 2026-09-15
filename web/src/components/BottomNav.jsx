export default function BottomNav({ user, currentView, onNavigate }) {
  const navItems = [
    { id: 'scan', icon: 'radar', label: 'Scan' },
    { id: 'map', icon: 'map', label: 'Map' },
    ...(user?.role === 'admin' ? [{ id: 'admin', icon: 'admin_panel_settings', label: 'Admin' }] : []),
    { id: 'report', icon: 'description', label: 'Report' },
    { id: 'analytics', icon: 'insights', label: 'Stats' },
    { id: 'history', icon: 'history', label: 'History' },
  ];

  return (
    <nav className="md:hidden bg-[#0a0e17]/95 backdrop-blur-2xl fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/90 flex justify-around items-center px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.7)] select-none">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-90 ${
              isActive
                ? 'text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`w-9 h-7 rounded-lg flex items-center justify-center transition-all ${
              isActive ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]' : ''
            }`}>
              <span className="material-symbols-outlined text-lg" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {item.icon}
              </span>
            </div>
            <span className="text-[9px] font-mono tracking-tight mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
