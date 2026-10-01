import React, { useState } from 'react';
import { 
  KeyRound, 
  Lock, 
  Unlock, 
  FileCheck, 
  Download, 
  ShieldAlert, 
  Cpu, 
  RefreshCw, 
  ArrowRight, 
  AlertTriangle,
  Upload,
  CheckCircle2
} from 'lucide-react';
import { decryptSecurePackage, getDecryptedPdfDownloadUrl } from '../api';

export default function DecryptionViewer({ identities, activeDocs, onDecrypted, onSendToForensics }) {
  const [selectedRecipientId, setSelectedRecipientId] = useState(
    identities.find((i) => i.recipient_id === 'USER-BOB')?.recipient_id || identities[0]?.recipient_id || ''
  );
  const [selectedDocId, setSelectedDocId] = useState(activeDocs[0]?.doc_id || 'DOC-7F3A29B1');
  const [password, setPassword] = useState('BobSecure2026!');
  const [customPackageFile, setCustomPackageFile] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionResult, setDecryptionResult] = useState(null);
  const [error, setError] = useState(null);

  const selectedIdentity = identities.find((i) => i.recipient_id === selectedRecipientId);

  const handleAutofillPassword = (pwd) => {
    setPassword(pwd);
  };

  const handleDecrypt = async (e, forcedPassword = null) => {
    if (e) e.preventDefault();
    const pwdToUse = forcedPassword !== null ? forcedPassword : password;
    if (!pwdToUse) {
      setError('Password is required to unlock your encrypted credential vault.');
      return;
    }

    setIsDecrypting(true);
    setError(null);
    setDecryptionResult(null);

    const formData = new FormData();
    formData.append('password', pwdToUse);
    formData.append('device_fingerprint', `WORKSTATION-${selectedRecipientId}-AIRGAP-NODE`);

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

  const handleTestWrongPassword = () => {
    handleDecrypt(null, 'IncorrectPassword123!');
  };

  const handlePassToForensics = () => {
    if (!decryptionResult) return;
    if (onSendToForensics) {
      onSendToForensics(decryptionResult);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Decryption Form */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={(e) => handleDecrypt(e)} className="apple-glass-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Recipient Workstation (Local Decryption)</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                AIR-GAPPED READY
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Active Recipient Identity
              </label>
              <select
                value={selectedRecipientId}
                onChange={(e) => {
                  setSelectedRecipientId(e.target.value);
                  const identity = identities.find((i) => i.recipient_id === e.target.value);
                  if (identity) setPassword(`${identity.name}Secure2026!`);
                }}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {identities.map((i) => (
                  <option key={i.recipient_id} value={i.recipient_id}>
                    {i.name} ({i.recipient_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Custom .secure file upload */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Load .secure Package File (Optional)
              </label>
              <div className="relative border border-dashed border-slate-200 rounded-xl p-2.5 bg-white/50 text-center hover:bg-white/80 transition-colors">
                <input
                  type="file"
                  accept=".secure,.json"
                  onChange={(e) => setCustomPackageFile(e.target.files[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center space-x-2 text-slate-600 text-[11px]">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>{customPackageFile ? customPackageFile.name : `Using pre-packaged ${selectedIdentity?.name || 'Bob'}.secure`}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Recipient Passphrase (Argon2id Vault)
                </label>
                <button
                  type="button"
                  onClick={() => handleAutofillPassword(`${selectedIdentity?.name || 'Bob'}Secure2026!`)}
                  className="text-[10px] text-blue-600 font-semibold hover:underline"
                >
                  Autofill Default
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Derived locally with Argon2id. Password is NEVER transmitted to the server.
              </span>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={isDecrypting}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm"
              >
                {isDecrypting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                <span>Unlock Vault & Decrypt Locally</span>
              </button>

              <button
                type="button"
                onClick={handleTestWrongPassword}
                disabled={isDecrypting}
                className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Test Wrong Password Rejection</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Local Decryption & Watermarking Receipt */}
        <div className="lg:col-span-7 space-y-4">
          {decryptionResult ? (
            <div className="apple-glass-card p-6 space-y-5 border-emerald-200 bg-emerald-50/20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-sm">Decryption & Dynamic Fingerprint Completed</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                  Block #{decryptionResult.ledger_block_index}
                </span>
              </div>

              {/* Provenance Event & Receipt Card */}
              <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="font-bold text-slate-900 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <span>Decryption Provenance Receipt</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                  <div>Recipient: <span className="font-bold text-slate-900">{decryptionResult.recipient_id}</span></div>
                  <div>Session: <span className="font-semibold text-slate-900">{decryptionResult.session_id}</span></div>
                  <div>Watermark ID: <span className="font-bold text-blue-700">{decryptionResult.watermark_id}</span></div>
                  <div>Algorithm: <span className="font-semibold text-indigo-700">{decryptionResult.signature_algorithm}</span></div>
                  <div className="sm:col-span-2 truncate">
                    ML-DSA Sig: <span className="text-slate-700">{decryptionResult.receipt.recipient_signature_b64.substring(0, 32)}...</span>
                  </div>
                </div>
              </div>

              {/* Actions: Download PDF or Leak to Forensics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href={decryptionResult.pdf_download_url}
                  download={`Decrypted-${decryptionResult.doc_id}-${decryptionResult.recipient_id}.pdf`}
                  className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Watermarked PDF</span>
                </a>

                <button
                  onClick={handlePassToForensics}
                  className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <span>Pass Leaked PDF to Forensics (Step 3)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="apple-glass-card p-12 text-center text-slate-400 text-xs space-y-2">
              <Cpu className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-slate-700 font-semibold">Recipient Workstation Awaiting Unlock</div>
              <p className="max-w-md mx-auto text-slate-500 text-[11px]">
                Select recipient and click &ldquo;Unlock Vault & Decrypt Locally&rdquo; to decrypt, inject the dynamic forensic watermark, and sign the non-repudiation receipt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
