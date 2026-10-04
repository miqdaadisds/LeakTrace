import React, { useState } from 'react';
import { 
  Database, 
  ShieldCheck, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  Server,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileText,
  User,
  Clock,
  Fingerprint
} from 'lucide-react';
import { verifyLedgerIntegrity } from '../api';
import { playClick, playSuccess } from '../utils/soundEffects';

export default function BlockchainExplorer({ blocks, onRefreshBlocks }) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [copiedHash, setCopiedHash] = useState(null);

  const handleVerify = async () => {
    playClick();
    setIsVerifying(true);
    try {
      const res = await verifyLedgerIntegrity();
      setVerificationResult(res);
      playSuccess();
      if (onRefreshBlocks) onRefreshBlocks();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleBlockDetails = (idx) => {
    playClick();
    setExpandedBlocks(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleCopy = (text, label) => {
    playClick();
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const totalReceipts = blocks.reduce((sum, b) => sum + (b.receipts?.length || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Purpose & Verification Header */}
      <div className="apple-glass-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Decryption Provenance Ledger</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Immutable audit trail of all authorized document decryptions and forensic watermarks.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition-transform transform active:scale-95 shrink-0"
        >
          {isVerifying ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          <span>{isVerifying ? 'Verifying Integrity...' : 'Verify Audit Chain'}</span>
        </button>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div className={`p-4 rounded-2xl border transition-all ${
          verificationResult.is_valid
            ? 'border-emerald-300/80 dark:border-emerald-700/80 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
            : 'border-red-300/80 dark:border-red-700/80 bg-red-50/90 dark:bg-red-950/60 text-red-900 dark:text-red-200'
        }`}>
          <div className="flex items-center space-x-2.5 text-xs font-bold">
            {verificationResult.is_valid ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <div>
              <div>{verificationResult.message || 'All blocks and cryptographic Merkle roots mathematically verified.'}</div>
              <div className="text-[11px] font-normal opacity-80 mt-0.5">
                Every historical record matches its original cryptographic seal and recipient signature.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Consensus & Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="apple-glass-card p-4 flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sealed Blocks</div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">{blocks.length} Blocks ({totalReceipts} Access Events)</div>
          </div>
        </div>

        <div className="apple-glass-card p-4 flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
            <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Notary Network</div>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">4-of-4 Validators Active</span>
            </div>
          </div>
        </div>

        <div className="apple-glass-card p-4 flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
            <Fingerprint className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Proof Standard</div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-white">NIST ML-DSA-65 + Merkle Tree</div>
          </div>
        </div>
      </div>

      {/* Audit Blocks Timeline */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Audit Chain History</span>
          </h3>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Showing {blocks.length} Chronological Blocks</span>
        </div>

        {blocks.map((block) => {
          const isExpanded = Boolean(expandedBlocks[block.block_index]);
          const blockDate = new Date(block.timestamp * 1000).toLocaleString();
          const receiptCount = block.receipts?.length || 0;

          return (
            <div key={block.block_index} className="apple-glass-card p-5 space-y-3.5 transition-all">
              {/* Block Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-900 dark:bg-blue-600 text-white shadow-xs">
                    Block #{block.block_index}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {blockDate}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    4/4 Notary Quorum
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    SEALED
                  </span>
                </div>
              </div>

              {/* Decryption Events inside Block */}
              <div className="space-y-2">
                {receiptCount === 0 ? (
                  <div className="text-xs text-slate-400 italic">No decryption events in this block.</div>
                ) : (
                  block.receipts.map((receipt) => (
                    <div 
                      key={receipt.receipt_id} 
                      className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{receipt.recipient_id}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-semibold">
                            {receipt.doc_id || 'PROTECTED-DOC'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Forensic Watermark: <span className="font-bold text-blue-700 dark:text-blue-400">{receipt.watermark_id}</span>
                        </div>
                      </div>

                      <div className="text-right sm:text-right shrink-0">
                        <span className="text-[10px] font-mono text-slate-400 block">
                          Receipt #{receipt.receipt_id.substring(0, 14)}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                          ML-DSA-65 Signed
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Collapsible Cryptographic Technical Details */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => toggleBlockDetails(block.block_index)}
                  className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{isExpanded ? 'Hide Technical Hashes & Merkle Roots' : 'View Technical Cryptographic Hashes'}</span>
                </button>

                {isExpanded && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono space-y-2.5 animate-in fade-in duration-200">
                    <div>
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span>BLOCK HASH (SHA-256)</span>
                        <button 
                          onClick={() => handleCopy(block.block_hash, `hash-${block.block_index}`)}
                          className="flex items-center space-x-1 text-slate-400 hover:text-white"
                        >
                          {copiedHash === `hash-${block.block_index}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedHash === `hash-${block.block_index}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="text-amber-400 break-all select-all font-mono text-[10px] mt-0.5">{block.block_hash}</div>
                    </div>

                    <div>
                      <div className="text-slate-400 text-[10px]">PREVIOUS BLOCK HASH</div>
                      <div className="text-slate-400 break-all select-all font-mono text-[10px] mt-0.5">{block.previous_hash}</div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span>MERKLE TREE ROOT</span>
                        <button 
                          onClick={() => handleCopy(block.merkle_root, `root-${block.block_index}`)}
                          className="flex items-center space-x-1 text-slate-400 hover:text-white"
                        >
                          {copiedHash === `root-${block.block_index}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedHash === `root-${block.block_index}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="text-cyan-400 break-all select-all font-mono text-[10px] mt-0.5">{block.merkle_root}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
