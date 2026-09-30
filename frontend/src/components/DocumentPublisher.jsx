import React, { useState } from 'react';
import { Lock, FileText, Send, Users, Check, ShieldCheck, ArrowRight, Key, Download } from 'lucide-react';
import { publishDocument } from '../api';

export default function DocumentPublisher({ officers, documents, onDocumentPublished, onGoToDecrypt }) {
  const [title, setTitle] = useState('OPERATION VARUNA: Arabian Sea Naval Intercept Orders');
  const [classification, setClassification] = useState('TOP SECRET // MARITIME STRIKE');
  const [plaintext, setPlaintext] = useState(
`NAVAL HEADQUARTERS OPERATIONAL DIRECTIVE // IMMEDIATE EXECUTION
TO: WESTERN FLEET COMMANDER, EASTERN FLEET COMMANDER, WESEE R&D

1. GRID DEPLOYMENT:
   INS Vikrant Carrier Battle Group to position at Lat 18.52 N, Long 71.90 E.
   Maintain EMCON Level Alpha. Continuous passive acoustic sonar search across Band 3.

2. SUB-SURFACE THREAT PROTOCOL:
   Unidentified contacts within 25 nautical miles designated for ASW vector interception.
   Tactical frequency hopping interval: 250 milliseconds with SHA3-512 rotation.

3. FORENSIC NON-REPUDIATION ATTESTATION:
   Client decryption dynamically embeds an invisible forensic mark.
   Any digital leak will be mathematically linked to the decrypting workstation.`
  );
  const [selectedOfficers, setSelectedOfficers] = useState(officers.map(o => o.recipient_id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishedPackage, setPublishedPackage] = useState(null);
  const [error, setError] = useState(null);

  const toggleOfficer = (id) => {
    if (selectedOfficers.includes(id)) {
      if (selectedOfficers.length > 1) {
        setSelectedOfficers(selectedOfficers.filter(o => o !== id));
      }
    } else {
      setSelectedOfficers([...selectedOfficers, id]);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const pkg = await publishDocument({
        title,
        classification,
        plaintext,
        publisher_id: 'WESEE-DIRECTORATE-DELHI',
        recipient_ids: selectedOfficers,
      });
      setPublishedPackage(pkg);
      if (onDocumentPublished) onDocumentPublished();
    } catch (err) {
      setError(err.response?.data?.detail || 'Document encryption failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document Editor Form */}
        <form onSubmit={handlePublish} className="lg:col-span-7 apple-glass-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Distribute Encrypted Directive</h2>
              <p className="text-xs text-slate-500">Encrypt once for multiple authorized commanders</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
              NIST FIPS 203 ML-KEM
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Directive Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-white/70 border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Classification Level</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full bg-white/70 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option>RESTRICTED // NAVAL DEFENCE</option>
                <option>SECRET // MARITIME COMMAND</option>
                <option>TOP SECRET // OPERATIONAL</option>
                <option>TOP SECRET // MARITIME STRIKE</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Publishing Node</label>
              <input
                type="text"
                disabled
                value="WESEE-DIRECTORATE-DELHI"
                className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 font-mono"
              />
            </div>
          </div>

          {/* Recipient Selection */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700">
                Authorized Commanders ({selectedOfficers.length} of {officers.length})
              </label>
              <span className="text-[11px] text-slate-400">Click to toggle</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {officers.map((officer) => {
                const isSelected = selectedOfficers.includes(officer.recipient_id);
                return (
                  <div
                    key={officer.recipient_id}
                    onClick={() => toggleOfficer(officer.recipient_id)}
                    className={`cursor-pointer border rounded-xl p-2.5 transition-all text-xs flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400/80 shadow-sm'
                        : 'bg-white/50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{officer.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{officer.recipient_id}</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plaintext Directive */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Document Plaintext Content</label>
            <textarea
              rows={6}
              value={plaintext}
              onChange={(e) => setPlaintext(e.target.value)}
              required
              className="w-full bg-white/70 border border-slate-200/90 rounded-xl p-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Encrypting with ML-KEM-768...' : 'Encrypt Once & Publish to Network'}</span>
          </button>
        </form>

        {/* Telemetry and Envelope Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <div className="apple-glass-card p-6">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Key className="w-4 h-4 text-blue-600" />
              <span>Live Post-Quantum Cryptographic Envelope</span>
            </h3>

            {publishedPackage ? (
              <div className="mt-4 space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 space-y-1.5">
                  <div className="text-emerald-800 font-bold flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>SINGLE-PAYLOAD ENCRYPTION CONFIRMED</span>
                  </div>
                  <div className="text-slate-600 text-[11px] font-mono truncate">
                    Doc ID: <span className="text-slate-900 font-semibold">{publishedPackage.doc_id}</span>
                  </div>
                  <div className="text-slate-600 text-[11px] font-mono truncate">
                    SHA-256 Hash: <span className="text-blue-700">{publishedPackage.doc_hash_sha256}</span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Ciphertext: <strong>{publishedPackage.ciphertext_b64.length} bytes</strong> (shared by {publishedPackage.recipient_wraps.length} recipients)
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-slate-700 font-semibold text-[11px]">
                    ML-KEM-768 Wrapped Recipient Keys:
                  </span>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 font-mono text-[11px]">
                    {publishedPackage.recipient_wraps.map((wrap) => (
                      <div key={wrap.recipient_id} className="p-2.5 rounded-xl bg-white/60 border border-slate-200/80 flex justify-between items-center">
                        <span className="font-semibold text-slate-900">{wrap.recipient_id}</span>
                        <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-sans font-semibold">
                          ML-KEM-768
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onGoToDecrypt}
                  className="w-full mt-3 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <span>Proceed to Step 2: Decrypt as Officer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="mt-8 p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                Click &ldquo;Encrypt Once &amp; Publish&rdquo; to generate the live post-quantum envelope and inspect the key wraps.
              </div>
            )}
          </div>

          {/* Active Orders List */}
          <div className="apple-glass-card p-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Orders Available on Network ({documents.length})
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {documents.map((doc) => (
                <div key={doc.doc_id} className="p-2 rounded-xl bg-white/60 border border-slate-200/80 text-xs flex justify-between items-center">
                  <div className="font-medium text-slate-900 truncate max-w-[200px]">{doc.title}</div>
                  <span className="text-[10px] text-blue-700 font-mono font-semibold">{doc.recipient_count} recipients</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
