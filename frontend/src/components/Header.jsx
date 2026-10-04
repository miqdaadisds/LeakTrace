import React from 'react';
import { Unlock, Search, LogOut, User, Lock, Database, ShieldAlert, Key } from 'lucide-react';
import logo from '../assets/logo.png';
import { playTabSwitch, playClick } from '../utils/soundEffects';

export default function Header({ activeTab, setActiveTab, showAdmin, setShowAdmin, user, onLogout, connectionStatus = 'connected' }) {
  const role = user?.role || 'recipient';
  const isAdmin = role === 'admin';
  const isSender = role === 'sender' || isAdmin;
  const isInvestigator = role === 'investigator' || isAdmin;

  const handleTab = (tab) => {
    playTabSwitch();
    setActiveTab(tab);
    if (setShowAdmin) setShowAdmin(false);
  };

  const handleSignOut = () => {
    playClick();
    onLogout();
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/60 shadow-xs transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <img src={logo} alt="TraceLeak" className="w-8 h-8 rounded-xl object-contain drop-shadow-sm transition-transform duration-300 hover:scale-105" />
          <div className="flex items-center space-x-2">
            <span className="text-base font-extrabold text-slate-900 tracking-tight">TraceLeak</span>
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-900 text-white shadow-xs">v1.1</span>
            {connectionStatus === 'connected' && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Connected</span>
              </span>
            )}
            {connectionStatus === 'connecting' && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>Syncing...</span>
              </span>
            )}
            {connectionStatus === 'offline' && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>Air-Gapped</span>
              </span>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/80 shadow-inner">
          <button
            onClick={() => handleTab('decrypt')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
              activeTab === 'decrypt'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Unlock className={`w-3.5 h-3.5 ${activeTab === 'decrypt' ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>Decrypt</span>
          </button>

          {isSender && (
            <button
              onClick={() => handleTab('distribute')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'distribute'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Lock className={`w-3.5 h-3.5 ${activeTab === 'distribute' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>Encrypt & Distribute</span>
            </button>
          )}

          {isInvestigator && (
            <button
              onClick={() => handleTab('investigate')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'investigate'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Search className={`w-3.5 h-3.5 ${activeTab === 'investigate' ? 'text-purple-600' : 'text-slate-500'}`} />
              <span>Investigate</span>
            </button>
          )}

          {(isAdmin || isInvestigator) && (
            <button
              onClick={() => handleTab('provenance')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'provenance'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Database className={`w-3.5 h-3.5 ${activeTab === 'provenance' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>Audit Ledger</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => handleTab('security')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'security'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${activeTab === 'security' ? 'text-amber-600' : 'text-slate-500'}`} />
              <span>Tamper Defense</span>
            </button>
          )}
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200/60 shadow-xs">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-800">{user?.name}</span>
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-700 uppercase tracking-wider">{role}</span>
          </div>

          {isAdmin && (
            <button
              onClick={() => handleTab('identities')}
              className={`p-2 rounded-full transition-all duration-200 border ${
                activeTab === 'identities' 
                  ? 'bg-white text-slate-900 border-slate-200 shadow-xs' 
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white/60 border-transparent'
              }`}
              title="Identity & Key Management"
            >
              <Key className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
