import React from 'react';
import { Play, CheckCircle2, Shield, Lock, Search, Database, ArrowRight } from 'lucide-react';

export default function JudgeDemoGuide({ activeTab, setActiveTab, onRunQuickDemo, isRunningDemo }) {
  const steps = [
    {
      id: 'publish',
      number: '1',
      title: 'Distribute (Encrypt Once)',
      desc: 'Single AES-256 payload with ML-KEM-768 wraps',
      icon: Lock,
    },
    {
      id: 'decrypt',
      number: '2',
      title: 'Decrypt & Watermark',
      desc: 'Invisible fingerprint + ML-DSA signed receipt',
      icon: Shield,
    },
    {
      id: 'forensics',
      number: '3',
      title: 'Trace & Verify',
      desc: 'Extract mark & prove leaker identity via ledger',
      icon: Search,
    },
    {
      id: 'ledger',
      number: '4',
      title: 'Immutable Ledger',
      desc: 'Air-gapped tamper-proof Merkle blockchain',
      icon: Database,
    },
  ];

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <span className="apple-badge bg-blue-50 text-blue-700 border border-blue-200/60">
              90-SECOND JUDGE WALKTHROUGH
            </span>
            <span className="text-xs text-slate-400 font-medium">SIH26237 Project &bull; NISHAN-PQ</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
            How to Judge This Prototype in 3 Simple Steps
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Encryption controls access (&ldquo;who can read this?&rdquo;). NISHAN-PQ adds cryptographic provenance (&ldquo;whose decrypted copy produced the leak?&rdquo;).
          </p>
        </div>

        {/* 1-Click Demo Launcher */}
        <button
          onClick={onRunQuickDemo}
          disabled={isRunningDemo}
          className="self-start md:self-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-2 disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isRunningDemo ? 'animate-spin' : ''}`} />
          <span>{isRunningDemo ? 'Simulating Pipeline...' : 'Run 1-Click Interactive Demo'}</span>
        </button>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
        {steps.map((s) => {
          const isActive = activeTab === s.id;
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              onClick={() => setActiveTab(s.id)}
              className={`cursor-pointer p-3 rounded-xl border transition-all text-left ${
                isActive
                  ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-sm'
                  : 'bg-slate-50/60 border-slate-200/70 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  STEP {s.number}
                </span>
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-xs font-semibold text-slate-800">{s.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{s.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
