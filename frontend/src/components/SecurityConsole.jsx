import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Key, 
  FileX, 
  Server, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Lock,
  UserX,
  RotateCcw,
  Layers,
  Cpu
} from 'lucide-react';
import { 
  fetchSecurityStatus, 
  revokeIdentity, 
  unrevokeIdentity, 
  revokeDocument, 
  runSecurityTamperTest, 
  restoreLedgerState,
  verifyLedgerIntegrity
} from '../api';

export default function SecurityConsole({ identities, activeDocs, onSecurityUpdated }) {
  const [securityData, setSecurityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Revoke forms
  const [selectedRecipientToRevoke, setSelectedRecipientToRevoke] = useState(identities[0]?.recipient_id || '');
  const [revokeReason, setRevokeReason] = useState('Suspected key compromise or clearance revocation');
  const [isRevoking, setIsRevoking] = useState(false);

  // Document retraction form
  const [selectedDocToRevoke, setSelectedDocToRevoke] = useState(activeDocs[0]?.doc_id || '');
  const [docRevokeReason, setDocRevokeReason] = useState('Operational directive distribution retracted');
  const [isRetracting, setIsRetracting] = useState(false);

  // Tamper detection state
  const [isTestingTamper, setIsTestingTamper] = useState(false);
  const [tamperResult, setTamperResult] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchSecurityStatus();
      setSecurityData(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load security status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRevokeIdentity = async (e) => {
    e.preventDefault();
    if (!selectedRecipientToRevoke) return;
    setIsRevoking(true);
    try {
      await revokeIdentity(selectedRecipientToRevoke, revokeReason);
      await loadData();
      if (onSecurityUpdated) onSecurityUpdated();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to revoke identity.');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleUnrevokeIdentity = async (recipientId) => {
    try {
      await unrevokeIdentity(recipientId);
      await loadData();
      if (onSecurityUpdated) onSecurityUpdated();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to restore identity.');
    }
  };

  const handleRevokeDocument = async (e) => {
    e.preventDefault();
    if (!selectedDocToRevoke) return;
    setIsRetracting(true);
    try {
      await revokeDocument(selectedDocToRevoke, docRevokeReason);
      await loadData();
      if (onSecurityUpdated) onSecurityUpdated();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to retract document.');
    } finally {
      setIsRetracting(false);
    }
  };

  const handleTamperTest = async () => {
    setIsTestingTamper(true);
    setTamperResult(null);
    try {
      const res = await runSecurityTamperTest(1, 'COMPROMISED-ATTACKER');
      setTamperResult(res);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Tamper audit failed.');
    } finally {
      setIsTestingTamper(false);
    }
  };

  const handleRestoreLedger = async () => {
    setIsRestoring(true);
    try {
      await restoreLedgerState(1, 'USER-BOB');
      setTamperResult(null);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Ledger restoration failed.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="apple-glass-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-blue-600" />
            <span>Security, Revocation & Blockchain Tamper Auditing</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            4-validator notary quorum health, post-quantum cryptographic standards, certificate revocation list (CRL), and live tamper detection.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* 4-Validator Notary Network Health */}
      <div className="apple-glass-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Server className="w-4 h-4 text-indigo-600" />
              <span>Permissioned Notary Validator Nodes (4-Node Quorum)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Strict consensus requirement: 3 of 4 independent validator nodes must independently sign block headers.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            3-of-4 QUORUM RULE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {securityData?.validator_network?.nodes.map((node) => (
            <div key={node.validator_id} className="p-3.5 bg-white/80 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">{node.validator_id}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="text-xs font-semibold text-slate-700">{node.name}</div>
              <div className="text-[10px] text-slate-400 font-medium">{node.location}</div>
              <div className="text-[9px] font-mono text-slate-500 truncate pt-1 border-t border-slate-100">
                PK: {node.public_key_b64.substring(0, 16)}...
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tamper Detection & Ledger Integrity Test */}
      <div className="apple-glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cryptographic Tamper-Evidence & Audit Test</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Demonstrates that no single administrator or compromised node can modify historical records undetected.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTamperTest}
              disabled={isTestingTamper}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              {isTestingTamper ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              <span>Test Historical Tamper Detection</span>
            </button>

            {tamperResult && (
              <button
                onClick={handleRestoreLedger}
                disabled={isRestoring}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                {isRestoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Restore Authentic Ledger</span>
              </button>
            )}
          </div>
        </div>

        {/* Verification Banner */}
        {tamperResult ? (
          <div className={`p-4 rounded-xl border ${
            tamperResult.verification_result.detected_tampering
              ? 'bg-red-50/90 border-red-300 text-red-900'
              : 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
          } space-y-2`}>
            <div className="flex items-center space-x-2 font-bold text-xs">
              {tamperResult.verification_result.detected_tampering ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>TAMPER DETECTED: Single Administrator Tampering Blocked</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Ledger Integrity 100% Verified</span>
                </>
              )}
            </div>
            <p className="text-xs leading-relaxed">
              {tamperResult.verification_result.message}
            </p>
            <div className="text-[11px] font-mono text-slate-700 pt-1 border-t border-red-200/50">
              Tampered Block: #{tamperResult.tamper_details.tampered_block_index} &bull; Attempted Recipient Alteration: {tamperResult.tamper_details.tampered_recipient_id}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{securityData?.ledger_integrity?.message || 'Ledger integrity verified across all blocks and 4 validator nodes.'}</span>
          </div>
        )}
      </div>

      {/* Revocation Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recipient Identity Revocation */}
        <div className="apple-glass-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <UserX className="w-3.5 h-3.5 text-red-600" />
              <span>Recipient Key Revocation (CRL)</span>
            </h4>
            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {securityData?.revocations?.revoked_identities.length || 0} Revoked
            </span>
          </div>

          <form onSubmit={handleRevokeIdentity} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Select Recipient to Revoke
              </label>
              <select
                value={selectedRecipientToRevoke}
                onChange={(e) => setSelectedRecipientToRevoke(e.target.value)}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-red-500"
              >
                {identities.map((i) => (
                  <option key={i.recipient_id} value={i.recipient_id}>
                    {i.name} ({i.recipient_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Revocation Justification
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason for revocation..."
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-red-500"
              />
            </div>

            <button
              type="submit"
              disabled={isRevoking}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50"
            >
              <span>Revoke Recipient Credentials</span>
            </button>
          </form>

          {/* Active Revocations List */}
          {securityData?.revocations?.revoked_identities.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 block">Active Revoked Credentials:</span>
              {securityData.revocations.revoked_identities.map((item) => (
                <div key={item.recipient_id} className="p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-red-900">{item.recipient_id}</span>
                    <p className="text-[10px] text-red-700">{item.reason}</p>
                  </div>
                  <button
                    onClick={() => handleUnrevokeIdentity(item.recipient_id)}
                    className="text-[10px] text-blue-700 font-semibold hover:underline"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Document Retraction */}
        <div className="apple-glass-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <FileX className="w-3.5 h-3.5 text-amber-600" />
              <span>Document Access Retraction</span>
            </h4>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {securityData?.revocations?.revoked_documents.length || 0} Retracted
            </span>
          </div>

          <form onSubmit={handleRevokeDocument} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Select Document to Retract
              </label>
              <select
                value={selectedDocToRevoke}
                onChange={(e) => setSelectedDocToRevoke(e.target.value)}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
              >
                {activeDocs.map((doc) => (
                  <option key={doc.doc_id} value={doc.doc_id}>
                    {doc.title} ({doc.doc_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Retraction Reason
              </label>
              <input
                type="text"
                value={docRevokeReason}
                onChange={(e) => setDocRevokeReason(e.target.value)}
                placeholder="Reason for document retraction..."
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isRetracting}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50"
            >
              <span>Retract Document Access</span>
            </button>
          </form>

          {/* Active Retracted Documents List */}
          {securityData?.revocations?.revoked_documents.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 block">Active Retracted Documents:</span>
              {securityData.revocations.revoked_documents.map((item) => (
                <div key={item.doc_id} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                  <span className="font-bold text-amber-900">{item.doc_id}</span>
                  <p className="text-[10px] text-amber-700">{item.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
