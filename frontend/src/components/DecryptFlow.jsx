import React, { useState } from 'react';
import { 
  Unlock, 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  Upload, 
  FileText, 
  Eye, 
  EyeOff, 
  FolderOpen,
  X,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { decryptSecurePackage } from '../api';
import { downloadFileToDisk, openFolderForFile } from '../utils/fileSaver';
import { playClick, playSuccess, playError } from '../utils/soundEffects';

export default function DecryptFlow({ user, activeDocs = [], onDecrypted, onGoToDistribute }) {
  const [customFile, setCustomFile] = useState(null);
  const [selectedRepoDocId, setSelectedRepoDocId] = useState('');
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [savedPdfPath, setSavedPdfPath] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileDrop = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      playError();
      setError('Please upload an authentic protected PDF file.');
      return;
    }
    setError(null);
    setCustomFile(file);
    setSelectedRepoDocId(''); // Clear server document selection
    playClick();
  };

  const handleDecrypt = async (e) => {
    e.preventDefault();
    if (!password) {
      playError();
      setError('Please enter your vault passphrase.');
      return;
    }
    if (!customFile && !selectedRepoDocId) {
      playError();
      setError('Please upload a protected PDF document to decrypt.');
      return;
    }

    setLoading(true);
    setError(null);
    playClick();

    const formData = new FormData();
    formData.append('password', password);
    formData.append('recipient_id', user?.recipient_id || '');
    formData.append('device_fingerprint', `WORKSTATION-${user?.recipient_id || 'AIRGAP'}`);

    if (customFile) {
      formData.append('package_file', customFile);
    } else {
      formData.append('doc_id', selectedRepoDocId);
    }

    try {
      const res = await decryptSecurePackage(formData);
      playSuccess();
      setResult(res);
      if (onDecrypted) onDecrypted(res);
      // Auto-trigger Save dialog so user directly saves the decrypted PDF
      await handleSavePdf(res);
    } catch (err) {
      playError();
      setError(err.response?.data?.detail || 'Decryption denied. Check your passphrase.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePdf = async (overrideResult) => {
    const targetResult = overrideResult || result;
    if (!targetResult) return;
    playClick();

    const sourceBase = customFile?.name
      ? customFile.name.replace(/\.pdf$/i, '').replace(/\.protected$/i, '')
      : (targetResult.doc_id || 'Document');
    const defaultName = `${sourceBase}.decrypted.pdf`;

    try {
      let finalBase64 = targetResult.watermarked_pdf_base64;
      if (!finalBase64 && targetResult.doc_id) {
        const downloadUrl = `/api/recipient/download-decrypted-pdf/${targetResult.doc_id}/${user?.recipient_id || ''}`;
        const blobResp = await fetch(downloadUrl);
        if (blobResp.ok) {
          const blobData = await blobResp.blob();
          finalBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const r = reader.result;
              resolve(typeof r === 'string' ? r.split(',')[1] : null);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blobData);
          });
        }
      }

      if (!finalBase64) {
        throw new Error('No decrypted PDF bytes found');
      }

      const res = await downloadFileToDisk({
        defaultFilename: defaultName,
        base64Content: finalBase64,
        mimeType: 'application/pdf'
      });
      if (res && res.success && res.filePath) {
        playSuccess();
        setSavedPdfPath(res.filePath);
      }
    } catch (err) {
      playError();
      console.error('File save error:', err);
    }
  };

  const handleSaveReceipt = async () => {
    if (!result?.receipt_json_str && !result?.receipt) return;
    playClick();
    const content = result.receipt_json_str || JSON.stringify(result.receipt, null, 2);
    const defaultName = `Receipt-${result.doc_id || 'DOC'}-${user?.recipient_id || 'RECIPIENT'}.json`;
    try {
      await downloadFileToDisk({
        defaultFilename: defaultName,
        textContent: content,
        mimeType: 'application/json'
      });
      playSuccess();
    } catch (_) {
      playError();
    }
  };

  const reset = () => {
    playClick();
    setResult(null);
    setPassword('');
    setError(null);
    setCustomFile(null);
    setSelectedRepoDocId('');
    setSavedPdfPath(null);
  };

  if (result) {
    return (
      <div className="max-w-md mx-auto mt-6">
        <div className="liquid-glass-card p-7 text-center space-y-5 border-emerald-500/30 bg-emerald-50/20">
          <div className="flex flex-col items-center space-y-2.5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Decryption Successful</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Officer: <span className="font-bold text-slate-800">{user?.name}</span>
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/80 border border-emerald-200/60 shadow-xs text-xs text-slate-700 space-y-1">
            <div className="flex items-center justify-center space-x-1 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Forensic Watermark Embedded</span>
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              ID: {result.watermark_id} &bull; Block #{result.ledger_block_index}
            </p>
          </div>

          {savedPdfPath && (
            <div className="p-2.5 bg-emerald-100/90 border border-emerald-300 rounded-xl text-[11px] text-emerald-900 space-y-1 text-left">
              <div className="font-bold flex items-center space-x-1">
                <span>Saved to Filesystem</span>
              </div>
              <div className="font-mono text-[10px] break-all text-slate-700">{savedPdfPath}</div>
              <button
                onClick={() => openFolderForFile(savedPdfPath)}
                className="flex items-center space-x-1 text-emerald-800 font-bold hover:underline pt-0.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Show in Windows Explorer</span>
              </button>
            </div>
          )}

          {/* Primary Action: Native Save As Dialog */}
          <button
            onClick={handleSavePdf}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Save Decrypted PDF to Disk</span>
          </button>

          <div className="flex items-center justify-center space-x-4 text-xs pt-1">
            <button
              onClick={handleSaveReceipt}
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              Save Receipt (.json)
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={reset} className="text-slate-500 hover:text-slate-800 font-medium">
              Decrypt another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-4 space-y-4">
      <form onSubmit={handleDecrypt} className="liquid-glass-card p-7 space-y-5">
        <div className="text-center space-y-1 pb-1">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 mb-1">
            <Unlock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Decrypt Document</h2>
          <p className="text-xs text-slate-500">Authorized Officer: <span className="font-bold text-slate-800">{user?.name}</span></p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50/90 border border-red-200/80 text-xs text-red-700 font-medium text-center">
            {error}
          </div>
        )}

        {/* 1. PRIMARY ACTION: Load Protected PDF directly from disk */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 block">
            Protected PDF File <span className="text-red-500">*</span>
          </label>

          {!customFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileDrop(e.dataTransfer.files[0]);
                }
              }}
              className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all duration-200 cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-white/60 hover:bg-white/90'
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileDrop(e.target.files?.[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Upload className="w-4.5 h-4.5" />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  Drop protected PDF here, or <span className="text-blue-600 underline">browse</span>
                </p>
                <p className="text-[10px] text-slate-400">Loads your encrypted document</p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2.5 truncate">
                <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-bold text-blue-900 truncate">{customFile.name}</p>
                  <p className="text-[10px] text-blue-600">{(customFile.size / 1024).toFixed(1)} KB &bull; Active file</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { playClick(); setCustomFile(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* 2. SECONDARY OPTION: Small/Optional Server Document Selector */}
        {!customFile && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => { playClick(); setShowRepoSelector(!showRepoSelector); }}
              className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 flex items-center space-x-1"
            >
              <span>Or choose from central repository</span>
              {showRepoSelector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showRepoSelector && (
              <div className="mt-2 space-y-1.5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
                {activeDocs.length > 0 ? (
                  <select
                    value={selectedRepoDocId}
                    onChange={(e) => {
                      playClick();
                      setSelectedRepoDocId(e.target.value);
                      setCustomFile(null);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Choose document --</option>
                    {activeDocs.map((doc) => (
                      <option key={doc.doc_id} value={doc.doc_id}>
                        {doc.title} ({doc.doc_id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">No documents currently registered in repository.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Passphrase Input */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 block">
            Vault Passphrase
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your credential passphrase"
              className="w-full bg-white/90 border border-slate-200/90 rounded-xl pl-3 pr-10 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-xs"
              required
            />
            <button
              type="button"
              onClick={() => { playClick(); setShowPassword(!showPassword); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit Decrypt Button */}
        <button
          type="submit"
          disabled={loading || (!customFile && !selectedRepoDocId)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99]"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Decapsulating ML-KEM Key & Decrypting...</span>
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4" />
              <span>Decrypt Document</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
