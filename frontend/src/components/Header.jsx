import React, { useState } from 'react';
import { Unlock, Search, LogOut, User, Lock, Database, Key, Sun, Moon, Radio } from 'lucide-react';
import logo from '../assets/logo.png';
import { playTabSwitch, playClick } from '../utils/soundEffects';
import EnclaveSwitcherModal from './EnclaveSwitcherModal';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  showAdmin, 
  setShowAdmin, 
  user, 
  onLogout, 
  connectionStatus = 'connected',
  theme = 'light',
  onToggleTheme,
  pendingCount = 0,
  onEnclaveChanged
}) {
  const [showEnclaveModal, setShowEnclaveModal] = useState(false);
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

  const handleTheme = () => {
    playClick();
    if (onToggleTheme) onToggleTheme();
  };

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800/80 shadow-xs transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-3.5 flex items-center justify-between">
          {/* Brand & Connection Pill */}
          <div className="flex items-center space-x-3">
            <img 
              src={logo} 
              alt="TraceLeak" 
              className="w-8 h-8 rounded-xl object-contain drop-shadow-sm transition-transform duration-300 hover:scale-105" 
            />
            <div className="flex items-center space-x-2">
              <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">TraceLeak</span>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-900 dark:bg-slate-700 text-white shadow-xs">v1.2</span>
              
              <button
                onClick={() => { playClick(); setShowEnclaveModal(true); }}
                className="group flex items-center transition-transform hover:scale-105"
                title="Click to view or switch Enclave connection"
              >
                {connectionStatus === 'connected' && (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-700/80 shadow-xs group-hover:border-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Connected</span>
                  </span>
                )}
                {connectionStatus === 'connecting' && (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-700/80 shadow-xs group-hover:border-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                    <span>Syncing...</span>
                  </span>
                )}
                {connectionStatus === 'offline' && (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs group-hover:border-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>Air-Gapped</span>
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Main Navigation - Balanced Apple-Style Segmented Tabs */}
          <div className="flex items-center space-x-1.5 bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
            <button
              onClick={() => handleTab('decrypt')}
              className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold w-28 sm:w-32 transition-transform transition-colors duration-150 transform hover:scale-[1.02] active:scale-95 ${
                activeTab === 'decrypt'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Unlock className={`w-3.5 h-3.5 ${activeTab === 'decrypt' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>Decrypt</span>
            </button>

            {isSender && (
              <button
                onClick={() => handleTab('distribute')}
                className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold w-28 sm:w-32 transition-transform transition-colors duration-150 transform hover:scale-[1.02] active:scale-95 ${
                  activeTab === 'distribute'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Lock className={`w-3.5 h-3.5 ${activeTab === 'distribute' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>Encrypt</span>
              </button>
            )}

            {isInvestigator && (
              <button
                onClick={() => handleTab('investigate')}
                className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold w-28 sm:w-32 transition-transform transition-colors duration-150 transform hover:scale-[1.02] active:scale-95 ${
                  activeTab === 'investigate'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Search className={`w-3.5 h-3.5 ${activeTab === 'investigate' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>Investigate</span>
              </button>
            )}

            {(isAdmin || isInvestigator) && (
              <button
                onClick={() => handleTab('provenance')}
                className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold w-28 sm:w-32 transition-transform transition-colors duration-150 transform hover:scale-[1.02] active:scale-95 ${
                  activeTab === 'provenance'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Database className={`w-3.5 h-3.5 ${activeTab === 'provenance' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>Ledger</span>
              </button>
            )}
          </div>

          {/* User Profile, Theme Toggle & Actions */}
          <div className="flex items-center space-x-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={handleTheme}
              className="p-2 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-xs"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* User Pill */}
            <div className="flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{user?.name}</span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                {role}
              </span>
            </div>

            {/* Admin Identities Icon with Realtime Badge */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => handleTab('identities')}
                  className={`p-2 rounded-full transition-all duration-200 border ${
                    activeTab === 'identities' 
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-200 dark:border-slate-600 shadow-xs' 
                      : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 border-transparent'
                  }`}
                  title="Identity & Key Management"
                >
                  <Key className="w-4 h-4" />
                </button>
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </div>
            )}

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-full text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all duration-200"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <EnclaveSwitcherModal
        isOpen={showEnclaveModal}
        onClose={() => setShowEnclaveModal(false)}
        onEnclaveChanged={onEnclaveChanged}
      />
    </>
  );
}
