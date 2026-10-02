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
import { getRecipientVaultUrl, approveUser, assignRole } from '../api';

export default function IdentityManager({ identities, onIdentityCreated }) {
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleApprove = async (recipientId) => {
    try {
      await approveUser(recipientId);
      setSuccessMsg(`Approved ${recipientId}`);
      if (onIdentityCreated) onIdentityCreated();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Approval failed');
    }
  };

  const handleRoleChange = async (recipientId, role) => {
    try {
      await assignRole(recipientId, role);
      setSuccessMsg(`Assigned role ${role} to ${recipientId}`);
      if (onIdentityCreated) onIdentityCreated();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Role assignment failed');
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
            Registered post-quantum cryptographic profiles. Manage approvals and roles.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="apple-glass p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/80 text-emerald-800 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      
      {errorMsg && (
        <div className="apple-glass p-3.5 rounded-xl border border-red-300 bg-red-50/80 text-red-800 text-xs flex items-center space-x-2">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Recipient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {identities.map((identity) => {
          const isAdmin = identity.role === 'admin';
          const isPending = identity.role === 'pending';
          const isApproved = identity.approved ?? !isPending;

          return (
            <div key={identity.recipient_id} className="apple-glass-card p-5 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full ${isAdmin ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-gradient-to-tr from-blue-500 to-indigo-600'} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                    {identity.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{identity.name}</h3>
                    <span className="text-[11px] font-mono text-blue-600 font-semibold">{identity.recipient_id}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isAdmin 
                    ? 'bg-purple-100/80 text-purple-800 border-purple-200' 
                    : isPending
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {isAdmin ? 'ADMIN' : (isPending ? 'PENDING' : 'ACTIVE')}
                </span>
              </div>

              <p className="text-xs text-slate-600 line-clamp-1">{identity.unit}</p>

              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center space-x-1">
                    <span>Role</span>
                  </span>
                  {isAdmin ? (
                    <span className="font-bold text-purple-700 uppercase">Administrator</span>
                  ) : (
                    <select 
                      value={identity.role || 'recipient'} 
                      onChange={e => handleRoleChange(identity.recipient_id, e.target.value)}
                      className="bg-transparent font-semibold text-slate-900 focus:outline-none"
                    >
                      <option value="recipient">Recipient</option>
                      <option value="sender">Sender</option>
                      <option value="investigator">Investigator</option>
                    </select>
                  )}
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
              </div>

              {isPending && (
                <div className="pt-1">
                  <button
                    onClick={() => handleApprove(identity.recipient_id)}
                    className="w-full py-2 px-3 rounded-lg border border-transparent bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve User</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
