import React, { useState } from 'react';
import { 
  Send, 
  FileCheck, 
  Check, 
  Lock, 
  FileText, 
  Upload, 
  ShieldAlert, 
  Download, 
  ArrowRight, 
  RefreshCw 
} from 'lucide-react';
import { encryptAndDistribute, getSecurePackageDownloadUrl } from '../api';

export default function DocumentPublisher({ identities, activeDocs, onDocumentPublished, onGoToDecrypt }) {
  const [title, setTitle] = useState('Confidential Q4 Strategic Product Roadmap');
  const [classification, setClassification] = useState('CONFIDENTIAL // RESTRICTED');
  const [selectedRecipients, setSelectedRecipients] = useState(
    identities.map((i) => i.recipient_id)
  );
  const [customFile, setCustomFile] = useState(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [distributionResult, setDistributionResult] = useState(null);
  const [error, setError] = useState(null);

  const toggleRecipient = (id) => {
    if (selectedRecipients.includes(id)) {
      if (selectedRecipients.length > 1) {
        setSelectedRecipients(selectedRecipients.filter((r) => r !== id));
      }
    } else {
      setSelectedRecipients([...selectedRecipients, id]);
    }
  };

  const handleEncryptAndDistribute = async (e) => {
    e.preventDefault();
    if (!title || selectedRecipients.length === 0) {
      setError('Please provide a document title and select at least one recipient.');
      return;
    }
    setIsEncrypting(true);
    setError(null);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('classification', classification);
    formData.append('recipient_ids', selectedRecipients.join(','));
    if (customFile) {
      formData.append('file', customFile);
    }

    try {
      const res = await encryptAndDistribute(formData);
      setDistributionResult(res);
      if (onDocumentPublished) onDocumentPublished();
    } catch (err) {
      setError(err.response?.data?.detail || 'Document distribution failed.');
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Distribution Form */}
        <div className="lg:col-span-7 space-y-5">
          <form onSubmit={handleEncryptAndDistribute} className="apple-glass-card p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  <span>Secure Document Distribution Console</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Broadcast-encrypt / individually-decrypt model: Encrypted ONCE for all authorized recipients.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                O(1) AES-256-GCM
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Security Classification
                </label>
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CONFIDENTIAL // RESTRICTED">CONFIDENTIAL // RESTRICTED</option>
                  <option value="SECRET // DEFENCE ONLY">SECRET // DEFENCE ONLY</option>
                  <option value="TOP SECRET // OPERATIONAL">TOP SECRET // OPERATIONAL</option>
                </select>
              </div>

              {/* Upload Optional Custom PDF */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Upload PDF Document (Optional)
                </label>
                <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-3 bg-white/50 text-center hover:bg-white/80 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setCustomFile(e.target.files[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center space-x-2 text-slate-600 text-xs">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>{customFile ? customFile.name : 'Click to upload custom PDF (or use default generated memo)'}</span>
                  </div>
                </div>
              </div>

              {/* Authorized Recipients Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">
                  Select Authorized Recipients ({selectedRecipients.length} of {identities.length})
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {identities.map((identity) => {
                    const isSelected = selectedRecipients.includes(identity.recipient_id);
                    return (
                      <div
                        key={identity.recipient_id}
                        onClick={() => toggleRecipient(identity.recipient_id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-300 shadow-sm'
                            : 'bg-white/50 border-slate-200/80 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-slate-900">{identity.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 font-bold" />}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{identity.recipient_id}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isEncrypting}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm"
            >
              {isEncrypting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Lock className="w-4 h-4 text-white" />
              )}
              <span>Encrypt Once & Generate .secure Packages (O(1))</span>
            </button>
          </form>
        </div>

        {/* Right Column: Generated Packages & Active Distribution Status */}
        <div className="lg:col-span-5 space-y-4">
          {distributionResult ? (
            <div className="apple-glass-card p-6 space-y-4 border-emerald-200 bg-emerald-50/30">
              <div className="flex items-center space-x-2 text-emerald-800">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm">Distribution Packages Ready</h3>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 bg-white/70 p-3 rounded-xl border border-emerald-100">
                <div>Document ID: <span className="font-mono font-semibold text-slate-900">{distributionResult.doc_id}</span></div>
                <div className="truncate">Document Hash: <span className="font-mono text-[10px] text-slate-600">{distributionResult.doc_hash_sha256}</span></div>
                <div>Model: <span className="font-semibold text-blue-700">{distributionResult.encryption_model}</span></div>
                <div>PQC KEM: <span className="font-semibold text-indigo-700">{distributionResult.post_quantum_kem}</span></div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Portable Recipient Packages (.secure):</div>
                {distributionResult.packages.map((pkg) => (
                  <div key={pkg.recipient_id} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{pkg.recipient_name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{pkg.package_filename}</div>
                    </div>
                    <a
                      href={pkg.download_url}
                      download={pkg.package_filename}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs flex items-center space-x-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>

              <button
                onClick={onGoToDecrypt}
                className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm"
              >
                <span>Proceed to Step 2: Recipient Workstation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="apple-glass-card p-6 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Active Encrypted Packages</span>
              </h3>
              <p className="text-xs text-slate-500">
                Pre-seeded confidential document available for immediate testing:
              </p>

              {activeDocs.map((doc) => (
                <div key={doc.doc_id} className="p-4 rounded-xl bg-white/70 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{doc.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">{doc.doc_id}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono truncate">
                    SHA256: {doc.doc_hash_sha256.substring(0, 24)}...
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-700 block">Download .secure File:</span>
                    <div className="flex flex-wrap gap-2">
                      {doc.packages.map((p) => (
                        <a
                          key={p.recipient_id}
                          href={p.download_url}
                          download={`DefencePlan-${p.recipient_name}.secure`}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3 text-blue-600" />
                          <span>{p.recipient_name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
