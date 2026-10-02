import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DecryptFlow from './components/DecryptFlow';
import InvestigateFlow from './components/InvestigateFlow';
import DocumentPublisher from './components/DocumentPublisher';
import IdentityManager from './components/IdentityManager';
import BlockchainExplorer from './components/BlockchainExplorer';
import SecurityConsole from './components/SecurityConsole';
import LoginScreen from './components/LoginScreen';

import {
  fetchSystemStatus,
  fetchIdentities,
  fetchActiveDocuments,
  fetchLedgerBlocks,
  checkAuthStatus,
  getCurrentUser,
  setAuthToken,
  clearAuthToken,
  logout
} from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [activeTab, setActiveTab] = useState('decrypt');
  const [showAdmin, setShowAdmin] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [activeDocs, setActiveDocs] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAllData = async () => {
    try {
      const [status, idList, docList, blockList, me] = await Promise.all([
        fetchSystemStatus(),
        fetchIdentities(),
        fetchActiveDocuments(),
        fetchLedgerBlocks(),
        getCurrentUser().catch(() => null),
      ]);
      setSystemStatus(status);
      setIdentities(idList);
      setActiveDocs(docList);
      setBlocks(blockList);
      if (me && me.role) {
        setUser(prev => ({ ...(prev || {}), ...me }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  useEffect(() => {
    checkAuthStatus().then(status => {
      if (!status.setup_complete) {
        setSetupRequired(true);
        setLoading(false);
      } else if (status.authenticated && status.user) {
        setUser(status.user);
        loadAllData().finally(() => setLoading(false));
      } else {
        // Fallback check with saved token
        getCurrentUser().then(me => {
          if (me && me.role) {
            setUser(me);
            loadAllData().finally(() => setLoading(false));
          } else {
            setLoading(false);
          }
        }).catch(() => setLoading(false));
      }
    }).catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {}
    clearAuthToken();
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <LoginScreen 
      setupRequired={setupRequired} 
      onLogin={(user, token) => { 
        setAuthToken(token); 
        setUser(user); 
        setSetupRequired(false);
        loadAllData();
      }} 
    />;
  }

  return (
    <div className="relative min-h-screen bg-slate-900/10 text-slate-900 flex flex-col font-sans overflow-x-hidden selection:bg-blue-500/20">
      {/* Liquid Frosted Ambient Backdrop Mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl filter animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/4 -right-32 w-[28rem] h-[28rem] rounded-full bg-amber-400/20 blur-3xl filter animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute -bottom-32 left-1/4 w-[32rem] h-[32rem] rounded-full bg-indigo-500/20 blur-3xl filter animate-pulse" style={{ animationDuration: '9s' }} />
        <div className="absolute top-2/3 right-1/4 w-80 h-80 rounded-full bg-cyan-400/20 blur-3xl filter animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showAdmin={showAdmin}
        setShowAdmin={setShowAdmin}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'decrypt' && (
          <DecryptFlow
            user={user}
            identities={identities}
            activeDocs={activeDocs}
            onDecrypted={loadAllData}
            onGoToDistribute={() => setActiveTab('distribute')}
          />
        )}

        {activeTab === 'investigate' && (
          <InvestigateFlow onGoToLedger={() => setActiveTab('provenance')} />
        )}

        {activeTab === 'distribute' && (
          <DocumentPublisher
            identities={identities}
            activeDocs={activeDocs}
            onDocumentPublished={loadAllData}
            onGoToDecrypt={() => setActiveTab('decrypt')}
          />
        )}

        {activeTab === 'identities' && (
          <IdentityManager
            identities={identities}
            onIdentityCreated={loadAllData}
          />
        )}

        {activeTab === 'provenance' && (
          <BlockchainExplorer
            blocks={blocks}
            onRefreshBlocks={loadAllData}
          />
        )}

        {activeTab === 'security' && (
          <SecurityConsole
            identities={identities}
            activeDocs={activeDocs}
            onSecurityUpdated={loadAllData}
          />
        )}
      </main>

      <footer className="border-t border-slate-200/60 bg-white/40 py-3 text-center text-[11px] text-slate-400">
        LeakTrace &bull; SIH 2026 &bull; Ministry of Defence / WESEE
      </footer>
    </div>
  );
}
