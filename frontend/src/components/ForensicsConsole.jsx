import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShieldCheck, 
  User, 
  Clock, 
  FileText, 
  Upload, 
  XCircle, 
  Check, 
  Cpu, 
  Layers, 
  FileCheck2, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { analyzePdfLeak, analyzeTextLeak } from '../api';

export default function ForensicsConsole({ preloadedPdfLeak, autoAnalyzeTrigger }) {
  const [activeMode, setActiveMode] = useState('pdf'); // 'pdf' | 'text'
  const [selectedPdfFile, setSelectedPdfFile] = useState(null);
  const [leakedText, setLeakedText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attributionResult, setAttributionResult] = useState(null);
  const [error, setError] = useState(null);

  // If a decrypted PDF was passed from Step 2
  useEffect(() => {
    if (preloadedPdfLeak) {
      setActiveMode('pdf');
      setSelectedPdfFile(preloadedPdfLeak);
      setAttributionResult(null);
    }
  }, [preloadedPdfLeak]);

  useEffect(() => {
    if (autoAnalyzeTrigger && selectedPdfFile) {
      handlePdfAnalysis();
    }
  }, [autoAnalyzeTrigger, selectedPdfFile]);

  const handlePdfAnalysis = async () => {
    if (!selectedPdfFile) {
      setError('Please select or upload a suspect leaked PDF file.');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAttributionResult(null);

    try {
      const res = await analyzePdfLeak(selectedPdfFile);
      setAttributionResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Forensic analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTextAnalysis = async () => {
    if (!leakedText.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setAttributionResult(null);

    try {
      const res = await analyzeTextLeak(leakedText);
      setAttributionResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Text forensic analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Leak Input Mode Tabs */}
      <div className="flex space-x-2 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => { setActiveMode('pdf'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeMode === 'pdf'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Leaked PDF Document (Real Artifact)</span>
        </button>

        <button
          onClick={() => { setActiveMode('text'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeMode === 'text'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Extracted Text Excerpt</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Investigation Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload & Trigger Area */}
        <div className="lg:col-span-5 space-y-4">
          <div className="apple-glass-card p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Search className="w-4 h-4 text-blue-600" />
              <span>Suspect Artifact Ingestion</span>
            </h3>
            <p className="text-xs text-slate-500">
              Submit the leaked document. The forensic engine parses structural dictionaries, extracts the opaque watermark, matches with the blockchain ledger, and verifies ML-DSA-65 signatures.
            </p>

            {activeMode === 'pdf' ? (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 bg-white/60 text-center hover:bg-white/90 transition-all relative">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      setSelectedPdfFile(e.target.files[0] || null);
                      setAttributionResult(null);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    <Upload className="w-6 h-6 text-blue-600 mx-auto" />
                    <div className="text-xs font-semibold text-slate-800">
                      {selectedPdfFile ? selectedPdfFile.name : 'Drag & drop leaked PDF or click to browse'}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Upload Decrypted-DOC-USER-BOB.pdf or any suspect document
                    </p>
                  </div>
                </div>

                <button
                  onClick={handlePdfAnalysis}
                  disabled={!selectedPdfFile || isAnalyzing}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  {isAnalyzing ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-white" />
                  )}
                  <span>Run Forensic Attribution Audit</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={leakedText}
                  onChange={(e) => setLeakedText(e.target.value)}
                  placeholder="Paste leaked text excerpt here..."
                  rows={6}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleTextAnalysis}
                  disabled={!leakedText.trim() || isAnalyzing}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  {isAnalyzing ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-white" />
                  )}
                  <span>Extract Zero-Width Mark & Attribute</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Forensic Report Output */}
        <div className="lg:col-span-7 space-y-4">
          {attributionResult ? (
            attributionResult.is_attributed ? (
              <div className="apple-glass-card p-6 space-y-5 border-emerald-300 bg-emerald-50/30">
                {/* Attribution Verified Banner */}
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200/80">
                  <div className="flex items-center space-x-2 text-emerald-800">
                    <FileCheck2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="font-bold text-sm">Attribution Verified</h4>
                      <p className="text-[11px] text-emerald-700">Cryptographically bound non-repudiation evidence</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
                    MATHEMATICALLY PROVEN
                  </span>
                </div>

                {/* Culprit Identification Card */}
                <div className="p-4 rounded-xl bg-white border border-emerald-200/80 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Leaker Identity
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        {attributionResult.recipient_name} ({attributionResult.recipient_id})
                      </div>
                      <div className="text-xs text-slate-600">{attributionResult.recipient_unit}</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                      Block #{attributionResult.ledger_block_index}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 font-mono text-slate-700">
                    <div>Session ID: <span className="font-bold text-slate-900">{attributionResult.session_id}</span></div>
                    <div>Watermark ID: <span className="font-bold text-blue-700">{attributionResult.watermark_id}</span></div>
                    <div>Decryption Time: <span className="text-slate-900">{attributionResult.decryption_time_str}</span></div>
                    <div>Carrier Channel: <span className="text-slate-900">{attributionResult.evidence_type}</span></div>
                  </div>
                </div>

                {/* Evidence Verification Checkpoints */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-white/80 border border-emerald-200 text-center space-y-1">
                    <div className="text-[10px] font-semibold text-slate-500">Watermark Status</div>
                    <div className="text-xs font-bold text-emerald-700 flex items-center justify-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{attributionResult.watermark_status}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/80 border border-emerald-200 text-center space-y-1">
                    <div className="text-[10px] font-semibold text-slate-500">ML-DSA-65 Signature</div>
                    <div className="text-xs font-bold text-emerald-700 flex items-center justify-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{attributionResult.signature_status}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/80 border border-emerald-200 text-center space-y-1">
                    <div className="text-[10px] font-semibold text-slate-500">DLT Ledger Proof</div>
                    <div className="text-xs font-bold text-emerald-700 flex items-center justify-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{attributionResult.ledger_status}</span>
                    </div>
                  </div>
                </div>

                {/* Summary narrative */}
                <p className="text-xs text-slate-600 bg-white/60 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                  {attributionResult.forensic_summary}
                </p>
              </div>
            ) : (
              <div className="apple-glass-card p-6 space-y-3 border-amber-200 bg-amber-50/30 text-amber-900">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-bold text-sm">Investigative Abstain</h4>
                </div>
                <p className="text-xs leading-relaxed">
                  {attributionResult.forensic_summary}
                </p>
                <div className="text-[11px] text-amber-700 font-medium">
                  The system strictly adheres to deterministic verification. It will never output false attribution when watermark tokens are missing or tampered.
                </div>
              </div>
            )
          ) : (
            <div className="apple-glass-card p-12 text-center text-slate-400 text-xs space-y-2">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-slate-700 font-semibold">Awaiting Suspect Artifact</div>
              <p className="max-w-md mx-auto text-slate-500 text-[11px]">
                Upload a suspect leaked PDF document and click &ldquo;Run Forensic Attribution Audit&rdquo; to extract the watermark and anchor mathematical attribution.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
