import React, { useState } from 'react';
import { ShieldCheck, LogIn, UserPlus, Key, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { setupOrganization, login, register, recoverPassword } from '../api';
import logo from '../assets/logo.png';

export default function LoginScreen({ setupRequired, onLogin }) {
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
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

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
      setMessage("Account created. An administrator must approve your account before you can use TraceLeak.");
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
        <div className="apple-glass-card max-w-md w-full p-8 space-y-6">
          <div className="text-center space-y-2">
            <img src={logo} alt="TraceLeak" className="w-16 h-16 mx-auto object-contain drop-shadow-md" />
            <h2 className="text-xl font-bold text-slate-900">Save Your Recovery Key</h2>
            <p className="text-xs text-slate-500">
              This secret key is required to restore your identity or reset your password.
            </p>
          </div>
          
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
            <p className="text-xs font-semibold text-amber-900">
              ⚠️ Save this Recovery Key now. It will never be shown again.
            </p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 block p-3 bg-white border border-amber-300 rounded-xl text-xs font-mono text-slate-900 break-all select-all font-semibold">
                {generatedRecoveryKey}
              </code>
            </div>
            <button
              onClick={copyKey}
              className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Recovery Key'}</span>
            </button>
          </div>

          <button 
            onClick={() => {
              setGeneratedRecoveryKey(null);
              setMode('login');
              resetForm();
            }} 
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
          >
            I have saved my Recovery Key — Continue to Sign In
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 font-medium placeholder:text-slate-400 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-sm";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="apple-glass-card max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <img src={logo} alt="TraceLeak" className="w-20 h-20 mx-auto object-contain drop-shadow-md mb-1" />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'setup' && 'Set Up TraceLeak'}
            {mode === 'login' && 'TraceLeak'}
            {mode === 'register' && 'Create Account'}
            {mode === 'recover' && 'Recover Account'}
          </h1>
          <p className="text-xs font-medium text-slate-500">
            {mode === 'setup' && 'Create the first organization administrator'}
            {mode === 'login' && 'Sign in with your TraceLeak credentials'}
            {mode === 'register' && 'Register a new recipient identity'}
            {mode === 'recover' && 'Reset your password using your Recovery Key'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium text-center">
            {message}
          </div>
        )}

        {mode === 'setup' && (
          <form onSubmit={handleSetup} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input type="text" placeholder="e.g. Commander Sharma" value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit / Department</label>
              <input type="text" placeholder="e.g. WESEE Naval Directorate" value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md mt-2">
              {loading ? 'Initializing Administrator...' : 'Initialize Organization Admin'}
            </button>
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name or Identity ID</label>
              <input type="text" placeholder="e.g. Miqdaad Sayyed or USER-MIQDAAD_SAYYED" value={id} onChange={e => setId(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-md mt-2">
              <LogIn className="w-4 h-4 text-amber-400" />
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
            <div className="flex justify-between items-center text-xs text-slate-600 pt-3 border-t border-slate-200/60">
              <button type="button" onClick={() => { setMode('register'); resetForm(); }} className="hover:text-amber-600 font-semibold transition-colors">Create Account</button>
              <button type="button" onClick={() => { setMode('recover'); resetForm(); }} className="hover:text-amber-600 font-semibold transition-colors">Forgot Password?</button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input type="text" placeholder="e.g. Officer Bob" value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit / Department</label>
              <input type="text" placeholder="e.g. Submarine Communications" value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-md mt-2">
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>{loading ? 'Registering...' : 'Register Account'}</span>
            </button>
            <div className="text-center text-xs text-slate-600 pt-2">
              <button type="button" onClick={() => { setMode('login'); resetForm(); }} className="hover:text-amber-600 font-semibold transition-colors">Back to Sign In</button>
            </div>
          </form>
        )}

        {mode === 'recover' && (
          <form onSubmit={handleRecover} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name or Identity ID</label>
              <input type="text" placeholder="e.g. Miqdaad Sayyed or USER-MIQDAAD_SAYYED" value={id} onChange={e => setId(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Recovery Key</label>
              <input type="text" placeholder="Paste your 256-bit Recovery Key" value={recoveryKeyInput} onChange={e => setRecoveryKeyInput(e.target.value)} className={`${inputClass} font-mono text-xs`} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-md mt-2">
              <Key className="w-4 h-4" />
              <span>{loading ? 'Resetting Password...' : 'Reset Password'}</span>
            </button>
            <div className="text-center text-xs text-slate-600 pt-2">
              <button type="button" onClick={() => { setMode('login'); resetForm(); }} className="hover:text-amber-600 font-semibold transition-colors">Back to Sign In</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
