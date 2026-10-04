import React, { useState } from 'react';
import { Cloud, HardDrive, Wifi, Check, AlertCircle, X, RefreshCw, Radio } from 'lucide-react';
import { getApiBaseUrl, setApiBaseUrl, testEnclaveHealth, CENTRAL_DEFAULT_BACKEND, LOCAL_DEFAULT_BACKEND } from '../api';
import { playClick } from '../utils/soundEffects';

export default function EnclaveSwitcherModal({ isOpen, onClose, onEnclaveChanged }) {
  if (!isOpen) return null;

  const currentUrl = getApiBaseUrl();
  const [selectedUrl, setSelectedUrl] = useState(currentUrl);
  const [customInput, setCustomInput] = useState(
    currentUrl !== CENTRAL_DEFAULT_BACKEND && currentUrl !== LOCAL_DEFAULT_BACKEND ? currentUrl : ''
  );
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async (url) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testEnclaveHealth(url);
      setTestResult(res);
    } catch (e) {
      setTestResult({ online: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleApply = (url) => {
    playClick();
    const targetUrl = url.trim().replace(/\/+$/, '');
    setApiBaseUrl(targetUrl, true);
    if (onEnclaveChanged) {
      onEnclaveChanged(targetUrl);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
      <div className="apple-glass-card max-w-lg w-full p-6 space-y-6 relative border border-slate-200/80 dark:border-slate-700/80 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <Radio className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>TraceLeak Cryptographic Enclave Network</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose whether to coordinate across multi-workstation teams or operate completely air-gapped.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Cloud Option */}
          <div
            onClick={() => { setSelectedUrl(CENTRAL_DEFAULT_BACKEND); handleTest(CENTRAL_DEFAULT_BACKEND); }}
            className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start space-x-3.5 ${
              selectedUrl === CENTRAL_DEFAULT_BACKEND
                ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${selectedUrl === CENTRAL_DEFAULT_BACKEND ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Cloud Enclave (Real-Time Team Sync)</span>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">RECOMMENDED</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Allows colleagues on different computers to immediately discover identities, register, and approve in real-time.
              </p>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block truncate">
                {CENTRAL_DEFAULT_BACKEND}
              </span>
            </div>
          </div>

          {/* Local Offline Option */}
          <div
            onClick={() => { setSelectedUrl(LOCAL_DEFAULT_BACKEND); handleTest(LOCAL_DEFAULT_BACKEND); }}
            className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start space-x-3.5 ${
              selectedUrl === LOCAL_DEFAULT_BACKEND
                ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${selectedUrl === LOCAL_DEFAULT_BACKEND ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Local Enclave (Air-Gapped Standalone)</span>
                <span className="text-[10px] font-bold text-slate-400">OFFLINE</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Runs strictly on this workstation without external network traffic.
              </p>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block truncate">
                {LOCAL_DEFAULT_BACKEND}
              </span>
            </div>
          </div>
        </div>

        {/* Test Result Feedback */}
        {testing && (
          <div className="flex items-center space-x-2 text-xs text-blue-600 dark:text-blue-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Pinging enclave endpoint...</span>
          </div>
        )}
        {testResult && (
          <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
            testResult.online 
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' 
              : 'bg-red-50/80 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700'
          }`}>
            {testResult.online ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Enclave Operational &bull; Latency: {testResult.latency}ms</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>Unable to reach endpoint: {testResult.error || 'Connection timed out'}</span>
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleApply(selectedUrl)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
          >
            Apply &amp; Connect Enclave
          </button>
        </div>
      </div>
    </div>
  );
}
