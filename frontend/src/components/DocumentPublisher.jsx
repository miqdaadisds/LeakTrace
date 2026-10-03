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
import { protectDocument, getApiBaseUrl } from '../api';
import axios from 'axios';

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

  const handleProtectAndDistribute = async (e) => {
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
      const res = await protectDocument(formData);
      setDistributionResult(res);
      if (onDocumentPublished) onDocumentPublished();
    } catch (err) {
      setError(err.response?.data?.detail || 'Document distribution failed.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const downloadFile = async (docId, title) => {
    try {
      const res = await axios.get(`${getApiBaseUrl()}/api/distribution/download/${docId}`, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}` // assuming token is somewhere, actually we should use api.downloadProtectedDocument
        }
      });
      // But we can just use the download url returned by the API if we don't have it directly. Wait, the API returns a doc_id.
    } catch (err) {}
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Distribution Form */}
        <div className="lg:col-span-7 space-y-5">
          <form onSubmit={handleProtectAndDistribute} className="liquid-glass-card p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/60">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2 tracking-tight">
                  <Lock className="w-4.5 h-4.5 text-blue-600" />
                  <span>Encrypt & Distribute Studio</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Encrypt document ONCE with AES-256 and wrap access slots for multiple authorized recipients using ML-KEM-768.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 border border-blue-500/20 shadow-xs">
                O(1) AES-256
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-red-50/90 border border-red-200/80 text-red-700 text-xs font-medium">
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
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg"
            >
              {isEncrypting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Lock className="w-4 h-4 text-white" />
              )}
              <span>{isEncrypting ? 'Encrypting & Generating ML-KEM Slots...' : 'Encrypt PDF & Embed Recipient Slots'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Generated Packages & Active Distribution Status */}
        <div className="lg:col-span-5 space-y-4">
          {distributionResult ? (
            <div className="liquid-glass-card p-6 space-y-4 border-emerald-500/30 bg-emerald-50/40">
              <div className="flex items-center space-x-2 text-emerald-800">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm">Protected Document Ready</h3>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 bg-white/70 p-3.5 rounded-2xl border border-emerald-100 shadow-xs">
                <div>Document ID: <span className="font-mono font-bold text-slate-900">{distributionResult.doc_id}</span></div>
                <div className="truncate">Document Hash: <span className="font-mono text-[10px] text-slate-600">{distributionResult.doc_hash_sha256}</span></div>
              </div>

              <div className="space-y-2">
                <a
                  href={`${getApiBaseUrl()}/api/distribution/download/${distributionResult.doc_id}`}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Protected PDF</span>
                </a>
                <div className="text-[10px] text-slate-500 text-center">
                  Share this single file with all {distributionResult.recipients?.length || distributionResult.packages?.length} recipients
                </div>
              </div>

              <button
                onClick={onGoToDecrypt}
                className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm"
              >
                <span>Proceed to Decrypt Workstation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="liquid-glass-card p-6 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <FileText className="w-4.5 h-4.5 text-blue-600" />
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
                    <a
                      href={`${getApiBaseUrl()}/api/distribution/download/${doc.doc_id}`}
                      className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-center justify-center space-x-1"
                    >
                      <Download className="w-3 h-3 text-blue-600" />
                      <span>Download Protected PDF</span>
                    </a>
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
