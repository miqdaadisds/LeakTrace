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
  Download,
  AlertTriangle
} from 'lucide-react';
import { fetchOfficerCredentials, decryptDocument, getDecryptedPdfDownloadUrl } from '../api';

export default function DecryptionViewer({ officers, documents, onDecrypted, onSimulateLeak }) {
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
        device_fingerprint: `WORKSTATION-${credentials.recipient_id}`,
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Officer Selection & Terminal Config */}
        <div className="lg:col-span-4 space-y-4">
          <div className="apple-glass-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Recipient Workstation</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                NIST ML-DSA-65
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Choose Recipient (e.g. Bob, Alice, Charlie)
              </label>
              <select
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                className="w-full bg-white/70 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {officers.map((o) => (
                  <option key={o.recipient_id} value={o.recipient_id}>
                    {o.name} ({o.recipient_id})
                  </option>
                ))}
              </select>
            </div>

            {credentials && (
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <div className="font-bold text-slate-900">{credentials.name}</div>
                <div className="text-[11px] text-slate-500">{credentials.unit}</div>
                <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {credentials.clearance}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Select Document to Decrypt
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full bg-white/70 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
            >
              <LockOpen className="w-4 h-4" />
              <span>{isDecrypting ? 'Decapsulating & Minting Provenance...' : 'Open & Decrypt Document'}</span>
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
            <div className="apple-glass-card p-6 space-y-4">
              {/* Classification Banner & Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider">
                    {decryptedResult.classification}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">
                    {decryptedResult.title}
                  </h3>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 shrink-0">
                  <a
                    href={getDecryptedPdfDownloadUrl(decryptedResult.doc_id, currentOfficer?.recipient_id)}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center space-x-1.5 transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </a>

                  <button
                    onClick={() => setShowWatermarkInspect(!showWatermarkInspect)}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1 transition-all"
                  >
                    {showWatermarkInspect ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showWatermarkInspect ? 'Hide Stego' : 'Inspect Bits'}</span>
                  </button>

                  <button
                    onClick={handleSimulateLeak}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{copied ? 'Leaked to Lab!' : 'Leak to Lab'}</span>
                  </button>
                </div>
              </div>

              {/* Document Text Box */}
              <div className="p-4 bg-white/80 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto shadow-inner">
                {decryptedResult.plaintext_content}
              </div>

              {/* Stego Bit Inspector View */}
              {showWatermarkInspect && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-blue-900 flex items-center space-x-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-blue-600" />
                    <span>Hidden Unicode Steganographic Sequence:</span>
                  </div>
                  <div className="text-[11px] text-blue-800 font-mono break-all bg-white/70 p-2 rounded border border-blue-200/60">
                    SIH26237:{decryptedResult.watermark_payload.doc_id}:{decryptedResult.watermark_payload.recipient_id}:{parseInt(decryptedResult.watermark_payload.timestamp)}:{decryptedResult.watermark_payload.session_nonce}:{decryptedResult.watermark_payload.hmac_sig}
                  </div>
                </div>
              )}

              {/* Provenance Blockchain Receipt */}
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-800 font-bold flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>ML-DSA Signed Receipt Anchored in Blockchain</span>
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900">
                    Block #{decryptedResult.ledger_block_index}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                  <div>Receipt: <span className="text-slate-900 font-semibold">{decryptedResult.receipt.receipt_id}</span></div>
                  <div>Device: <span className="text-slate-900 font-semibold">{decryptedResult.receipt.device_fingerprint}</span></div>
                  <div className="truncate">H(WM): <span className="text-blue-700 font-semibold">{decryptedResult.receipt.watermark_hash.substring(0, 20)}...</span></div>
                  <div className="truncate">ML-DSA Sig: <span className="text-slate-800">{decryptedResult.receipt.recipient_signature_b64.substring(0, 20)}...</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="apple-glass-card p-12 text-center text-slate-400 text-xs space-y-2">
              <Cpu className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-slate-700 font-semibold">Workstation Awaiting Decryption</div>
              <p className="max-w-md mx-auto text-slate-500 text-[11px]">
                Select a recipient (e.g. Bob) and click &ldquo;Authorize Decryption&rdquo; to decrypt, inject the invisible mark, and anchor the receipt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
