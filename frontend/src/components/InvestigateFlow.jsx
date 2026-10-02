import React, { useState } from 'react';
import { Search, Upload, CheckCircle2, AlertTriangle, RefreshCw, Check, Download, Database, ShieldCheck, ArrowRight } from 'lucide-react';
import { analyzePdfLeak, exportEvidence } from '../api';

export default function InvestigateFlow({ onGoToLedger }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleAnalyze = async () => {
    if (!file) { setError('Please select a PDF file.'); return; }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await analyzePdfLeak(file);
      setResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!result?.watermark_id) return;
    setExporting(true);
    try {
      const blob = await exportEvidence(result.watermark_id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Forensic-Evidence-${result.watermark_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Export failed. Please check backend connection.');
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  if (result) {
    if (result.is_attributed) {
      return (
        <div className="max-w-lg mx-auto mt-6">
          <div className="liquid-glass-card p-8 space-y-6 border-emerald-500/30 bg-emerald-50/30">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Source Identified</h2>
                <p className="text-2xl font-extrabold text-emerald-700 mt-1">{result.recipient_name}</p>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{result.recipient_id} &bull; {result.recipient_unit}</p>
              </div>
            </div>

            {/* Verification badges */}
            <div className="flex items-center justify-center flex-wrap gap-2">
              {[
                { label: 'Watermark', status: result.watermark_status },
                { label: 'Signature', status: result.signature_status },
                { label: 'Ledger', status: result.ledger_status },
                { label: 'Quorum', status: '3/4' },
              ].map((v) => (
                <div key={v.label} className="flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-full border border-emerald-300/80 shadow-xs">
                  <Check className="w-3.5 h-3.5 font-bold" />
                  <span className="font-bold text-[11px]">{v.label}</span>
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-600 text-center leading-relaxed px-3 bg-white/60 p-3.5 rounded-2xl border border-white/80">
              {result.forensic_summary}
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-center space-x-3 text-xs">
              <span className="text-slate-500 font-mono text-[11px]">
                Block #{result.ledger_block_index} &bull; {result.decryption_time_str}
              </span>
            </div>

            {/* Direct Ledger Inspection Button */}
            {onGoToLedger && (
              <button
                onClick={onGoToLedger}
                className="w-full py-2.5 bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-xs"
              >
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Inspect Block #{result.ledger_block_index} on Blockchain Ledger</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 text-indigo-500" />
              </button>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{exporting ? 'Generating Evidence Dossier...' : 'Export Evidence Report (PDF)'}</span>
            </button>

            <button onClick={reset} className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-semibold transition-all">
              Investigate another document
            </button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="max-w-lg mx-auto mt-6">
          <div className="liquid-glass-card p-8 space-y-5 border-amber-300 bg-amber-50/30">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">No Match Found</h2>
              <p className="text-xs text-slate-500 text-center leading-relaxed">{result.forensic_summary}</p>
            </div>
            <button onClick={reset} className="w-full py-2.5 text-xs text-slate-600 hover:text-slate-900 font-bold transition-all">
              Try another document
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-6">
      <div className="liquid-glass-card p-8 space-y-5">
        <div className="text-center space-y-1 pb-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 mb-2">
            <Search className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Investigate a Leak</h2>
          <p className="text-xs text-slate-500">Upload a suspected leaked document to extract watermark & verify blockchain provenance</p>
        </div>

        {/* Upload area */}
        <div className="relative border-2 border-dashed border-slate-300/80 rounded-2xl p-8 bg-white/60 text-center hover:bg-white/90 hover:border-blue-400 transition-all">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center space-y-2">
            <Upload className="w-8 h-8 text-blue-500/80" />
            <div className="text-xs font-bold text-slate-700">
              {file ? file.name : 'Click or drag leaked PDF here'}
            </div>
            <div className="text-[11px] text-slate-400">
              Scans DCT QIM frequency bands, zero-width steganography, and structural markers
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50/90 border border-red-200 text-xs text-red-700 text-center font-medium">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading || !file}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>{loading ? 'Extracting Watermark & Querying Ledger...' : 'Run Forensic Analysis'}</span>
        </button>
      </div>
    </div>
  );
}
