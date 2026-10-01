import React, { useState } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Link2, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  ShieldAlert,
  Server
} from 'lucide-react';
import { verifyLedgerIntegrity, runTamperTest } from '../api';

export default function BlockchainExplorer({ blocks, onRefreshBlocks }) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isTampering, setIsTampering] = useState(false);
  const [tamperResult, setTamperResult] = useState(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    setTamperResult(null);
    try {
      const res = await verifyLedgerIntegrity();
      setVerificationResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTamperTest = async () => {
    if (blocks.length <= 1) {
      alert('Decrypt at least one document first to create Block #1 before running the tamper simulation.');
      return;
    }
    setIsTampering(true);
    setVerificationResult(null);
    try {
      const res = await runTamperTest(1, 'COMPROMISED-ATTACKER');
      setTamperResult(res);
      if (onRefreshBlocks) onRefreshBlocks();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTampering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="apple-glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Database className="w-5 h-5 text-blue-600" />
            <span>Immutable Provenance Ledger & Multi-Validator DLT</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Permissioned offline DLT with SHA-256 block chaining, Merkle roots, and 3 independent notary validator nodes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>Verify Blockchain Integrity</span>
          </button>

          <button
            onClick={handleTamperTest}
            disabled={isTampering}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            {isTampering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            <span>Simulate Historical Tamper</span>
          </button>
        </div>
      </div>

      {/* Verification or Tamper Alert Banner */}
      {verificationResult && (
        <div className={`apple-glass p-4 rounded-xl border ${
          verificationResult.is_valid
            ? 'border-emerald-300 bg-emerald-50/80 text-emerald-900'
            : 'border-red-300 bg-red-50/80 text-red-900'
        }`}>
          <div className="flex items-center space-x-2 font-bold text-xs">
            {verificationResult.is_valid ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
            <span>{verificationResult.message}</span>
          </div>
        </div>
      )}

      {tamperResult && (
        <div className="apple-glass p-4 rounded-xl border border-red-300 bg-red-50/80 text-red-900 space-y-2 text-xs">
          <div className="flex items-center space-x-2 font-bold">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>Tamper Test Completed: Modification Immediately Detected!</span>
          </div>
          <p className="text-[11px] text-red-800">
            {tamperResult.verification_result.message}
          </p>
          <div className="font-mono text-[10px] text-slate-700">
            Altered Block #{tamperResult.tamper_details.tampered_block_index}: Original ({tamperResult.tamper_details.original_recipient_id}) &rarr; Tampered ({tamperResult.tamper_details.tampered_recipient_id})
          </div>
        </div>
      )}

      {/* Notary Nodes Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { id: 'VAL-NODE-ALPHA', name: 'Notary Node Alpha', loc: 'WESEE New Delhi Enclave' },
          { id: 'VAL-NODE-BRAVO', name: 'Notary Node Bravo', loc: 'Western Command Mumbai' },
          { id: 'VAL-NODE-CHARLIE', name: 'Notary Node Charlie', loc: 'Eastern Command Vizag' },
        ].map((node) => (
          <div key={node.id} className="apple-glass-card p-4 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Server className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900">{node.name}</div>
              <div className="text-[10px] text-slate-500">{node.loc}</div>
              <span className="text-[9px] font-bold text-emerald-700">2-of-3 Quorum Signer</span>
            </div>
          </div>
        ))}
      </div>

      {/* Blocks List */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Chained Ledger Blocks ({blocks.length})</span>
        </h3>

        {blocks.map((block) => (
          <div key={block.block_index} className="apple-glass-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">
                  Block #{block.block_index}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {new Date(block.timestamp * 1000).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {block.validator_signatures?.length || 3}/3 Notary Endorsements
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  CONFIRMED
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
              <div className="truncate">
                <span className="text-slate-500 block text-[10px]">Block Hash</span>
                <span className="font-semibold text-slate-900">{block.block_hash}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-500 block text-[10px]">Previous Hash</span>
                <span className="text-slate-700">{block.previous_hash}</span>
              </div>
              <div className="truncate sm:col-span-2">
                <span className="text-slate-500 block text-[10px]">Merkle Root</span>
                <span className="text-blue-700 font-semibold">{block.merkle_root}</span>
              </div>
            </div>

            {/* Receipts inside block */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700">
                Anchored Decryption Receipts ({block.receipts.length})
              </div>
              {block.receipts.map((rcpt) => (
                <div key={rcpt.receipt_id} className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{rcpt.receipt_id}</span>
                    <span className="text-[10px] font-mono text-blue-600 font-bold">{rcpt.watermark_id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                    <div>Recipient: <span className="font-bold text-slate-900">{rcpt.recipient_id}</span></div>
                    <div>Session: <span className="text-slate-800">{rcpt.session_id}</span></div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    ML-DSA Sig: {rcpt.recipient_signature_b64.substring(0, 32)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
