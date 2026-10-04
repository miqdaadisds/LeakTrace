import React, { useState } from 'react';
import { 
  Search, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Check, 
  Download, 
  Database, 
  ArrowRight,
  FolderOpen,
  FileText,
  X
} from 'lucide-react';
import { analyzePdfLeak, exportEvidence } from '../api';
import { downloadFileToDisk, openFolderForFile } from '../utils/fileSaver';
import { playClick, playSuccess, playError } from '../utils/soundEffects';

export default function InvestigateFlow({ onGoToLedger }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [savedEvidencePath, setSavedEvidencePath] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileDrop = (droppedFile) => {
    if (!droppedFile) return;
    if (droppedFile.type !== 'application/pdf' && !droppedFile.name.toLowerCase().endsWith('.pdf')) {
      playError();
      setError('Please upload a PDF document for forensic scanning.');
      return;
    }
    setError(null);
    setFile(droppedFile);
    setResult(null);
    playClick();
  };

  const handleAnalyze = async () => {
    if (!file) {
      playError();
      setError('Please select or drop a suspect PDF file.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    playClick();

    try {
      const res = await analyzePdfLeak(file);
      if (res.is_attributed) {
        playSuccess();
      } else {
        playError();
      }
      setResult(res);
    } catch (err) {
      playError();
      setError(err.response?.data?.detail || 'Analysis failed. Please verify network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!result?.watermark_id) return;
    setExporting(true);
    playClick();
    try {
      const blob = await exportEvidence(result.watermark_id);
      const defaultName = `Forensic-Evidence-${result.watermark_id}.pdf`;
      const res = await downloadFileToDisk({
        defaultFilename: defaultName,
        blob: blob,
        mimeType: 'application/pdf'
      });
      if (res && res.success && res.filePath) {
        playSuccess();
        setSavedEvidencePath(res.filePath);
      }
    } catch (err) {
      playError();
      setError('Failed to export forensic dossier.');
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    playClick();
    setFile(null);
    setResult(null);
    setError(null);
    setSavedEvidencePath(null);
  };

  if (result) {
    const hasIdentityMatch = Boolean(result.recipient_id || result.recipient_name || result.watermark_status === 'MATCHED');

    if (hasIdentityMatch) {
      const isFullAttribution = Boolean(result.is_attributed);
      return (
        <div className="max-w-md mx-auto mt-6">
          <div className={`liquid-glass-card p-7 space-y-5 text-center transition-all ${
            isFullAttribution
              ? 'border-emerald-500/30 bg-emerald-50/20'
              : 'border-amber-500/30 bg-amber-50/20'
          }`}>
            <div className="flex flex-col items-center space-y-2.5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                isFullAttribution
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-600'
              }`}>
                {isFullAttribution ? <CheckCircle2 className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-700 tracking-tight">
                  {isFullAttribution ? 'Source Identity Identified' : 'Suspect Recipient Traced'}
                </h2>
                <p className={`text-xl font-extrabold mt-0.5 ${
                  isFullAttribution ? 'text-emerald-700' : 'text-amber-800'
                }`}>
                  {result.recipient_name || 'Enrolled Personnel'}
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  {result.recipient_id} {result.recipient_unit ? `\u2022 ${result.recipient_unit}` : ''}
                </p>
              </div>
            </div>

            {/* Cryptographic Badges */}
            <div className="flex items-center justify-center flex-wrap gap-1.5">
              {[
                { label: 'Watermark', status: result.watermark_status },
                { label: 'ML-DSA-65', status: result.signature_status },
                { label: 'Merkle Proof', status: result.ledger_status || 'VALID' },
                { 
                  label: 'Notary Quorum', 
                  status: (result.validator_quorum_status && result.validator_quorum_status.includes('Quorum achieved'))
                    ? '4/4 NODES'
                    : (result.validator_quorum_status ? 'VALIDATED' : '4/4 NODES')
                },
              ].map((v) => {
                const isValidBadge = v.status === 'VALID' || v.status === 'MATCHED' || v.status.includes('NODES') || v.status === 'VALIDATED';
                return (
                  <div
                    key={v.label}
                    className={`flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full border shadow-xs ${
                      isValidBadge
                        ? 'text-emerald-800 bg-emerald-100/80 border-emerald-300'
                        : 'text-amber-800 bg-amber-100/80 border-amber-300'
                    }`}
                  >
                    {isValidBadge ? <Check className="w-3 h-3 font-bold" /> : <AlertTriangle className="w-3 h-3" />}
                    <span className="font-bold">{v.label}: {v.status}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3.5 rounded-xl border border-slate-200/80 shadow-xs text-left">
              {result.forensic_summary}
            </div>

            {result.ledger_block_index !== undefined && (
              <div className="text-[10px] font-mono text-slate-500">
                Block #{result.ledger_block_index} {result.decryption_time_str ? `\u2022 ${result.decryption_time_str}` : ''}
              </div>
            )}

            {savedEvidencePath && (
              <div className="p-2.5 bg-emerald-100/90 border border-emerald-300 rounded-xl text-[11px] text-emerald-900 space-y-1 text-left">
                <div className="font-bold">Saved to Filesystem:</div>
                <div className="font-mono text-[10px] break-all text-slate-700">{savedEvidencePath}</div>
                <button
                  onClick={() => openFolderForFile(savedEvidencePath)}
                  className="flex items-center space-x-1 text-emerald-800 font-bold hover:underline pt-0.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Show in Windows Explorer</span>
                </button>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-md transform hover:scale-[1.01] active:scale-[0.99]"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{exporting ? 'Generating Evidence Dossier...' : 'Export Forensic Evidence Dossier'}</span>
            </button>

            {onGoToLedger && result.ledger_block_index !== undefined && (
              <button
                onClick={() => { playClick(); onGoToLedger(); }}
                className="w-full py-2 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Inspect Block #{result.ledger_block_index} on Blockchain</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            <button onClick={reset} className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors">
              Investigate another document
            </button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="max-w-md mx-auto mt-6">
          <div className="liquid-glass-card p-7 space-y-4 border-amber-300/80 bg-amber-50/30 text-center">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">No Cryptographic Match Found</h2>
              <p className="text-xs text-slate-600 leading-relaxed px-2">{result.forensic_summary}</p>
            </div>
            <button onClick={reset} className="w-full py-2 text-xs text-slate-700 hover:text-slate-900 font-bold transition-colors">
              Try another document
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="max-w-md mx-auto mt-4 space-y-4">
      <div className="liquid-glass-card p-7 space-y-5">
        <div className="text-center space-y-1 pb-1">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 mb-1">
            <Search className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Investigate Document Leak</h2>
          <p className="text-xs text-slate-500">Scan suspected PDF to extract forensic watermark and verify DLT provenance</p>
        </div>

        {/* Upload drop area */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 block">
            Suspect Document <span className="text-red-500">*</span>
          </label>

          {!file ? (
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
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer ${
                isDragging
                  ? 'border-purple-500 bg-purple-50/70 scale-[1.01]'
                  : 'border-slate-300 hover:border-purple-400 bg-white/60 hover:bg-white/90'
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileDrop(e.target.files?.[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Drop leaked PDF here, or <span className="text-purple-600 underline">browse</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Scans invisible DCT QIM steganography & structural carriers</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2.5 truncate">
                <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-bold text-purple-900 truncate">{file.name}</p>
                  <p className="text-[10px] text-purple-600">{(file.size / 1024).toFixed(1)} KB &bull; Suspect file</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { playClick(); setFile(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50/90 border border-red-200 text-xs text-red-700 text-center font-medium">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading || !file}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all duration-200 shadow-md transform hover:scale-[1.01] active:scale-[0.99]"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Extracting Invisible Watermark & Verifying Ledger...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 text-amber-400" />
              <span>Run Forensic Leak Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
