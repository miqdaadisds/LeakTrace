import React, { useState } from 'react';
import { Lock, FileText, Send, Users, Check, ShieldCheck, ArrowRight, Key } from 'lucide-react';
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

3. FORENSIC NON-REPUDIATION NOTICE:
   Under SIH PS 26237 (NISHAN-PQ), client decryption dynamically injects an invisible forensic mark.
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
      {/* Step Explanation Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Step 1 of 3</span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-xs font-semibold text-slate-700">Publisher Console</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                Encrypt Once, Distribute to Many (O(1) Storage)
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Traditional systems create separate 50 MB files for every recipient ($N \times$ storage explosion). 
                <strong> NISHAN-PQ</strong> encrypts the document payload <strong>just once</strong> with AES-256-GCM, then wraps the small 256-bit encryption key for each officer using post-quantum <strong>ML-KEM-768</strong>.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 bg-slate-100 rounded-full text-xs font-mono font-semibold text-slate-700 border border-slate-200 shrink-0">
            NIST FIPS 203 KEM
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document Editor Form */}
        <form onSubmit={handlePublish} className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Security Clearance</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option>RESTRICTED // NAVAL DEFENCE</option>
                <option>SECRET // MARITIME COMMAND</option>
                <option>TOP SECRET // OPERATIONAL</option>
                <option>TOP SECRET // MARITIME STRIKE</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Publishing Node (Air-Gapped)</label>
              <input
                type="text"
                disabled
                value="WESEE-DEFENCE-DELHI-01"
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 font-mono"
              />
            </div>
          </div>

          {/* Recipient Selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Select Authorized Recipients ({selectedOfficers.length} of {officers.length})</span>
              </label>
              <span className="text-[11px] text-slate-400">Click to include/exclude</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {officers.map((officer) => {
                const isSelected = selectedOfficers.includes(officer.recipient_id);
                return (
                  <div
                    key={officer.recipient_id}
                    onClick={() => toggleOfficer(officer.recipient_id)}
                    className={`cursor-pointer border rounded-xl p-3 transition-all text-xs flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-300 shadow-sm'
                        : 'bg-slate-50 border-slate-200/80 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{officer.name}</div>
                      <div className="text-[11px] text-slate-500">{officer.unit}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plaintext Directive */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Document Plaintext (What the recipients will read)</span>
            </label>
            <textarea
              rows={7}
              value={plaintext}
              onChange={(e) => setPlaintext(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
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
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Encrypting with ML-KEM-768...' : 'Encrypt Once & Publish to Network'}</span>
          </button>
        </form>

        {/* Telemetry and Envelope Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <Key className="w-4 h-4 text-blue-600" />
                <span>Single-Payload Cryptographic Envelope</span>
              </h3>
            </div>

            {publishedPackage ? (
              <div className="mt-3 space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 space-y-1.5">
                  <div className="text-emerald-800 font-bold flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>ENCRYPTED SUCCESSFULLY</span>
                  </div>
                  <div className="text-emerald-700 text-[11px] font-mono">
                    ID: {publishedPackage.doc_id}
                  </div>
                  <div className="text-slate-600 text-[11px] font-mono truncate">
                    SHA-256: {publishedPackage.doc_hash_sha256}
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Payload: <strong className="text-slate-900">1 single ciphertext</strong> for {publishedPackage.recipient_wraps.length} recipients.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-slate-700 font-semibold text-[11px]">
                    ML-KEM-768 Wrapped Recipient Keys ({publishedPackage.recipient_wraps.length}):
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-mono text-[11px]">
                    {publishedPackage.recipient_wraps.map((wrap) => (
                      <div key={wrap.recipient_id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                        <span className="font-semibold text-slate-800">{wrap.recipient_id}</span>
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          KEM Sealed
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onGoToDecrypt}
                  className="w-full mt-2 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
                >
                  <span>Proceed to Step 2: Open as Officer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="mt-4 p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                Click &ldquo;Encrypt Once &amp; Publish&rdquo; to view the resulting post-quantum envelope and verify $O(1)$ storage.
              </div>
            )}
          </div>

          {/* Active Documents List */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Available Orders on Network ({documents.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {documents.map((doc) => (
                <div key={doc.doc_id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="font-semibold text-slate-900 truncate">{doc.title}</div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
                    <span className="text-amber-700 font-semibold">{doc.classification}</span>
                    <span>{doc.recipient_count} authorized</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
