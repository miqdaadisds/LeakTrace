import React from 'react';
import { ArrowRight, Lock, Cpu, Search, Sparkles } from 'lucide-react';

export default function JudgeDemoGuide({ activeTab, setActiveTab }) {
  const steps = [
    { id: 'publish', num: '1', label: 'Distribute (Encrypt Once)', icon: Lock },
    { id: 'decrypt', num: '2', label: 'Decrypt as Bob (Watermark Injected)', icon: Cpu },
    { id: 'forensics', num: '3', label: 'Forensic Lab (Catch Leaker)', icon: Search },
  ];

  return (
    <div className="apple-glass-card p-3 sm:p-3.5 mb-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
      <div className="flex items-center space-x-2 text-slate-700 font-medium">
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200/60 text-[11px]">
          <Sparkles className="w-3 h-3 text-blue-600" />
          <span>Interactive Proof-of-Work</span>
        </span>
        <span className="hidden sm:inline text-slate-400">&bull;</span>
        <span className="text-slate-600 hidden sm:inline">Follow the 3-step live cryptographic verification:</span>
      </div>

      <div className="flex items-center space-x-2">
        {steps.map((s, idx) => {
          const isActive = activeTab === s.id;
          const Icon = s.icon;
          return (
            <React.Fragment key={s.id}>
              <button
                onClick={() => setActiveTab(s.id)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/60'
                }`}
              >
                <span>{s.num}.</span>
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.num}</span>
              </button>
              {idx < steps.length - 1 && (
                <ArrowRight className="w-3 h-3 text-slate-400 hidden sm:inline" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
