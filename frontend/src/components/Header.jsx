import React from 'react';
import { Shield, Lock, Cpu, Search, Database, WifiOff, Play, CheckCircle2 } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, onRunQuickDemo, isRunningDemo }) {
  const navItems = [
    { id: 'publish', label: '1. Distribute', icon: Lock },
    { id: 'decrypt', label: '2. Decrypt & Mark', icon: Cpu },
    { id: 'forensics', label: '3. Forensic Lab', icon: Search },
    { id: 'ledger', label: '4. Ledger', icon: Database },
  ];

  return (
    <header className="sticky top-0 z-50 apple-glass transition-all border-b border-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Shield className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold text-slate-900 tracking-tight">NISHAN-PQ</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                SIH26237
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Ministry of Defence &bull; WESEE Indian Navy
            </p>
          </div>
        </div>

        {/* Minimalist Apple Pill Tabs */}
        <nav className="flex space-x-1 bg-slate-200/60 p-1 rounded-full backdrop-blur-md border border-white/40">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Live Demo & Air-Gapped Pill */}
        <div className="flex items-center space-x-2.5">
          <div className="hidden lg:flex items-center space-x-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/70 font-semibold">
            <WifiOff className="w-3 h-3 text-emerald-600" />
            <span>Air-Gapped</span>
          </div>

          <button
            onClick={onRunQuickDemo}
            disabled={isRunningDemo}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-full shadow-sm hover:shadow transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Play className={`w-3 h-3 fill-current ${isRunningDemo ? 'animate-spin' : ''}`} />
            <span>{isRunningDemo ? 'Running...' : 'Run 90s Live Demo'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
