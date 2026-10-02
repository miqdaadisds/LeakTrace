import React from 'react';
import { Shield, Unlock, Search, Settings, LogOut, User, Lock, Database, ShieldAlert, Key } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, showAdmin, setShowAdmin, user, onLogout }) {
  const role = user?.role || 'recipient';
  const isAdmin = role === 'admin';
  const isSender = role === 'sender' || isAdmin;
  const isInvestigator = role === 'investigator' || isAdmin;

  return (
    <header className="sticky top-0 z-50 liquid-glass border-b border-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <img src="/logo.png" alt="LeakTrace" className="w-8 h-8 rounded-xl object-contain drop-shadow-sm" />
          <div className="flex items-center space-x-2">
            <span className="text-base font-extrabold text-slate-900 tracking-tight">LeakTrace</span>
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-white/70 text-slate-700 border border-white/80 shadow-xs">SIH26237</span>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="flex items-center space-x-1 bg-slate-200/50 p-1 rounded-full border border-white/60 backdrop-blur-md">
          <button
            onClick={() => { setActiveTab('decrypt'); setShowAdmin(false); }}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'decrypt'
                ? 'liquid-pill-active font-bold text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Unlock className={`w-3.5 h-3.5 ${activeTab === 'decrypt' ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>Decrypt</span>
          </button>

          {isSender && (
            <button
              onClick={() => { setActiveTab('distribute'); setShowAdmin(false); }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'distribute'
                  ? 'liquid-pill-active font-bold text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Lock className={`w-3.5 h-3.5 ${activeTab === 'distribute' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>Encrypt & Distribute</span>
            </button>
          )}

          {isInvestigator && (
            <button
              onClick={() => { setActiveTab('investigate'); setShowAdmin(false); }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'investigate'
                  ? 'liquid-pill-active font-bold text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Search className={`w-3.5 h-3.5 ${activeTab === 'investigate' ? 'text-purple-600' : 'text-slate-500'}`} />
              <span>Investigate</span>
            </button>
          )}

          {/* Audit Ledger — Prominently visible for Admins & Investigators */}
          {(isAdmin || isInvestigator) && (
            <button
              onClick={() => { setActiveTab('provenance'); setShowAdmin(false); }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'provenance'
                  ? 'liquid-pill-active font-bold text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Database className={`w-3.5 h-3.5 ${activeTab === 'provenance' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>Audit Ledger</span>
            </button>
          )}

          {/* Security & Tamper Test — Prominently visible for Admins */}
          {isAdmin && (
            <button
              onClick={() => { setActiveTab('security'); setShowAdmin(false); }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'security'
                  ? 'liquid-pill-active font-bold text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${activeTab === 'security' ? 'text-amber-600' : 'text-slate-500'}`} />
              <span>Tamper Defense</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-2 bg-white/70 px-3 py-1.5 rounded-full border border-white/80 shadow-xs">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-800">{user?.name}</span>
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-700 uppercase">{role}</span>
          </div>

          {/* Admin toggle for Identities */}
          {isAdmin && (
            <button
              onClick={() => { setActiveTab('identities'); setShowAdmin(false); }}
              className={`p-2 rounded-full transition-all border ${
                activeTab === 'identities' 
                  ? 'bg-white text-slate-900 border-white/80 shadow-xs' 
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white/50 border-transparent'
              }`}
              title="Officer Directory & Key Vaults"
            >
              <Key className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onLogout}
            className="p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

