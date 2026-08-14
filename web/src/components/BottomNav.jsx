import SpecularButton from './SpecularButton';

export default function BottomNav({ user, currentView, onNavigate }) {
  const navItems = [
    { id: 'scan', icon: 'photo_camera', label: 'Scan' },
    { id: 'history', icon: 'history', label: 'History' },
    { id: 'map', icon: 'map', label: 'Map' },
    { 
      id: user ? 'account' : 'login', 
      icon: user ? 'account_circle' : 'login', 
      label: user ? 'Account' : 'Sign In' 
    },
  ];

  return (
    <nav className="md:hidden bg-[#0a0e17]/95 backdrop-blur-lg fixed bottom-0 w-full z-50 rounded-t-2xl border-t border-slate-800 flex justify-around items-center px-4 pt-2 pb-safe-area-bottom shadow-[0_-5px_25px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const isActive = currentView === item.id || (item.id === 'account' && (currentView === 'login' || currentView === 'signup'));
        return (
          <SpecularButton
            key={item.id}
            size="sm"
            radius={12}
            tint="#f59e0b"
            tintOpacity={isActive ? 0.15 : 0}
            textColor={isActive ? '#fbbf24' : '#94a3b8'}
            lineColor="#f59e0b"
            baseColor="transparent"
            intensity={1.5}
            onClick={() => {
              if (item.id === 'account' && user) {
                // Navigate to history or open user prompt
                onNavigate('history');
              } else {
                onNavigate(item.id);
              }
            }}
            className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl"
          >
            <span className={`material-symbols-outlined text-2xl mb-0.5 ${isActive ? 'text-amber-400' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[10px] font-bold tracking-wider">{item.label}</span>
          </SpecularButton>
        );
      })}
    </nav>
  );
}
