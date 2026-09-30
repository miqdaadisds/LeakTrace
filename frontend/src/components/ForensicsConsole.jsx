import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  User, 
  Clock, 
  Hash, 
  Database, 
  Image as ImageIcon, 
  FileText,
  Upload,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { analyzeTextLeak, analyzeImageLeak } from '../api';

export default function ForensicsConsole({ simulatedLeakText }) {
  const [activeMode, setActiveMode] = useState('text'); // 'text' | 'image'
  const [leakedText, setLeakedText] = useState(simulatedLeakText || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attributionResult, setAttributionResult] = useState(null);
  const [error, setError] = useState(null);

  // Update text if parent passed simulated leak
  React.useEffect(() => {
    if (simulatedLeakText) {
      setLeakedText(simulatedLeakText);
    }
  }, [simulatedLeakText]);

  const handleTextAnalysis = async () => {
    if (!leakedText.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setAttributionResult(null);

    try {
      const res = await analyzeTextLeak(leakedText);
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
      {/* Intro Context Card */}
      <div className="bg-navy-800/80 border border-navy-700 rounded-xl p-5 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-defence-amber" />
              <span>Forensic Leak Attribution & Non-Repudiation Console</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Inspect suspected leaked documents, social media pastes, or photographed screens. 
              Extracts the hidden steganographic payload, validates the master HMAC, and cross-references 
              the immutable Merkle blockchain ledger to mathematically prove the source officer&apos;s identity.
            </p>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 text-xs font-mono font-bold rounded bg-navy-900 border border-defence-amber/40 text-defence-amber">
            Non-Repudiation Engine
          </span>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex space-x-2 border-b border-navy-800 pb-3">
        <button
          onClick={() => { setActiveMode('text'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeMode === 'text'
              ? 'bg-navy-700 text-defence-gold border border-defence-gold/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Suspected Text Leak (Zero-Width Stego)</span>
        </button>
        <button
          onClick={() => { setActiveMode('image'); setAttributionResult(null); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeMode === 'image'
              ? 'bg-navy-700 text-defence-cyan border border-defence-cyan/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Suspected Screenshot / Scan (2D DCT-QIM)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form Column */}
        <div className="lg:col-span-6 space-y-4">
          {activeMode === 'text' ? (
            <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Leaked Text Excerpt / Paste
                </label>
                <span className="text-[11px] text-slate-400">
                  {leakedText.length} characters
                </span>
              </div>
              <textarea
                rows={10}
                value={leakedText}
                onChange={(e) => setLeakedText(e.target.value)}
                placeholder="Paste intercepted operational memo, telegram message, or dark web paste..."
                className="w-full bg-navy-900 border border-navy-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-defence-gold leading-relaxed"
              />
              <button
                onClick={handleTextAnalysis}
                disabled={isAnalyzing || !leakedText.trim()}
                className="w-full py-2.5 px-4 bg-defence-amber hover:bg-amber-500 text-navy-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>{isAnalyzing ? 'Extracting Steganography & Querying Ledger...' : 'Run Forensic Attribution Audit'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-5 space-y-4">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Upload Intercepted Image or Screenshot
              </label>

              <div className="border-2 border-dashed border-navy-700 rounded-lg p-6 text-center hover:border-defence-cyan transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <div className="text-xs text-slate-300 font-semibold">Click to select intercepted image file</div>
                <div className="text-[10px] text-slate-500 mt-1">PNG, JPG, TIFF, or BMP</div>
              </div>

              {imagePreview && (
                <div className="p-2 bg-navy-950 border border-navy-800 rounded-lg">
                  <img src={imagePreview} alt="Suspect Artifact" className="max-h-48 mx-auto rounded object-contain" />
                </div>
              )}

              <button
                onClick={handleImageAnalysis}
                disabled={isAnalyzing || !selectedFile}
                className="w-full py-2.5 px-4 bg-defence-cyan hover:bg-cyan-400 text-navy-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>{isAnalyzing ? 'Running 2D Block-DCT QIM Extraction...' : 'Extract Visual DCT Watermark'}</span>
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/70 border border-red-800 rounded-lg text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Forensic Report Column */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-5 min-h-[350px]">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-defence-gold" />
              <span>Official Forensic Attribution Verdict</span>
            </h3>

            {attributionResult ? (
              attributionResult.is_attributed ? (
                <div className="space-y-4 text-xs font-mono">
                  {/* Verdict Badge */}
                  <div className="p-3 bg-red-950/60 border border-red-600 rounded-lg flex items-center justify-between text-red-300">
                    <div className="flex items-center space-x-2">
                      <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                      <span className="font-bold text-sm text-red-200">LEAK ATTRIBUTED</span>
                    </div>
                    <span className="text-[11px] font-bold bg-red-900/80 px-2 py-0.5 rounded text-red-100">
                      {Math.round(attributionResult.confidence_score * 100)}% CONFIDENCE
                    </span>
                  </div>

                  {/* Identified Officer Card */}
                  <div className="p-4 bg-navy-950 border border-navy-800 rounded-lg space-y-2">
                    <div className="text-slate-400 text-[11px] flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-defence-gold" />
                      <span>IDENTIFIED RECIPIENT SOURCE:</span>
                    </div>
                    <div className="text-base font-bold text-white pl-5">
                      {attributionResult.leaker_name}
                    </div>
                    <div className="text-slate-300 text-xs pl-5">
                      ID: <span className="text-defence-cyan">{attributionResult.leaker_id}</span>
                    </div>
                    <div className="text-slate-400 text-[11px] pl-5">
                      Unit: {attributionResult.leaker_unit}
                    </div>
                  </div>

                  {/* Cryptographic Verification Details */}
                  <div className="p-4 bg-navy-950 border border-navy-800 rounded-lg space-y-2 text-[11px]">
                    <div className="text-slate-400 font-bold mb-1">EVIDENCE VERIFICATION AUDIT:</div>
                    <div className="flex items-center justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-400">Decryption Time:</span>
                      <span className="text-slate-200 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{attributionResult.decryption_time_str}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-400">Master Secret HMAC:</span>
                      <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>CRYPTOGRAPHICALLY VALID</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-navy-900">
                      <span className="text-slate-400">Blockchain Ledger Proof:</span>
                      <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>BLOCK #{attributionResult.ledger_block_index} ANCHORED</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">Steganographic Carrier:</span>
                      <span className="text-defence-gold font-semibold">{attributionResult.evidence_type}</span>
                    </div>
                  </div>

                  {/* Summary Narrative */}
                  <div className="p-3 bg-navy-900 rounded-lg text-slate-300 text-[11px] leading-relaxed border border-navy-800">
                    {attributionResult.forensic_summary}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-navy-950 border border-slate-700 rounded-lg text-center space-y-2 text-xs">
                  <XCircle className="w-8 h-8 text-slate-500 mx-auto" />
                  <div className="text-slate-300 font-semibold">No Watermark Detected</div>
                  <p className="text-slate-500 text-[11px] max-w-sm mx-auto">
                    The provided snippet does not contain valid zero-width Unicode steganography or DCT-QIM markers.
                  </p>
                </div>
              )
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 text-xs border border-dashed border-navy-700 rounded-lg p-6">
                <Search className="w-8 h-8 text-slate-600 mb-2" />
                <div className="font-semibold text-slate-400">Awaiting Suspect Material</div>
                <p className="max-w-xs text-[11px] text-slate-500 mt-1">
                  Paste leaked text or upload an intercepted image to initiate automated cryptographic attribution.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
