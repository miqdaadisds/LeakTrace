import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  User, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  Upload,
  XCircle,
  Database,
  Fingerprint,
  Check
} from 'lucide-react';
import { analyzeTextLeak, analyzeImageLeak } from '../api';

export default function ForensicsConsole({ simulatedLeakText, autoAnalyzeTrigger }) {
  const [activeMode, setActiveMode] = useState('text');
  const [leakedText, setLeakedText] = useState(simulatedLeakText || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attributionResult, setAttributionResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (simulatedLeakText) {
      setLeakedText(simulatedLeakText);
    }
  }, [simulatedLeakText]);

  // Handle auto-analysis from 1-Click Judge Demo
  useEffect(() => {
    if (autoAnalyzeTrigger && simulatedLeakText) {
      handleTextAnalysis();
    }
  }, [autoAnalyzeTrigger]);

  const handleTextAnalysis = async () => {
    const textToAnalyze = leakedText || simulatedLeakText;
    if (!textToAnalyze.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setAttributionResult(null);

    try {
      const res = await analyzeTextLeak(textToAnalyze);
      setAttributionResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Forensic analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageAnalysis = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError(null);
    setAttributionResult(null);

    try {
      const res = await analyzeImageLeak(selectedFile);
      setAttributionResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Image forensic processing failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Explanation Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Step 3 of 3</span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-xs font-semibold text-slate-700">Cyber Defence Investigation Lab</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                Leak Attribution & Non-Repudiation Proof
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                When a leaked document excerpt or screenshot is intercepted, upload it here. 
                NISHAN-PQ extracts the invisible fingerprint, verifies the master HMAC and ML-DSA signature, and queries the offline blockchain to mathematically identify the source officer.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 bg-blue-50 rounded-full text-xs font-semibold text-blue-700 border border-blue-200 shrink-0">
            Offline Provenance Match
          </span>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex space-x-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => { setActiveMode('text'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
            activeMode === 'text'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Suspected Text Leak (Zero-Width Stego)</span>
        </button>
        <button
          onClick={() => { setActiveMode('image'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
            activeMode === 'image'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-slate-100'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Suspected Screenshot / Scan (2D DCT-QIM)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-5 space-y-4">
          {activeMode === 'text' ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Leaked Excerpt / Paste
                </label>
                <span className="text-[11px] text-slate-400">
                  {leakedText.length} characters
                </span>
              </div>
              <textarea
                rows={9}
                value={leakedText}
                onChange={(e) => setLeakedText(e.target.value)}
                placeholder="Paste leaked text excerpt here..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
              />
              <button
                onClick={handleTextAnalysis}
                disabled={isAnalyzing || !leakedText.trim()}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>{isAnalyzing ? 'Extracting Fingerprint & Querying Ledger...' : 'Run Forensic Attribution Audit'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Upload Intercepted Screenshot or Scan
              </label>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors cursor-pointer relative bg-slate-50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-700">Click to select intercepted image</div>
                <div className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, or PDF Render</div>
              </div>

              {imagePreview && (
                <div className="p-2 bg-slate-100 rounded-xl">
                  <img src={imagePreview} alt="Suspect Artifact" className="max-h-40 mx-auto rounded-lg object-contain" />
                </div>
              )}

              <button
                onClick={handleImageAnalysis}
                disabled={isAnalyzing || !selectedFile}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>{isAnalyzing ? 'Extracting 2D DCT-QIM Watermark...' : 'Extract & Attribute Image Leak'}</span>
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Verification Report Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm min-h-[380px]">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Forensic Attribution & Evidence Report</span>
            </h3>

            {attributionResult ? (
              attributionResult.is_attributed ? (
                <div className="space-y-4 text-xs">
                  {/* MANDATORY TECHNICAL BRIEF HEADLINE */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-mono space-y-2">
                    <div className="font-bold text-xs sm:text-sm text-emerald-950 flex flex-wrap items-center gap-1.5 leading-snug">
                      <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[11px]">
                        ATTRIBUTION VERIFIED
                      </span>
                      <span>&rarr;</span>
                      <span className="bg-white text-slate-900 px-2 py-0.5 rounded border border-emerald-300">
                        Recipient: {attributionResult.leaker_id}
                      </span>
                      <span>&rarr;</span>
                      <span className="bg-white text-slate-900 px-2 py-0.5 rounded border border-emerald-300">
                        Session: {attributionResult.session_nonce}
                      </span>
                    </div>

                    {/* Technical Requirement Check Badges */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200/60 font-sans">
                      <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Fingerprint: MATCH</span>
                      </span>
                      <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>ML-DSA: VALID</span>
                      </span>
                      <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Ledger: VALID (Block #{attributionResult.ledger_block_index})</span>
                      </span>
                    </div>
                  </div>

                  {/* Identified Officer Card */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>Whose decrypted copy produced the leak?</span>
                    </div>
                    <div className="text-base font-bold text-slate-900">
                      {attributionResult.leaker_name} ({attributionResult.leaker_id})
                    </div>
                    <div className="text-slate-600 text-xs">
                      Unit / Command: <strong>{attributionResult.leaker_unit}</strong>
                    </div>
                  </div>

                  {/* Evidence Chain Continuity */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
                    <div className="font-bold text-slate-800 uppercase tracking-wider">
                      Cryptographic Evidence Continuity
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Decryption Timestamp:</span>
                      <span className="text-slate-900 font-mono font-medium flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{attributionResult.decryption_time_str}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Forensic Carrier:</span>
                      <span className="text-blue-700 font-semibold">{attributionResult.evidence_type}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Blockchain Block:</span>
                      <span className="text-slate-900 font-mono font-semibold">
                        Block #{attributionResult.ledger_block_index} (Merkle Proof Verified)
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500">Non-Repudiation Score:</span>
                      <span className="text-emerald-700 font-bold">
                        {Math.round(attributionResult.confidence_score * 100)}% Mathematical Certainty
                      </span>
                    </div>
                  </div>

                  {/* Summary Narrative */}
                  <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-slate-700 text-[11px] leading-relaxed">
                    {attributionResult.forensic_summary}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <XCircle className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-slate-800 font-semibold">No Watermark Detected</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    The provided snippet does not contain valid zero-width Unicode steganography or DCT-QIM markers.
                  </p>
                </div>
              )
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-200 rounded-xl p-6">
                <Search className="w-8 h-8 text-slate-300 mb-2" />
                <div className="font-semibold text-slate-700">Awaiting Suspect Artifact</div>
                <p className="max-w-xs text-xs text-slate-500 mt-1">
                  Click &ldquo;Run Forensic Attribution Audit&rdquo; or use the 1-Click Judge Demo to watch NISHAN-PQ trace the source officer.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
