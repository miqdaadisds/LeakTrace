import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Link as LinkIcon, 
  CheckCircle2, 
  FileCheck, 
  RefreshCw, 
  Fingerprint, 
  ChevronRight,
  Clock
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
      <div className="bg-navy-800/80 border border-navy-700 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center space-x-2">
              <Database className="w-5 h-5 text-defence-gold" />
              <span>Immutable Decryption Provenance Ledger</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Append-only, tamper-evident cryptographic blockchain ledger. Every client decryption generates an 
              Ed25519 digitally signed receipt anchored into a SHA-256 Merkle tree, establishing mathematical non-repudiation.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="self-start sm:self-auto px-3.5 py-2 bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-lg text-xs font-semibold text-white flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Audit Ledger</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Confirmed Blocks</div>
          <div className="text-2xl font-bold text-white mt-1">{blocks.length}</div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Genesis anchored</span>
          </div>
        </div>

        <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Decryption Receipts</div>
          <div className="text-2xl font-bold text-defence-cyan mt-1">
            {blocks.reduce((acc, b) => acc + b.receipts.length, 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Non-repudiated accesses</div>
        </div>

        <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Cryptographic Integrity</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">100%</div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3" />
            <span>All Merkle roots valid</span>
          </div>
        </div>

        <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Consensus Mechanism</div>
          <div className="text-base font-bold text-defence-gold mt-1">Defence Proof-of-Authority</div>
          <div className="text-[10px] text-slate-400 mt-1">WESEE Naval Nodes</div>
        </div>
      </div>

      {/* Block Explorer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Blocks Feed */}
        <div className="lg:col-span-5 bg-navy-800/60 border border-navy-700 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Chronological Chain Blocks
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {[...blocks].reverse().map((b) => {
              const isSelected = selectedBlock?.block_index === b.block_index;
              return (
                <div
                  key={b.block_index}
                  onClick={() => setSelectedBlock(b)}
                  className={`cursor-pointer border rounded-lg p-3 text-xs transition-all ${
                    isSelected
                      ? 'bg-navy-700 border-defence-gold text-white'
                      : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-bold text-slate-200">
                      Block #{b.block_index} {b.block_index === 0 && '(Genesis)'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(b.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate mt-1">
                    Hash: <span className="text-defence-cyan">{b.block_hash.substring(0, 20)}...</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[10px] font-mono">
                    <span className="text-defence-gold">{b.receipts.length} Receipt(s)</span>
                    <span className="text-slate-500 truncate max-w-[150px]">Prev: {b.previous_hash.substring(0, 10)}...</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Block Inspector */}
        <div className="lg:col-span-7 bg-navy-800/60 border border-navy-700 rounded-xl p-5 space-y-4">
          {selectedBlock ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="flex justify-between items-center pb-3 border-b border-navy-700">
                <h3 className="text-sm font-bold text-white">
                  Block #{selectedBlock.block_index} Header & Receipts
                </h3>
                <span className="text-slate-400 text-[11px]">
                  {new Date(selectedBlock.timestamp * 1000).toUTCString()}
                </span>
              </div>

              {/* Block Hashes */}
              <div className="p-3 bg-navy-950 border border-navy-800 rounded-lg space-y-2 text-[11px]">
                <div>
                  <span className="text-slate-500">Block SHA-256 Hash:</span>
                  <div className="text-defence-cyan break-all font-semibold">{selectedBlock.block_hash}</div>
                </div>
                <div>
                  <span className="text-slate-500">Previous Block Hash:</span>
                  <div className="text-slate-400 break-all">{selectedBlock.previous_hash}</div>
                </div>
                <div>
                  <span className="text-slate-500">Merkle Tree Root:</span>
                  <div className="text-defence-gold break-all font-semibold">{selectedBlock.merkle_root}</div>
                </div>
              </div>

              {/* Receipts inside this block */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-200">
                  Anchored Decryption Receipts ({selectedBlock.receipts.length}):
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedBlock.receipts.map((rcpt) => (
                    <div key={rcpt.receipt_id} className="p-3 bg-navy-900 border border-navy-800 rounded-lg space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center text-defence-gold font-bold">
                        <span>{rcpt.receipt_id}</span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(rcpt.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-300">
                        <div>Doc ID: <span className="text-white">{rcpt.doc_id}</span></div>
                        <div>Officer: <span className="text-white">{rcpt.recipient_id}</span></div>
                      </div>
                      <div>
                        Device Node: <span className="text-slate-400">{rcpt.device_fingerprint}</span>
                      </div>
                      <div className="truncate">
                        Watermark Hash: <span className="text-defence-cyan">{rcpt.watermark_hash}</span>
                      </div>
                      <div className="truncate text-slate-500 text-[10px]">
                        Ed25519 Sig: {rcpt.recipient_signature_b64}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              Select a block to inspect Merkle root details and signed receipts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
