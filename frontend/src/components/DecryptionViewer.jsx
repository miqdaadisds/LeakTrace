import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  UserCheck, 
  LockOpen, 
  FileCheck, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Fingerprint,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { fetchOfficerCredentials, decryptDocument } from '../api';

export default function DecryptionViewer({ officers, documents, onDecrypted, onSimulateLeak, onGoToForensics }) {
  const [selectedOfficerId, setSelectedOfficerId] = useState(officers[0]?.recipient_id || '');
  const [credentials, setCredentials] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(documents[0]?.doc_id || '');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedResult, setDecryptedResult] = useState(null);
  const [showWatermarkInspect, setShowWatermarkInspect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedOfficerId) {
      loadCredentials(selectedOfficerId);
    }
  }, [selectedOfficerId]);

  useEffect(() => {
    if (documents.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].doc_id);
    }
  }, [documents]);

  const loadCredentials = async (officerId) => {
    try {
      const creds = await fetchOfficerCredentials(officerId);
      setCredentials(creds);
      setDecryptedResult(null);
      setError(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDecrypt = async () => {
    if (!credentials || !selectedDocId) return;
    setIsDecrypting(true);
    setError(null);

    try {
      const res = await decryptDocument({
        doc_id: selectedDocId,
        recipient_id: credentials.recipient_id,
        private_key_x25519_b64: credentials.private_key_x25519_b64,
        private_key_pqc_b64: credentials.private_key_pqc_b64,
        private_key_sig_b64: credentials.private_key_sig_b64,
        device_fingerprint: `NAVY-TERMINAL-${credentials.recipient_id.split('-')[2]}`,
      });
      setDecryptedResult(res);
      if (onDecrypted) onDecrypted(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Decryption failed: Access unauthorized.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleSimulateLeak = () => {
    if (!decryptedResult) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onSimulateLeak) {
      onSimulateLeak(decryptedResult.plaintext_content);
    }
  };

  const currentOfficer = officers.find(o => o.recipient_id === selectedOfficerId);

  return (
    <div className="space-y-6">
      {/* Step Explanation Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Step 2 of 3</span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-xs font-semibold text-slate-700">Officer Workstation</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                Decryption-Time Dynamic Attribution
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                When an officer opens the order, the software decapsulates the hybrid CEK, verifies their credentials, and 
                <strong> dynamically embeds an invisible forensic watermark</strong>. Simultaneously, their terminal signs a receipt with their <strong>ML-DSA post-quantum private key</strong> and anchors it to the immutable blockchain.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 bg-emerald-50 rounded-full text-xs font-semibold text-emerald-700 border border-emerald-200 shrink-0">
            NIST FIPS 204 ML-DSA Signed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Officer Selection & Terminal Config */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Select Active Officer Identity</span>
              </label>
              <select
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {officers.map((o) => (
                  <option key={o.recipient_id} value={o.recipient_id}>
                    {o.name} &bull; {o.recipient_id}
                  </option>
                ))}
              </select>
            </div>

            {credentials && (
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-2">
                <div className="font-bold text-slate-900">{credentials.name}</div>
                <div className="text-[11px] text-slate-500">{credentials.unit}</div>
                <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {credentials.clearance}
                </div>
                <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-400 font-mono truncate">
                  ML-DSA PK: {credentials.public_key_sig_b64.substring(0, 30)}...
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Select Order to Decrypt
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {documents.map((d) => (
                  <option key={d.doc_id} value={d.doc_id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
            >
              <LockOpen className="w-4 h-4" />
              <span>{isDecrypting ? 'Decapsulating & Minting Provenance...' : 'Authorize Decryption & View'}</span>
            </button>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Decrypted Document & Provenance Display */}
        <div className="lg:col-span-8 space-y-4">
          {decryptedResult ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              {/* Classification Banner */}
              <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-xl flex items-center justify-between text-xs font-mono">
                <span className="text-red-700 font-bold tracking-wider">{decryptedResult.classification}</span>
                <span className="text-slate-500">ID: {decryptedResult.doc_id}</span>
              </div>

              {/* Title & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">
                  {decryptedResult.title}
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowWatermarkInspect(!showWatermarkInspect)}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1.5 transition-all"
                  >
                    {showWatermarkInspect ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showWatermarkInspect ? 'Hide Stego Bits' : 'Inspect Invisible Bits'}</span>
                  </button>
                  <button
                    onClick={handleSimulateLeak}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Leaked to Clipboard!' : 'Simulate Leak to Forensic Lab'}</span>
                  </button>
                </div>
              </div>

              {/* Document Text Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {decryptedResult.plaintext_content}
              </div>

              {/* Stego Bit Inspector View */}
              {showWatermarkInspect && (
                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold text-blue-900 flex items-center space-x-1.5">
                    <Fingerprint className="w-4 h-4 text-blue-600" />
                    <span>Invisible Zero-Width Steganographic Payload (Found Between Words)</span>
                  </div>
                  <div className="text-[11px] text-blue-800 font-mono break-all">
                    SIH26237:{decryptedResult.watermark_payload.doc_id}:{decryptedResult.watermark_payload.recipient_id}:{parseInt(decryptedResult.watermark_payload.timestamp)}:{decryptedResult.watermark_payload.session_nonce}:{decryptedResult.watermark_payload.hmac_sig}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Invisible to the human eye, but mathematically binds this text to <strong>{currentOfficer?.name}</strong>.
                  </div>
                </div>
              )}

              {/* Provenance Blockchain Receipt */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-700 font-bold flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>NON-REPUDIATION DECRYPTION RECEIPT ANCHORED</span>
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Block #{decryptedResult.ledger_block_index}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                  <div>Receipt: <span className="text-slate-900 font-semibold">{decryptedResult.receipt.receipt_id}</span></div>
                  <div>Terminal: <span className="text-slate-900 font-semibold">{decryptedResult.receipt.device_fingerprint}</span></div>
                  <div className="truncate">H(WM): <span className="text-blue-600 font-semibold">{decryptedResult.receipt.watermark_hash.substring(0, 18)}...</span></div>
                  <div className="truncate">ML-DSA Sig: <span className="text-slate-800">{decryptedResult.receipt.recipient_signature_b64.substring(0, 18)}...</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400 text-xs space-y-2">
              <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-slate-700 font-semibold">Terminal Ready</div>
              <p className="max-w-md mx-auto text-slate-500 text-[11px]">
                Select an officer and click &ldquo;Authorize Decryption&rdquo; to decrypt the file, embed the invisible mark, and anchor the receipt to the blockchain.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
