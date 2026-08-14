import { useState } from 'react';
import ScrollVelocity from './ScrollVelocity';
import SpecularButton from './SpecularButton';

export default function Header({ user, onLogout, currentView, onNavigate }) {
  const [showMenu, setShowMenu] = useState(false);

  const navItems = [
    { id: 'scan', icon: 'photo_camera', label: 'Scan' },
    { id: 'history', icon: 'history', label: 'History' },
    { id: 'map', icon: 'map', label: 'Map' },
  ];

  return (
    <header className="bg-[#0a0e17]/90 backdrop-blur-md w-full sticky top-0 z-50 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 h-16">
      {/* Brand logo */}
      <div 
        onClick={() => onNavigate('scan')} 
        className="flex items-center gap-2 cursor-pointer group"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            analytics
          </span>
        </div>
        <div className="w-[170px] overflow-hidden">
          <ScrollVelocity
            texts={['PotholeDetect']}
            velocity={30}
            className="font-heading text-lg font-bold text-amber-400 pr-4"
            numCopies={2}
            damping={50}
            stiffness={400}
          />
        </div>
      </div>

      {/* Main Nav & User Profile */}
      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-3">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <SpecularButton
                key={item.id}
                size="sm"
                radius={10}
                tint="#f59e0b"
                tintOpacity={isActive ? 0.15 : 0}
                textColor={isActive ? '#fbbf24' : '#94a3b8'}
                lineColor="#f59e0b"
                baseColor="transparent"
                intensity={1.5}
                onClick={() => onNavigate(item.id)}
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <span className={`material-symbols-outlined text-lg ${isActive ? 'text-amber-400' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
              </SpecularButton>
            );
          })}
        </nav>

        {/* Authentication Button or User Menu */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 hover:border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-[11px] flex items-center justify-center uppercase">
                {user.name ? user.name[0] : 'U'}
              </div>
              <span className="max-w-[100px] truncate hidden sm:inline">{user.name}</span>
              <span className="material-symbols-outlined text-sm text-slate-400">expand_more</span>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div 
                className="absolute right-0 mt-2 w-48 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2"
                onMouseLeave={() => setShowMenu(false)}
              >
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </div>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onNavigate('scan');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  Scanner Dashboard
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onNavigate('history');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">history</span>
                  Scan History
                </button>

                <div className="border-t border-slate-800 my-1" />

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <SpecularButton
            size="sm"
            radius={10}
            tint="#f59e0b"
            tintOpacity={0.2}
            textColor="#fbbf24"
            lineColor="#f59e0b"
            baseColor="#f59e0b15"
            intensity={2}
            onClick={() => onNavigate('login')}
            className="flex items-center gap-1.5 px-3.5 py-1.5"
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span className="text-xs font-bold uppercase tracking-wider">Sign In</span>
          </SpecularButton>
        )}
      </div>
    </header>
  );
}
