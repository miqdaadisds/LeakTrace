import React, { useState } from 'react';
import { Lock, FileText, Send, Users, ShieldCheck, Key, Check } from 'lucide-react';
import { publishDocument } from '../api';

export default function DocumentPublisher({ officers, documents, onDocumentPublished }) {
  const [title, setTitle] = useState('OPERATION SAMUDRA-SHIELD: Fleet Tactical Grid Coordinates');
  const [classification, setClassification] = useState('TOP SECRET // MARITIME STRIKE');
  const [plaintext, setPlaintext] = useState(
`NAVAL HEADQUARTERS OPERATIONAL DIRECTIVE // STRICT EXECUTION
TO: WESTERN FLEET COMMANDER, EASTERN FLEET COMMANDER, WESEE R&D

1. IMMEDIATE CARRIER STRIKE GROUP FORMATION:
   INS Vikrant and escort destroyers are assigned to Sector Kilo-4 (Lat 18.52 N, Long 71.90 E).
   Maintain EMCON Level Alpha. Continuous passive acoustic sonar search across Band 3.

2. SUB-SURFACE THREAT PROTOCOL:
   Any unidentified acoustic contacts within 25 nautical miles to be targeted with ASW torpedo vectors.
   Frequency hopping cycle rate: 250 milliseconds with SHA3-512 cryptographic key rotation.

3. FORENSIC ATTRIBUTION WARNING:
   Under SIH PS 26237 MoD protocols, client decryption attaches deterministic forensic marks.
   All unauthorized disclosures are mathematically traceable to the decrypting workstation.`
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
      {/* Intro Context Card */}
      <div className="bg-navy-800/80 border border-navy-700 rounded-xl p-5 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center space-x-2">
              <Lock className="w-5 h-5 text-defence-gold" />
              <span>Multi-Recipient Hybrid Post-Quantum Envelope Publisher</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Encrypts classified tactical orders <strong className="text-slate-200">once</strong> via AES-256-GCM. 
              The 256-bit Content Encryption Key (CEK) is independently encapsulated for each authorized commander using 
              hybrid <span className="text-defence-cyan font-mono">ML-KEM-768 + X25519</span> lattice cryptography.
            </p>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 text-xs font-mono font-bold rounded bg-navy-900 border border-navy-600 text-defence-gold">
            O(1) Ciphertext Storage
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document Editor Form */}
        <form onSubmit={handlePublish} className="lg:col-span-7 bg-navy-800/60 border border-navy-700 rounded-xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-defence-gold font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Classification Level</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs text-defence-gold font-bold focus:outline-none focus:border-defence-gold"
              >
                <option>RESTRICTED // NAVAL DEFENCE</option>
                <option>SECRET // MARITIME COMMAND</option>
                <option>TOP SECRET // OPERATIONAL</option>
                <option>TOP SECRET // MARITIME STRIKE</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Publishing Command</label>
              <input
                type="text"
                disabled
                value="WESEE-DIRECTORATE-DELHI"
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono"
              />
            </div>
          </div>

          {/* Authorized Recipients Selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-defence-gold" />
                <span>Authorized Flag Officers & Commands ({selectedOfficers.length} selected)</span>
              </label>
              <span className="text-[11px] text-slate-400">Click to toggle recipient access</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {officers.map((officer) => {
                const isSelected = selectedOfficers.includes(officer.recipient_id);
                return (
                  <div
                    key={officer.recipient_id}
                    onClick={() => toggleOfficer(officer.recipient_id)}
                    className={`cursor-pointer border rounded-lg p-2.5 transition-all text-xs flex items-center justify-between ${
                      isSelected
                        ? 'bg-navy-700/80 border-defence-gold/60 text-white'
                        : 'bg-navy-900/60 border-navy-800 text-slate-400 hover:border-navy-700'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{officer.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{officer.unit}</div>
                    </div>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                      isSelected ? 'bg-defence-gold border-defence-gold text-navy-950' : 'border-navy-700'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plaintext Document Content */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-defence-gold" />
              <span>Operational Plaintext Directive</span>
            </label>
            <textarea
              rows={8}
              value={plaintext}
              onChange={(e) => setPlaintext(e.target.value)}
              required
              className="w-full bg-navy-900 border border-navy-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-defence-gold leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-defence-gold hover:bg-amber-400 text-navy-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Encrypting with ML-KEM-768...' : 'Publish Encrypted Package to Naval Network'}</span>
          </button>
        </form>

        {/* Cryptographic Package Output View */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Key className="w-4 h-4 text-defence-cyan" />
              <span>Cryptographic Envelope Telemetry</span>
            </h3>

            {publishedPackage ? (
              <div className="mt-3 space-y-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-navy-950 border border-navy-800 space-y-1.5">
                  <div className="text-emerald-400 font-bold flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>ENVELOPE ENCRYPTED SUCCESSFULLY</span>
                  </div>
                  <div className="text-slate-400">
                    Doc ID: <span className="text-slate-200">{publishedPackage.doc_id}</span>
                  </div>
                  <div className="text-slate-400">
                    Payload Hash (SHA-256):{' '}
                    <span className="text-defence-gold truncate block">{publishedPackage.doc_hash_sha256}</span>
                  </div>
                  <div className="text-slate-400">
                    Ciphertext Size:{' '}
                    <span className="text-slate-200">{publishedPackage.ciphertext_b64.length} Base64 bytes</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-300 font-semibold text-[11px]">
                    Hybrid KEM Encapsulated Key Wraps ({publishedPackage.recipient_wraps.length}):
                  </span>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {publishedPackage.recipient_wraps.map((wrap) => (
                      <div key={wrap.recipient_id} className="p-2.5 rounded bg-navy-900 border border-navy-800 text-[11px] space-y-1">
                        <div className="flex justify-between items-center text-defence-cyan font-bold">
                          <span>{wrap.recipient_id}</span>
                          <span className="text-[10px] text-slate-400">ML-KEM-768 + X25519</span>
                        </div>
                        <div className="text-slate-400 truncate">
                          KEM CT: {wrap.encapsulated_key_b64.substring(0, 32)}...
                        </div>
                        <div className="text-slate-400 truncate">
                          Wrapped CEK: {wrap.wrapped_cek_b64}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-8 text-center text-slate-500 text-xs border border-dashed border-navy-700 rounded-lg">
                Publish a document to inspect the single-ciphertext payload and post-quantum hybrid KEM key wraps.
              </div>
            )}
          </div>

          {/* Active Documents Quick List */}
          <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-300 mb-2">Available Operational Packages ({documents.length})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {documents.map((doc) => (
                <div key={doc.doc_id} className="p-2.5 rounded bg-navy-900/80 border border-navy-800 text-xs">
                  <div className="font-semibold text-slate-200 truncate">{doc.title}</div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
                    <span className="text-defence-gold">{doc.classification}</span>
                    <span>{doc.recipient_count} recipients</span>
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
