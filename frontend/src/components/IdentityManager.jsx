import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Key, 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  UserPlus, 
  Check, 
  Fingerprint, 
  Cpu, 
  RefreshCw,
  Clock,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { approveUser, assignRole } from '../api';
import { playClick, playSuccess } from '../utils/soundEffects';

export default function IdentityManager({ identities = [], onIdentityCreated }) {
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pendingRoles, setPendingRoles] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Live Polling while viewing Identity Manager
  useEffect(() => {
    const timer = setInterval(() => {
      if (onIdentityCreated) onIdentityCreated();
    }, 3000);
    return () => clearInterval(timer);
  }, [onIdentityCreated]);

  const handleManualRefresh = async () => {
    playClick();
    setIsRefreshing(true);
    if (onIdentityCreated) await onIdentityCreated();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleApprove = async (recipientId) => {
    playClick();
    try {
      const desiredRole = pendingRoles[recipientId] || 'recipient';
      await approveUser(recipientId);
      if (desiredRole !== 'recipient') {
        await assignRole(recipientId, desiredRole);
      }
      playSuccess();
      setSuccessMsg(`Successfully authorized ${recipientId} as ${desiredRole.toUpperCase()}`);
      if (onIdentityCreated) onIdentityCreated();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Approval failed');
    }
  };

  const handleRoleChange = async (recipientId, role) => {
    playClick();
    try {
      await assignRole(recipientId, role);
      setSuccessMsg(`Assigned role ${role.toUpperCase()} to ${recipientId}`);
      if (onIdentityCreated) onIdentityCreated();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Role assignment failed');
    }
  };

  const pendingUsers = identities.filter(i => i.role === 'pending' || i.approved === false);
  const enrolledUsers = identities.filter(i => i.role !== 'pending' && i.approved !== false);

  return (
    <div className="space-y-6">
      {/* Header card with Live Sync */}
      <div className="apple-glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Enrolled Recipient Identities</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Registered post-quantum cryptographic profiles. Manage incoming registrations and access roles.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-700/80 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Realtime Sync Active</span>
          </div>

          <button
            onClick={handleManualRefresh}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 transition-all active:scale-95 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="apple-glass p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      
      {errorMsg && (
        <div className="apple-glass p-3.5 rounded-xl border border-red-300 dark:border-red-700/80 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs flex items-center space-x-2">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* PENDING APPROVAL REQUESTS (HIGHLIGHTED SECTION) */}
      {pendingUsers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Pending Authorization Requests ({pendingUsers.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingUsers.map((user) => (
              <div 
                key={user.recipient_id} 
                className="apple-glass-card p-5 space-y-4 border-2 border-amber-300/80 dark:border-amber-600/60 bg-amber-50/20 dark:bg-amber-950/20 shadow-lg relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-extrabold text-base shadow-sm">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{user.name}</h4>
                      <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{user.recipient_id}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user.unit || 'Standard Unit'}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs animate-pulse">
                    AWAITING APPROVAL
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-3 border border-amber-200/60 dark:border-amber-700/40 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">Assign Role:</span>
                  <select
                    value={pendingRoles[user.recipient_id] || 'recipient'}
                    onChange={(e) => setPendingRoles({ ...pendingRoles, [user.recipient_id]: e.target.value })}
                    className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="recipient" className="dark:bg-slate-900 text-slate-900 dark:text-white">Recipient</option>
                    <option value="sender" className="dark:bg-slate-900 text-slate-900 dark:text-white">Sender</option>
                    <option value="investigator" className="dark:bg-slate-900 text-slate-900 dark:text-white">Investigator</option>
                  </select>
                </div>

                <button
                  onClick={() => handleApprove(user.recipient_id)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-emerald-500/20 transition-all transform hover:scale-[1.01] active:scale-95"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Authorize &amp; Grant Access</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ENROLLED ACTIVE PERSONNEL GRID */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <span>Active Personnel ({enrolledUsers.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {enrolledUsers.map((identity) => {
            const isAdmin = identity.role === 'admin';

            return (
              <div 
                key={identity.recipient_id} 
                className="apple-glass-card p-5 space-y-4 hover:shadow-md transition-shadow dark:border-slate-700/80"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full ${isAdmin ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-gradient-to-tr from-blue-500 to-indigo-600'} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                      {identity.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{identity.name}</h3>
                      <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{identity.recipient_id}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isAdmin 
                      ? 'bg-purple-100/80 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-700' 
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
                  }`}>
                    {isAdmin ? 'ADMIN' : 'ACTIVE'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{identity.unit}</p>

                <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Role</span>
                    {isAdmin ? (
                      <span className="font-bold text-purple-700 dark:text-purple-400 uppercase">Administrator</span>
                    ) : (
                      <select 
                        value={identity.role || 'recipient'} 
                        onChange={e => handleRoleChange(identity.recipient_id, e.target.value)}
                        className="bg-transparent font-semibold text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="recipient" className="dark:bg-slate-900 text-slate-900 dark:text-white">Recipient</option>
                        <option value="sender" className="dark:bg-slate-900 text-slate-900 dark:text-white">Sender</option>
                        <option value="investigator" className="dark:bg-slate-900 text-slate-900 dark:text-white">Investigator</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <span>PQC KEM</span>
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">ML-KEM-768</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>PQC Signature</span>
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">ML-DSA-65</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
