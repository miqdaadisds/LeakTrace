import React, { useState } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Link2, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  Server,
  FileCheck2
} from 'lucide-react';
import { verifyLedgerIntegrity } from '../api';

export default function BlockchainExplorer({ blocks, onRefreshBlocks }) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyLedgerIntegrity();
      setVerificationResult(res);
      if (onRefreshBlocks) onRefreshBlocks();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const validatorNodes = [
    { id: 'NODE-01', name: 'Validator NODE-01', loc: 'Permissioned Notary Identity 1' },
    { id: 'NODE-02', name: 'Validator NODE-02', loc: 'Permissioned Notary Identity 2' },
    { id: 'NODE-03', name: 'Validator NODE-03', loc: 'Permissioned Notary Identity 3' },
    { id: 'NODE-04', name: 'Validator NODE-04', loc: 'Permissioned Notary Identity 4' },
  ];

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
            Permissioned offline DLT with SHA-256 block chaining, RFC 6962 Merkle tree roots, and 4 logical permissioned validators (NODE-01 to NODE-04, 3-of-4 quorum).
          </p>
        </div>

        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
        >
          {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          <span>Verify Blockchain Integrity</span>
        </button>
      </div>

      {/* Verification Alert Banner */}
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

      {/* 4 Notary Nodes Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {validatorNodes.map((node) => (
          <div key={node.id} className="apple-glass-card p-4 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Server className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900">{node.name}</div>
              <div className="text-[10px] text-slate-500">{node.loc}</div>
              <span className="text-[9px] font-bold text-indigo-700">3-of-4 Quorum Node</span>
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
                  {block.validator_signatures?.length || 4}/4 Notary Endorsements
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
              <span className="text-xs font-semibold text-slate-700 block">
                Committed Decryption Provenance Receipts ({block.receipts.length}):
              </span>
              <div className="space-y-2">
                {block.receipts.map((receipt) => (
                  <div key={receipt.receipt_id} className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="text-indigo-700">{receipt.receipt_id}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(receipt.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[11px] text-slate-600">
                      <div>Recipient: <span className="font-semibold text-slate-800">{receipt.recipient_id}</span></div>
                      <div>Watermark: <span className="font-semibold text-blue-700">{receipt.watermark_id}</span></div>
                      <div>Session: <span className="text-slate-800">{receipt.session_id}</span></div>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate pt-1">
                      ML-DSA-65 Signature: {receipt.recipient_signature_b64.substring(0, 48)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
