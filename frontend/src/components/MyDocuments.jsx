import React, { useState } from 'react';
import { 
  FolderLock, 
  KeyRound, 
  Unlock, 
  FileText, 
  Download, 
  Upload, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  FileCheck,
  Share2,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { 
  decryptSecurePackage, 
  getDecryptedPdfDownloadUrl, 
  getProvenanceReceiptDownloadUrl,
  importProvenanceReceiptFile
} from '../api';

export default function MyDocuments({ identities, activeDocs, onDecrypted }) {
  const [selectedRecipientId, setSelectedRecipientId] = useState(
    identities[0]?.recipient_id || ''
  );
  const [selectedDocId, setSelectedDocId] = useState(
    activeDocs[0]?.doc_id || ''
  );
  const [password, setPassword] = useState('');
  const [customPackageFile, setCustomPackageFile] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionResult, setDecryptionResult] = useState(null);
  const [error, setError] = useState(null);

  // Air-gapped receipt import state
  const [importingReceipt, setImportingReceipt] = useState(false);
  const [receiptImportSuccess, setReceiptImportSuccess] = useState(null);
  const [receiptImportError, setReceiptImportError] = useState(null);

  const selectedIdentity = identities.find((i) => i.recipient_id === selectedRecipientId);

  const handleDecrypt = async (e) => {
    if (e) e.preventDefault();
    if (!password) {
      setError('Password is required to unlock your encrypted credential vault.');
      return;
    }

    setIsDecrypting(true);
    setError(null);
    setDecryptionResult(null);

    const formData = new FormData();
    formData.append('password', password);
    formData.append('device_fingerprint', `WORKSTATION-${selectedRecipientId || 'AIRGAP'}`);

    if (customPackageFile) {
      formData.append('package_file', customPackageFile);
    } else {
      formData.append('doc_id', selectedDocId);
      formData.append('recipient_id', selectedRecipientId);
    }

    try {
      const res = await decryptSecurePackage(formData);
      setDecryptionResult(res);
      if (onDecrypted) onDecrypted(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Decryption Denied: Invalid credentials or corrupted vault.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleImportReceipt = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportingReceipt(true);
    setReceiptImportSuccess(null);
    setReceiptImportError(null);

    try {
      const res = await importProvenanceReceiptFile(file);
      setReceiptImportSuccess(`Receipt ${res.receipt_id} from ${res.recipient_id} anchored on Block #${res.block_index}`);
    } catch (err) {
      setReceiptImportError(err.response?.data?.detail || 'Receipt import failed: Invalid ML-DSA-65 signature.');
    } finally {
      setImportingReceipt(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="apple-glass-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <FolderLock className="w-4 h-4 text-blue-600" />
            <span>My Documents & Recipient Enclave</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Locally decrypt your assigned .secure container packages. Decryption generates a unique forensic watermark and ML-DSA-65 signed provenance receipt.
          </p>
        </div>

        {/* Air-gapped Receipt Import */}
        <div className="relative">
          <input
            type="file"
            accept=".receipt,.json"
            onChange={handleImportReceipt}
            disabled={importingReceipt}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <button
            type="button"
            className="px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-800 border border-slate-200/80 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            {importingReceipt ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-blue-600" />}
            <span>Sync Air-Gapped .receipt</span>
          </button>
        </div>
      </div>

      {receiptImportSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{receiptImportSuccess}</span>
        </div>
      )}

      {receiptImportError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{receiptImportError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Decryption Form */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleDecrypt} className="apple-glass-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-2 uppercase tracking-wider">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Local Recipient Decryption</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                CLIENT-SIDE
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Recipient Identity Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Active Recipient Identity
              </label>
              <select
                value={selectedRecipientId}
                onChange={(e) => setSelectedRecipientId(e.target.value)}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {identities.map((i) => (
                  <option key={i.recipient_id} value={i.recipient_id}>
                    {i.name} ({i.recipient_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Document Selection or Custom File */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Select Distributed Document or Load .secure File
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => {
                  setSelectedDocId(e.target.value);
                  setCustomPackageFile(null);
                }}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              >
                {activeDocs.map((doc) => (
                  <option key={doc.doc_id} value={doc.doc_id}>
                    {doc.title} ({doc.doc_id})
                  </option>
                ))}
              </select>

              <div className="relative border border-dashed border-slate-200 rounded-xl p-2.5 bg-white/50 text-center hover:bg-white/80 transition-colors">
                <input
                  type="file"
                  accept=".secure,.json"
                  onChange={(e) => setCustomPackageFile(e.target.files[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center space-x-2 text-slate-600 text-[11px]">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>{customPackageFile ? customPackageFile.name : 'Load portable .secure package from disk'}</span>
                </div>
              </div>
            </div>

            {/* Password input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Recipient Vault Passphrase
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter passphrase to unlock Argon2id vault..."
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Unlocked locally inside the recipient machine enclave (127.0.0.1). No password, private key, or plaintext ever leaves this machine or reaches any external network.
              </span>
            </div>

            <button
              type="submit"
              disabled={isDecrypting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
            >
              {isDecrypting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Unlock className="w-4 h-4 text-white" />
              )}
              <span>Decrypt & Fingerprint Locally</span>
            </button>
          </form>

          {/* Available Documents List */}
          <div className="apple-glass-card p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Enrolled Recipient Documents
            </h4>
            {activeDocs.map((doc) => {
              const myPkg = doc.packages?.find((p) => p.recipient_id === selectedRecipientId);
              return (
                <div key={doc.doc_id} className="p-3 bg-white/70 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{doc.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                      {doc.doc_id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {myPkg ? 'Encrypted Package Available' : 'No Access Key'}
                    </span>
                    {myPkg && (
                      <a
                        href={myPkg.download_url}
                        download={`Package-${doc.doc_id}-${selectedRecipientId}.secure`}
                        className="text-[11px] text-blue-600 hover:underline flex items-center space-x-1 font-semibold"
                      >
                        <Download className="w-3 h-3" />
                        <span>Save .secure</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Decrypted Document & Provenance Receipt */}
        <div className="lg:col-span-7 space-y-4">
          {decryptionResult ? (
            <div className="apple-glass-card p-6 space-y-5 border-emerald-200 bg-emerald-50/20">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="font-bold text-sm">Decrypted & Watermarked Document Ready</h3>
                    <p className="text-[11px] text-emerald-700">Forensically distinct copy for {decryptionResult.recipient_id}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Block #{decryptionResult.ledger_block_index}
                </span>
              </div>

              {/* Provenance Receipt Details */}
              <div className="bg-white/90 rounded-xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    <span>NIST ML-DSA-65 Provenance Receipt</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{decryptionResult.receipt.receipt_id}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 font-mono pt-1">
                  <div>Recipient ID: <span className="font-bold text-slate-900">{decryptionResult.recipient_id}</span></div>
                  <div>Session Nonce: <span className="font-semibold text-slate-900">{decryptionResult.session_id}</span></div>
                  <div>Watermark ID: <span className="font-bold text-blue-700">{decryptionResult.watermark_id}</span></div>
                  <div>Signature Algo: <span className="font-semibold text-indigo-700">{decryptionResult.signature_algorithm}</span></div>
                  <div className="sm:col-span-2 truncate">
                    Signature: <span className="text-slate-600">{decryptionResult.receipt.recipient_signature_b64.substring(0, 48)}...</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Download PDF and Export .receipt */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={decryptionResult.pdf_download_url}
                  download={`Decrypted-${decryptionResult.doc_id}-${decryptionResult.recipient_id}.pdf`}
                  className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Watermarked PDF</span>
                </a>

                <a
                  href={decryptionResult.receipt_download_url}
                  download={`Receipt-${decryptionResult.doc_id}-${decryptionResult.recipient_id}.receipt`}
                  className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 transition-all"
                >
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>Export Signed .receipt</span>
                </a>
              </div>

              {/* Embedded Document Preview */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Document View (Decrypted Plaintext with Invisible Fingerprint)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Watermark Token: {decryptionResult.watermark_id.substring(0, 10)}...
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-xs font-serif leading-relaxed text-slate-800 border border-slate-200/60 max-h-48 overflow-y-auto">
                  <p className="font-bold text-slate-900 mb-1">Confidential Strategic Directive</p>
                  <p className="text-slate-600 text-[11px] mb-2">Security Classification: CONFIDENTIAL // RESTRICTED</p>
                  <p>1. OPERATIONAL MANDATE: Full air-gapped cryptographic document distribution.</p>
                  <p>2. POST-QUANTUM ASSURANCE: NIST FIPS 203 ML-KEM-768 key encapsulation.</p>
                  <p>3. NON-REPUDIATION: NIST FIPS 204 ML-DSA-65 post-quantum digital signing.</p>
                  <p>4. FORENSIC ATTRIBUTION: Dynamic zero-width and structural watermarking.</p>
                  <p className="text-[10px] text-slate-500 mt-2 italic">
                    Invisible recipient and session tokens embedded across document structure. Leaked copies are cryptographically attributable.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="apple-glass-card p-14 text-center text-slate-400 text-xs space-y-2">
              <Cpu className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-slate-700 font-semibold">Recipient Enclave Locked</div>
              <p className="max-w-md mx-auto text-slate-500 text-[11px]">
                Select recipient identity, provide your personal passphrase, and click &ldquo;Decrypt & Fingerprint Locally&rdquo; to unlock the credential vault, decapsulate the ML-KEM secret, and produce the watermarked document.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
