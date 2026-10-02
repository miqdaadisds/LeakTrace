import React, { useState, useEffect } from 'react';
import { Unlock, Download, CheckCircle2, RefreshCw, Upload, FileText, Eye, EyeOff, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { decryptSecurePackage } from '../api';

export default function DecryptFlow({ user, activeDocs = [], onDecrypted, onGoToDistribute }) {
  const [docId, setDocId] = useState(activeDocs[0]?.doc_id || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customFile, setCustomFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!docId && activeDocs.length > 0) {
      setDocId(activeDocs[0].doc_id);
    }
  }, [activeDocs]);

  const handleDecrypt = async (e) => {
    e.preventDefault();
    if (!password) { setError('Please enter your password.'); return; }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('password', password);
    formData.append('recipient_id', user?.recipient_id || '');
    formData.append('device_fingerprint', `WORKSTATION-${user?.recipient_id || 'AIRGAP'}`);

    if (customFile) {
      formData.append('package_file', customFile);
    } else {
      if (!docId) {
        setError('Please select a document or load a protected PDF from disk.');
        setLoading(false);
        return;
      }
      formData.append('doc_id', docId);
    }

    try {
      const res = await decryptSecurePackage(formData);
      setResult(res);
      if (onDecrypted) onDecrypted(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Wrong password or access denied.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setPassword('');
    setError(null);
    setCustomFile(null);
  };

  const isSenderOrAdmin = user?.role === 'admin' || user?.role === 'sender';

  if (result) {
    return (
      <div className="max-w-lg mx-auto mt-6">
        <div className="liquid-glass-card p-8 text-center space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Document Decrypted</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Authorized for <span className="font-bold text-slate-800">{user?.name}</span>
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/60 border border-white/80 shadow-xs text-xs text-slate-600 space-y-1">
            <div className="flex items-center justify-center space-x-1.5 font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Decryption Provenance Committed</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Unique forensic watermark embedded. Event signed with your ML-DSA-65 private key.
            </p>
          </div>

          <a
            href={result.pdf_download_url}
            download={`Document-${result.doc_id}-${result.recipient_id}.pdf`}
            className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-sm flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transition-all"
          >
            <Download className="w-4.5 h-4.5" />
            <span>Download Decrypted PDF</span>
          </a>

          <div className="flex items-center justify-center space-x-4 text-xs">
            <a
              href={result.receipt_download_url}
              download={`Receipt-${result.doc_id}-${result.recipient_id}.receipt`}
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              Download Signed Receipt
            </a>
            <span className="text-slate-300">|</span>
            <button onClick={reset} className="text-slate-500 hover:text-slate-800 font-medium">
              Decrypt another
            </button>
          </div>

          <div className="pt-3 border-t border-slate-200/60 text-[11px] text-slate-500 font-mono">
            Watermark: {result.watermark_id} &bull; Block #{result.ledger_block_index}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-4 space-y-4">
      {/* Quick Jump for Senders / Admins */}
      {isSenderOrAdmin && onGoToDistribute && (
        <div className="liquid-glass-subtle p-3 px-4 flex items-center justify-between border border-white/70 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Want to encrypt a new document?</p>
              <p className="text-[11px] text-slate-500">Protect any PDF for multiple recipients with ML-KEM-768.</p>
            </div>
          </div>
          <button
            onClick={onGoToDistribute}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-xs font-bold text-blue-600 border border-blue-200/60 shadow-xs transition-all"
          >
            <span>Encrypt Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Decrypt Form */}
      <form onSubmit={handleDecrypt} className="liquid-glass-card p-8 space-y-5">
        <div className="text-center space-y-1 pb-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 mb-2">
            <Unlock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Decrypt as {user?.name}</h2>
          <p className="text-xs text-slate-500">Unlock your assigned confidential document using your master credentials</p>
        </div>

        {/* Which document? */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Select Document</label>
          {activeDocs.length > 0 ? (
            <select
              value={docId}
              onChange={(e) => { setDocId(e.target.value); setCustomFile(null); }}
              className="w-full bg-white/85 border border-slate-200/90 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-xs"
            >
              {activeDocs.map((doc) => (
                <option key={doc.doc_id} value={doc.doc_id}>
                  {doc.title} ({doc.doc_id})
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800">
              No active documents found in this session. Encrypt a document in the <strong>Encrypt & Distribute</strong> tab or load a protected PDF from disk below.
            </div>
          )}
        </div>

        {/* Password with Show/Hide Toggle */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700">LeakTrace Password</label>
            <span className="text-[10px] text-slate-400 font-medium">Unlocks your local private vault</span>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-white/85 border border-slate-200/90 rounded-2xl pl-3.5 pr-11 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-xs"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            This password unlocks your Argon2id vault to extract your private ML-KEM-768 decapsulation key.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50/90 border border-red-200/80 text-xs text-red-700 font-medium text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transition-all"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Unlock className="w-4 h-4" />
          )}
          <span>{loading ? 'Decrypting & Embedding Watermark...' : 'Decrypt Document'}</span>
        </button>
      </form>

      {/* Load protected PDF file from disk */}
      <div className="liquid-glass-subtle p-3.5">
        <div className="relative border border-dashed border-slate-300/80 rounded-2xl p-3 bg-white/50 text-center hover:bg-white/80 transition-colors">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files[0] || null;
              setCustomFile(file);
              if (file) setDocId('');
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex items-center justify-center space-x-2 text-slate-600 text-xs font-medium">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>{customFile ? `Selected: ${customFile.name}` : 'Or load a protected PDF directly from disk'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
