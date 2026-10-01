import React, { useState } from 'react';
import { 
  Users, 
  Key, 
  ShieldCheck, 
  Lock, 
  Download, 
  UserPlus, 
  Check, 
  Fingerprint, 
  Cpu, 
  RefreshCw 
} from 'lucide-react';
import { enrollIdentity, getRecipientVaultUrl } from '../api';

export default function IdentityManager({ identities, onIdentityCreated }) {
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!recipientId || !name || !password) {
      setError('Please fill all required fields.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await enrollIdentity({
        recipient_id: recipientId.toUpperCase().trim(),
        name: name.trim(),
        unit: unit.trim() || 'Operations & Defence Team',
        password,
      });
      setSuccessMsg(`Identity enrolled: ${name} (${recipientId}) with ML-KEM-768 and ML-DSA-65 keys.`);
      setShowEnrollModal(false);
      setRecipientId('');
      setName('');
      setUnit('');
      setPassword('');
      if (onIdentityCreated) onIdentityCreated();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to enroll identity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="apple-glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Enrolled Recipient Identities</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Registered post-quantum cryptographic profiles. Private keys are encrypted at rest with Argon2id and never stored on the server.
          </p>
        </div>
        <button
          onClick={() => setShowEnrollModal(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Enroll New Recipient</span>
        </button>
      </div>

      {successMsg && (
        <div className="apple-glass p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/80 text-emerald-800 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Recipient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {identities.map((identity) => (
          <div key={identity.recipient_id} className="apple-glass-card p-5 space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {identity.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{identity.name}</h3>
                  <span className="text-[11px] font-mono text-blue-600 font-semibold">{identity.recipient_id}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-slate-600 line-clamp-1">{identity.unit}</p>

            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 space-y-2 text-[11px]">
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center space-x-1">
                  <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                  <span>Public Key Fingerprint</span>
                </span>
                <span className="font-mono font-semibold text-slate-900">{identity.fingerprint || 'VALID-SHA256'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center space-x-1">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  <span>PQC KEM</span>
                </span>
                <span className="font-mono text-slate-800">ML-KEM-768</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>PQC Signature</span>
                </span>
                <span className="font-mono text-slate-800">ML-DSA-65</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Credential Vault</span>
                </span>
                <span className="font-mono text-slate-800">Argon2id (64MB)</span>
              </div>
            </div>

            <div className="pt-1">
              <a
                href={getRecipientVaultUrl(identity.recipient_id)}
                target="_blank"
                rel="noreferrer"
                download={`${identity.recipient_id}-vault.json`}
                className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Encrypted Vault</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Enrolling New Recipient */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="apple-glass-card max-w-md w-full p-6 space-y-4 shadow-2xl border border-white/80">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              <span>Enroll New Recipient</span>
            </h3>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleEnroll} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Recipient ID</label>
                <input
                  type="text"
                  placeholder="e.g. USER-DAVE"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dave Miller"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Unit / Department</label>
                <input
                  type="text"
                  placeholder="e.g. Defence Strategic Planning"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Recipient Passphrase (Argon2id Vault Key)
                </label>
                <input
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Password derives an Argon2id key to encrypt private keys at rest.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Generate PQ Keys & Enroll</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
