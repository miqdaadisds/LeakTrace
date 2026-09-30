import React from 'react';
import { Shield, Lock, Cpu, Database, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, systemStatus }) {
  const tabs = [
    { id: 'publish', label: '1. Document Distribution', icon: Lock, badge: 'PQC Envelope' },
    { id: 'decrypt', label: '2. Recipient Workstation', icon: Cpu, badge: 'Dynamic Attribution' },
    { id: 'forensics', label: '3. Forensic Leak Lab', icon: AlertTriangle, badge: 'Mathematical Proof' },
    { id: 'ledger', label: '4. Provenance Blockchain', icon: Database, badge: 'Merkle Ledger' },
  ];

  return (
    <header className="border-b border-navy-700 bg-navy-950/80 backdrop-blur sticky top-0 z-50">
      {/* Top Defence Clearance Banner */}
      <div className="bg-navy-900 border-b border-navy-800 px-4 py-1 text-xs flex flex-wrap justify-between items-center text-slate-400 font-mono">
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-defence-gold/20 text-defence-gold border border-defence-gold/30">
            MINISTRY OF DEFENCE (WESEE)
          </span>
          <span className="hidden sm:inline">SMART INDIA HACKATHON 2026 // PROBLEM STATEMENT #26237</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>PQC ML-KEM-768 ACTIVE</span>
          </span>
          <span className="hidden md:inline text-slate-500">|</span>
          <span className="hidden md:inline text-slate-300">
            CHAIN INTEGRITY: <span className="text-emerald-400 font-semibold">100% VERIFIED</span>
          </span>
        </div>
      </div>

      {/* Main Brand Title & Nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-navy-800 border border-navy-600 gold-glow">
            <Shield className="w-7 h-7 text-defence-gold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white uppercase">
                WESEE Cryptographic Provenance Suite
              </h1>
              <span className="text-xs font-mono bg-navy-800 text-defence-cyan px-2 py-0.5 rounded border border-navy-700">
                v1.0.0-DEF
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic Multi-Recipient Attribution & Merkle Decryption Ledger
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 bg-navy-900/90 p-1.5 rounded-xl border border-navy-800 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-defence-gold text-navy-950 font-bold shadow-md shadow-defence-gold/20'
                    : 'text-slate-300 hover:text-white hover:bg-navy-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-navy-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
