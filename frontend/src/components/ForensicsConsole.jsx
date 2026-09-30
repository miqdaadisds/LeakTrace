import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShieldCheck, 
  User, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  Upload,
  XCircle,
  FileCode,
  Check
} from 'lucide-react';
import { analyzeTextLeak, analyzeImageLeak, analyzePdfLeak } from '../api';

export default function ForensicsConsole({ simulatedLeakText, autoAnalyzeTrigger }) {
  const [activeMode, setActiveMode] = useState('text'); // 'text' | 'pdf' | 'image'
  const [leakedText, setLeakedText] = useState(simulatedLeakText || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attributionResult, setAttributionResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (simulatedLeakText) {
      setLeakedText(simulatedLeakText);
    }
  }, [simulatedLeakText]);

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

  const handlePdfAnalysis = async () => {
    if (!selectedPdf) return;
    setIsAnalyzing(true);
    setError(null);
    setAttributionResult(null);

    try {
      const res = await analyzePdfLeak(selectedPdf);
      setAttributionResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'PDF forensic analysis failed.');
    } finally {
      setIsAnalyzing(false);
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
      {/* Leak Input Mode Tabs */}
      <div className="flex space-x-2 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => { setActiveMode('text'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeMode === 'text'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Leaked Text Excerpt</span>
        </button>
        <button
          onClick={() => { setActiveMode('pdf'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeMode === 'pdf'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200/60'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Leaked PDF Document</span>
        </button>
        <button
          onClick={() => { setActiveMode('image'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeMode === 'image'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200/60'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Screenshot / Scan (DCT-QIM)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="apple-glass-card p-6 space-y-3">
            {activeMode === 'text' && (
              <>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Leaked Text Snippet
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {leakedText.length} chars
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={leakedText}
                  onChange={(e) => setLeakedText(e.target.value)}
                  placeholder="Paste leaked text excerpt from Telegram, Signal, or WhatsApp..."
                  className="w-full bg-white/80 border border-slate-200/90 rounded-xl p-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                />
                <button
                  onClick={handleTextAnalysis}
                  disabled={isAnalyzing || !leakedText.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  <span>{isAnalyzing ? 'Extracting & Querying Ledger...' : 'Run Forensic Attribution Audit'}</span>
                </button>
              </>
            )}

            {activeMode === 'pdf' && (
              <>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Upload Intercepted PDF File
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors cursor-pointer relative bg-slate-50/50">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedPdf(e.target.files[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <FileCode className="w-7 h-7 text-blue-600 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-700">
                    {selectedPdf ? selectedPdf.name : 'Click to select leaked .pdf file'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Drag-and-drop downloaded watermarked PDF</div>
                </div>
                <button
                  onClick={handlePdfAnalysis}
                  disabled={isAnalyzing || !selectedPdf}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  <span>{isAnalyzing ? 'Extracting PDF Mark...' : 'Extract & Attribute PDF Leak'}</span>
                </button>
              </>
            )}

            {activeMode === 'image' && (
              <>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Upload Intercepted Screenshot
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors cursor-pointer relative bg-slate-50/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setSelectedFile(file);
                        const r = new FileReader();
                        r.onloadend = () => setImagePreview(r.result);
                        r.readAsDataURL(file);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-700">
                    {selectedFile ? selectedFile.name : 'Click to select image / screenshot'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, or screen photo</div>
                </div>
                {imagePreview && (
                  <div className="p-2 bg-slate-100 rounded-xl">
                    <img src={imagePreview} alt="Suspect" className="max-h-36 mx-auto rounded object-contain" />
                  </div>
                )}
                <button
                  onClick={handleImageAnalysis}
                  disabled={isAnalyzing || !selectedFile}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  <span>{isAnalyzing ? 'Extracting DCT-QIM...' : 'Extract Visual DCT Watermark'}</span>
                </button>
              </>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Verification Report Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="apple-glass-card p-6 min-h-[360px]">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center space-x-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Court-Martial Admissible Evidence Report</span>
            </h3>

            {attributionResult ? (
              attributionResult.is_attributed ? (
                <div className="space-y-4 text-xs">
                  {/* MANDATORY TECHNICAL BRIEF HEADLINE */}
                  <div className="p-4 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-emerald-950 font-mono space-y-2.5 shadow-sm">
                    <div className="font-bold text-xs sm:text-sm flex flex-wrap items-center gap-1.5 leading-snug">
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
                      <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Fingerprint: MATCH</span>
                      </span>
                      <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>ML-DSA: VALID</span>
                      </span>
                      <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Ledger: VALID (Block #{attributionResult.ledger_block_index})</span>
                      </span>
                    </div>
                  </div>

                  {/* Identified Officer Card */}
                  <div className="p-4 bg-white/80 border border-slate-200/80 rounded-2xl space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>Originating Decrypted Source</span>
                    </div>
                    <div className="text-base font-bold text-slate-900">
                      {attributionResult.leaker_name} ({attributionResult.leaker_id})
                    </div>
                    <div className="text-slate-600 text-xs">
                      Unit: <strong>{attributionResult.leaker_unit}</strong>
                    </div>
                  </div>

                  {/* Evidence Chain Continuity */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Decryption Timestamp:</span>
                      <span className="text-slate-900 font-mono font-medium">{attributionResult.decryption_time_str}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Carrier Method:</span>
                      <span className="text-blue-700 font-semibold">{attributionResult.evidence_type}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Blockchain Block:</span>
                      <span className="text-slate-900 font-mono font-semibold">Block #{attributionResult.ledger_block_index}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <XCircle className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-slate-800 font-semibold">No Watermark Detected</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    The provided artifact does not contain a valid NISHAN-PQ watermark.
                  </p>
                </div>
              )
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl p-6">
                <Search className="w-8 h-8 text-slate-300 mb-2" />
                <div className="font-semibold text-slate-700">Awaiting Leaked Evidence</div>
                <p className="max-w-xs text-xs text-slate-500 mt-1">
                  Upload a leaked PDF file or paste text to initiate automated cryptographic attribution.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
