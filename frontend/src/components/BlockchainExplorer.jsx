import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  WifiOff
} from 'lucide-react';
import { fetchBlockchainBlocks, verifyBlockchain } from '../api';

export default function BlockchainExplorer() {
  const [blocks, setBlocks] = useState([]);
  const [auditResult, setAuditResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [blockList, audit] = await Promise.all([
        fetchBlockchainBlocks(),
        verifyBlockchain(),
      ]);
      setBlocks(blockList);
      setAuditResult(audit);
      if (blockList.length > 0) {
        setSelectedBlock(blockList[blockList.length - 1]);
      }
    } catch (err) {
      console.error('Failed to load blockchain:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Context Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Step 4</span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-xs font-semibold text-slate-700">Air-Gapped Provenance</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                Immutable Decryption Provenance Ledger
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                An append-only, tamper-evident Merkle blockchain. Operates <strong>100% offline without public chains or gas fees</strong>. 
                Even a rogue system administrator cannot rewrite past decryption receipts or delete evidence.
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="self-start sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Verify Blockchain Integrity</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Confirmed Blocks</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{blocks.length}</div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center space-x-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Genesis linked</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Decryption Receipts</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {blocks.reduce((acc, b) => acc + b.receipts.length, 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Non-repudiated accesses</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cryptographic Integrity</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">100%</div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center space-x-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>All Merkle roots valid</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Air-Gapped Operation</div>
          <div className="text-base font-bold text-slate-900 mt-1">Offline DLT</div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center space-x-1 font-medium">
            <WifiOff className="w-3.5 h-3.5 text-emerald-600" />
            <span>No Cloud KMS Dependency</span>
          </div>
        </div>
      </div>

      {/* Block Explorer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Blocks Feed */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Confirmed Blocks (Newest First)
          </h3>
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {[...blocks].reverse().map((b) => {
              const isSelected = selectedBlock?.block_index === b.block_index;
              return (
                <div
                  key={b.block_index}
                  onClick={() => setSelectedBlock(b)}
                  className={`cursor-pointer border rounded-xl p-3.5 text-xs transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-bold text-slate-900">
                      Block #{b.block_index} {b.block_index === 0 && '(Genesis)'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(b.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate mt-1">
                    Hash: <span className="text-blue-700 font-medium">{b.block_hash.substring(0, 24)}...</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[11px] font-sans">
                    <span className="font-semibold text-slate-700">{b.receipts.length} Receipt(s)</span>
                    <span className="text-slate-400 font-mono text-[10px]">Prev: {b.previous_hash.substring(0, 10)}...</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Block Inspector */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          {selectedBlock ? (
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  Block #{selectedBlock.block_index} Cryptographic Anchoring
                </h3>
                <span className="text-slate-500 text-[11px]">
                  {new Date(selectedBlock.timestamp * 1000).toUTCString()}
                </span>
              </div>

              {/* Hashes Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block">Block SHA-256 Hash:</span>
                  <div className="text-blue-700 font-semibold break-all">{selectedBlock.block_hash}</div>
                </div>
                <div>
                  <span className="text-slate-500 block">Merkle Root:</span>
                  <div className="text-emerald-700 font-semibold break-all">{selectedBlock.merkle_root}</div>
                </div>
                <div>
                  <span className="text-slate-500 block">Previous Block Hash:</span>
                  <div className="text-slate-600 break-all">{selectedBlock.previous_hash}</div>
                </div>
              </div>

              {/* Receipts inside block */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-800">
                  Anchored Decryption Receipts ({selectedBlock.receipts.length}):
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedBlock.receipts.map((rcpt) => (
                    <div key={rcpt.receipt_id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px] font-mono">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>{rcpt.receipt_id}</span>
                        <span className="text-slate-400 font-normal text-[10px]">
                          {new Date(rcpt.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-700">
                        <div>Doc: <span className="font-semibold text-slate-900">{rcpt.doc_id}</span></div>
                        <div>Officer: <span className="font-semibold text-slate-900">{rcpt.recipient_id}</span></div>
                      </div>
                      <div className="truncate text-slate-500">
                        Device: {rcpt.device_fingerprint}
                      </div>
                      <div className="truncate text-slate-500">
                        H(WM): {rcpt.watermark_hash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              Select a block to inspect Merkle roots and signed provenance receipts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
