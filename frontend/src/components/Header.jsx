import React from 'react';
import { Shield, Lock, FileSearch, Database, Cpu, WifiOff, Sparkles } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'publish', label: '1. Distribute', icon: Lock },
    { id: 'decrypt', label: '2. Decrypt & Mark', icon: Cpu },
    { id: 'forensics', label: '3. Forensic Trace', icon: FileSearch },
    { id: 'ledger', label: '4. Provenance Ledger', icon: Database },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 transition-all">
      {/* Air-Gapped MoD Verification Sub-bar */}
      <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-1 text-[11px] font-medium text-slate-600 flex justify-between items-center">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center px-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800 tracking-wide">MINISTRY OF DEFENCE &bull; WESEE</span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="hidden sm:inline text-slate-500">SIH 2026 Problem Statement #26237</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 font-semibold">
              <WifiOff className="w-3 h-3 text-emerald-600" />
              <span>100% AIR-GAPPED &bull; NO CLOUD KMS</span>
            </span>
            <span className="hidden md:flex items-center space-x-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60 font-semibold">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>NIST FIPS 203 / 204 PQC</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Header Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                NISHAN-PQ
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                PROTOTYPE MVP
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Cryptographic Attribution & Immutable Decryption Provenance
            </p>
          </div>
        </div>

        {/* Minimalist Apple Pill Tabs */}
        <nav className="flex space-x-1 bg-slate-100/90 p-1 rounded-full border border-slate-200/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
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
      </div>
    </header>
  );
}
