import { useState } from 'react';

export default function InstallModal({ isOpen, onClose, deferredPrompt, onPwaInstall, showToast }) {
  if (!isOpen) return null;

  const APK_DOWNLOAD_URL = 'https://github.com/PrajwalPachbudhe/PotholeDetect/releases/download/mobile-apk-latest/PotholeDetect.apk';

  const handleDownloadApk = () => {
    showToast?.('Starting PotholeDetect.apk download...', 'info');
    const link = document.createElement('a');
    link.href = APK_DOWNLOAD_URL;
    link.setAttribute('download', 'PotholeDetect.apk');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#111827] border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <span className="material-symbols-outlined text-2xl">android</span>
            </div>
            <div>
              <h3 className="text-base font-bold font-heading text-slate-100">
                Install Mobile Android App
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Standalone Native App & WebAPK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Option 1: Direct Android APK Download */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-lg">download</span>
              <span className="text-xs font-bold text-slate-100">
                Direct Android APK File (.apk)
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold uppercase">
              Native APK
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Download the raw APK installer file directly to your phone storage and install natively.
          </p>
          <button
            onClick={handleDownloadApk}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 active:scale-95"
          >
            <span className="material-symbols-outlined text-base">download_for_offline</span>
            Download PotholeDetect.apk
          </button>
        </div>

        {/* Option 2: Chrome WebAPK / PWA Instant Install */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400 text-lg">flash_on</span>
              <span className="text-xs font-bold text-slate-100">
                Chrome WebAPK Instant Install
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[9px] font-mono font-bold uppercase">
              No Download Needed
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Installs directly from Google Chrome into your app drawer with 0 storage usage.
          </p>
          <button
            onClick={() => {
              onPwaInstall?.();
              onClose();
            }}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-cyan-400">install_mobile</span>
            Install via Browser
          </button>
        </div>

        {/* Installation Instructions */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-[10px] font-mono text-slate-400 space-y-1">
          <p className="font-bold text-slate-300">📲 APK Install Steps:</p>
          <p>1. Tap "Download PotholeDetect.apk".</p>
          <p>2. Open your notification bar or Downloads folder.</p>
          <p>3. Tap the file and select "Install" (Allow Chrome to install apps if prompted).</p>
        </div>
      </div>
    </div>
  );
}
