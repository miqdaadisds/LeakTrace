import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  UserCheck, 
  Key, 
  LockOpen, 
  FileCheck, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  ShieldAlert, 
  Copy, 
  Check, 
  Fingerprint 
} from 'lucide-react';
import { fetchOfficerCredentials, decryptDocument } from '../api';

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

  const handleCopyLeakedText = () => {
    if (!decryptedResult) return;
    navigator.clipboard.writeText(decryptedResult.plaintext_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (onSimulateLeak) {
      onSimulateLeak(decryptedResult.plaintext_content);
    }
  };

  const currentOfficer = officers.find(o => o.recipient_id === selectedOfficerId);

  return (
    <div className="space-y-6">
      {/* Intro Context Card */}
      <div className="bg-navy-800/80 border border-navy-700 rounded-xl p-5 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-defence-gold" />
              <span>Decryption Terminal & Dynamic Forensic Attribution</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              When an authorized commander decrypts a document, the client decapsulates the hybrid CEK, verifies 
              its envelope, and <strong className="text-slate-200">dynamically injects an invisible zero-width steganographic watermark</strong>. 
              Simultaneously, a digitally signed Decryption Provenance Receipt is minted onto the immutable Merkle blockchain.
            </p>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 text-xs font-mono font-bold rounded bg-navy-900 border border-emerald-500/40 text-emerald-400">
            Decryption-Time Binding
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Terminal Configuration Panel */}
        <div className="lg:col-span-4 space-y-4">
          {/* Officer Identity Selector */}
          <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-5 space-y-3">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <UserCheck className="w-4 h-4 text-defence-cyan" />
              <span>Active Terminal Officer Identity</span>
            </label>
            <select
              value={selectedOfficerId}
              onChange={(e) => setSelectedOfficerId(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-defence-gold"
            >
              {officers.map((o) => (
                <option key={o.recipient_id} value={o.recipient_id}>
                  {o.name} ({o.recipient_id})
                </option>
              ))}
            </select>

            {credentials && (
              <div className="p-3 bg-navy-950 border border-navy-800 rounded-lg space-y-1.5 text-[11px] font-mono">
                <div className="text-defence-gold font-bold">{credentials.name}</div>
                <div className="text-slate-400">{credentials.unit}</div>
                <div className="text-defence-cyan text-[10px]">{credentials.clearance}</div>
                <div className="pt-2 border-t border-navy-800 text-[10px] text-slate-500 truncate">
                  X25519 PK: {credentials.public_key_x25519_b64.substring(0, 24)}...
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  ML-KEM PK: {credentials.public_key_pqc_b64.substring(0, 24)}...
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Ed25519 PK: {credentials.public_key_sig_b64.substring(0, 24)}...
                </div>
              </div>
            )}
          </div>

          {/* Document Package Selector */}
          <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-5 space-y-3">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-defence-gold" />
              <span>Incoming Operational Envelope</span>
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-defence-gold"
            >
              {documents.map((d) => (
                <option key={d.doc_id} value={d.doc_id}>
                  {d.title}
                </option>
              ))}
            </select>

            <button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50"
            >
              <LockOpen className="w-4 h-4" />
              <span>{isDecrypting ? 'Decapsulating & Minting Provenance...' : 'Authorize Decryption & Audit Log'}</span>
            </button>

            {error && (
              <div className="p-3 bg-red-950/70 border border-red-800 rounded-lg text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Decrypted Document & Provenance Receipt Viewer */}
        <div className="lg:col-span-8 space-y-4">
          {decryptedResult ? (
            <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-5 space-y-4">
              {/* Classification Banner */}
              <div className="bg-red-900/40 border border-red-700/60 px-4 py-2 rounded-lg flex items-center justify-between text-xs font-mono">
                <span className="text-red-300 font-bold tracking-wider">{decryptedResult.classification}</span>
                <span className="text-slate-400">DOC: {decryptedResult.doc_id}</span>
              </div>

              {/* Document Text Display */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {decryptedResult.title}
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowWatermarkInspect(!showWatermarkInspect)}
                      className="px-2.5 py-1 text-[11px] font-mono rounded bg-navy-900 border border-navy-700 text-defence-cyan hover:text-white flex items-center space-x-1"
                    >
                      {showWatermarkInspect ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showWatermarkInspect ? 'Hide Stego Bytes' : 'Inspect Stego Bits'}</span>
                    </button>
                    <button
                      onClick={handleCopyLeakedText}
                      className="px-2.5 py-1 text-[11px] font-mono rounded bg-defence-gold text-navy-950 font-bold hover:bg-amber-400 flex items-center space-x-1 shadow"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied with Stego!' : '1-Click Leak to Lab'}</span>
                    </button>
                  </div>
                </div>

                {/* Plaintext Area */}
                <div className="p-4 bg-navy-950 border border-navy-800 rounded-lg text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {decryptedResult.plaintext_content}
                </div>

                {/* Stego Bit Inspector View */}
                {showWatermarkInspect && (
                  <div className="p-3 bg-navy-900 border border-defence-cyan/40 rounded-lg text-xs font-mono space-y-1 text-defence-cyan">
                    <div className="font-bold text-white flex items-center space-x-1.5">
                      <Fingerprint className="w-4 h-4 text-defence-gold" />
                      <span>Hidden Steganographic Payload (Zero-Width Unicode Bits)</span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Encoded Format: <span className="text-white">SIH26237:{decryptedResult.watermark_payload.doc_id}:{decryptedResult.watermark_payload.recipient_id}:{parseInt(decryptedResult.watermark_payload.timestamp)}:{decryptedResult.watermark_payload.session_nonce}:{decryptedResult.watermark_payload.hmac_sig}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Invisible to human eye, but firmly bound to {currentOfficer?.name} ({decryptedResult.watermark_payload.recipient_id}).
                    </div>
                  </div>
                )}
              </div>

              {/* Provenance Blockchain Receipt */}
              <div className="p-4 rounded-lg bg-navy-900 border border-emerald-500/30 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-400 font-bold flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4" />
                    <span>NON-REPUDIATION DECRYPTION RECEIPT ANCHORED</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Blockchain Block <strong className="text-white">#{decryptedResult.ledger_block_index}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-500">Receipt ID: </span>
                    <span className="text-white">{decryptedResult.receipt.receipt_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Device Node: </span>
                    <span className="text-white">{decryptedResult.receipt.device_fingerprint}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500">Watermark Hash H(WM): </span>
                    <span className="text-defence-gold">{decryptedResult.receipt.watermark_hash.substring(0, 20)}...</span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500">Ed25519 Recipient Sig: </span>
                    <span className="text-slate-400">{decryptedResult.receipt.recipient_signature_b64.substring(0, 20)}...</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-12 text-center text-slate-500 text-xs space-y-2">
              <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-slate-400 font-semibold">Terminal Standby</div>
              <p className="max-w-md mx-auto text-[11px]">
                Select an officer identity and click &quot;Authorize Decryption&quot; to execute client decapsulation and record an immutable receipt on the Merkle blockchain.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
