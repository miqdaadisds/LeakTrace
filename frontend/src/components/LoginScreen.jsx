import React, { useState } from 'react';
import { ShieldCheck, LogIn, UserPlus, Key, Copy, Check, Eye, EyeOff, Sun, Moon, Radio, Cloud, HardDrive } from 'lucide-react';
import { setupOrganization, login, register, recoverPassword, getApiBaseUrl, CENTRAL_DEFAULT_BACKEND } from '../api';
import logo from '../assets/logo.png';
import { playClick } from '../utils/soundEffects';
import EnclaveSwitcherModal from './EnclaveSwitcherModal';

export default function LoginScreen({ setupRequired, onLogin, theme = 'light', onToggleTheme, onEnclaveChanged }) {
  const [mode, setMode] = useState(setupRequired ? 'setup' : 'login');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEnclaveModal, setShowEnclaveModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const currentApiUrl = getApiBaseUrl();
  const isCloud = currentApiUrl.includes('onrender.com');

  const resetForm = () => {
    setId('');
    setName('');
    setUnit('');
    setPassword('');
    setConfirmPassword('');
    setRecoveryKeyInput('');
    setError(null);
    setMessage(null);
    setCopied(false);
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setLoading(true); setError(null);
    try {
      const res = await setupOrganization(name, unit, password);
      setGeneratedRecoveryKey(res.recovery_key);
    } catch (err) {
      setError(err.response?.data?.detail || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setLoading(true); setError(null);
    try {
      const res = await register(name, unit, password);
      setGeneratedRecoveryKey(res.recovery_key);
      setMessage("Account created successfully. An administrator must approve your account before you can decrypt documents.");
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await login(id, password);
      onLogin(res.user, res.token || res.access_token);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid ID or password');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setLoading(true); setError(null);
    try {
      await recoverPassword(id, recoveryKeyInput, password);
      setMessage("Password recovered successfully. You can now sign in.");
      setMode('login');
      resetForm();
    } catch (err) {
      setError(err.response?.data?.detail || 'Recovery failed. Check your ID and Recovery Key.');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (generatedRecoveryKey) {
      navigator.clipboard.writeText(generatedRecoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (generatedRecoveryKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="apple-glass-card max-w-md w-full p-8 space-y-6 text-center border-2 border-emerald-400/80 shadow-2xl">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Key className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Save Your Recovery Key</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              If you ever forget your password, this key is the <strong>only way</strong> to restore access without loss of cryptographic signing keys.
            </p>
          </div>
          <div className="bg-slate-100/90 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-slate-100 break-all select-all flex items-center justify-between gap-2 shadow-inner">
            <span>{generatedRecoveryKey}</span>
            <button 
              onClick={copyKey}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0 text-slate-600 dark:text-slate-300"
              title="Copy Recovery Key"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            Save this key somewhere secure. It cannot be recovered once dismissed.
          </p>
          <button 
            onClick={() => {
              setGeneratedRecoveryKey(null);
              setMode('login');
              resetForm();
            }} 
            className="w-full py-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
          >
            I have saved my Recovery Key — Continue to Sign In
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm";

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 relative">
      {/* Top Bar with Enclave Status & Theme Toggle */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <button
          onClick={() => { playClick(); setShowEnclaveModal(true); }}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold apple-glass dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:scale-105 transition-transform shadow-xs"
          title="Click to view or switch Enclave network"
        >
          {isCloud ? <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <HardDrive className="w-3.5 h-3.5 text-slate-500" />}
          <span>{isCloud ? 'Cloud Enclave' : 'Local Enclave'}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5"></span>
        </button>

        <button
          onClick={() => { playClick(); if (onToggleTheme) onToggleTheme(); }}
          className="p-2 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs"
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>

      {/* Main Form Card */}
      <div className="flex items-center justify-center py-6">
        <div className="apple-glass-card max-w-md w-full p-8 space-y-6 dark:border-slate-700/80 shadow-2xl">
          <div className="text-center space-y-2">
            <img src={logo} alt="TraceLeak" className="w-20 h-20 mx-auto object-contain drop-shadow-md mb-1" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {mode === 'setup' && 'Set Up TraceLeak'}
              {mode === 'login' && 'TraceLeak'}
              {mode === 'register' && 'Create Account'}
              {mode === 'recover' && 'Recover Account'}
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {mode === 'setup' && 'Create the primary organization administrator'}
              {mode === 'login' && 'Sign in with your post-quantum cryptographic identity'}
              {mode === 'register' && 'Register a new recipient identity profile'}
              {mode === 'recover' && 'Reset your password using your Recovery Key'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium text-center">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium text-center">
              {message}
            </div>
          )}

          {mode === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input type="text" placeholder="e.g. Miqdaad Sayyed" value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit / Department</label>
                <input type="text" placeholder="e.g. WESEE Naval Directorate" value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Create a strong password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className={`${inputClass} pr-11`} 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Re-enter password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className={`${inputClass} pr-11`} 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md mt-2">
                {loading ? 'Initializing Administrator...' : 'Initialize Organization Admin'}
              </button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Name or Identity ID</label>
                <input type="text" placeholder="e.g. Miqdaad Sayyed or USER-MIQDAAD_SAYYED" value={id} onChange={e => setId(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Enter your TraceLeak password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className={`${inputClass} pr-11`} 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-md mt-2">
                <LogIn className="w-4 h-4 text-blue-400 dark:text-white" />
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              </button>

              <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                <button type="button" onClick={() => { setMode('register'); resetForm(); }} className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors">Create Account</button>
                <button type="button" onClick={() => { setMode('recover'); resetForm(); }} className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors">Forgot Password?</button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input type="text" placeholder="e.g. Fouziya Dange" value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit / Department</label>
                <input type="text" placeholder="e.g. Cyber Defence Team" value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Create your password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className={`${inputClass} pr-11`} 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Re-enter password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className={`${inputClass} pr-11`} 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-md mt-2">
                <UserPlus className="w-4 h-4 text-blue-400 dark:text-white" />
                <span>{loading ? 'Registering...' : 'Register Account'}</span>
              </button>
              <div className="text-center text-xs text-slate-600 dark:text-slate-400 pt-2">
                <button type="button" onClick={() => { setMode('login'); resetForm(); }} className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors">Back to Sign In</button>
              </div>
            </form>
          )}

          {mode === 'recover' && (
            <form onSubmit={handleRecover} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Name or Identity ID</label>
                <input type="text" placeholder="e.g. Miqdaad Sayyed or USER-MIQDAAD_SAYYED" value={id} onChange={e => setId(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Recovery Key</label>
                <input type="text" placeholder="Paste your 256-bit Recovery Key" value={recoveryKeyInput} onChange={e => setRecoveryKeyInput(e.target.value)} className={`${inputClass} font-mono text-xs`} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Enter new password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className={`${inputClass} pr-11`} 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Re-enter new password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className={`${inputClass} pr-11`} 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-md mt-2">
                <Key className="w-4 h-4" />
                <span>{loading ? 'Resetting Password...' : 'Reset Password'}</span>
              </button>
              <div className="text-center text-xs text-slate-600 dark:text-slate-400 pt-2">
                <button type="button" onClick={() => { setMode('login'); resetForm(); }} className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors">Back to Sign In</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <footer className="text-center text-[11px] text-slate-400 pb-2">
        TraceLeak &bull; SIH 2026 &bull; Ministry of Defence / WESEE
      </footer>

      <EnclaveSwitcherModal
        isOpen={showEnclaveModal}
        onClose={() => setShowEnclaveModal(false)}
        onEnclaveChanged={onEnclaveChanged}
      />
    </div>
  );
}
