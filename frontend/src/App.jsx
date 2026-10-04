import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DecryptFlow from './components/DecryptFlow';
import InvestigateFlow from './components/InvestigateFlow';
import DocumentPublisher from './components/DocumentPublisher';
import IdentityManager from './components/IdentityManager';
import BlockchainExplorer from './components/BlockchainExplorer';
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
  logout,
  subscribeToRealtimeEvents,
  checkHealthWithRetry
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
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Theme Management (Light & Dark Mode)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('traceleak_theme');
      if (saved) return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('traceleak_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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

  const handleEnclaveChanged = () => {
    setConnectionStatus('connecting');
    checkHealthWithRetry(8, 1500).then(({ online }) => {
      setConnectionStatus(online ? 'connected' : 'offline');
      loadAllData();
    });
  };

  useEffect(() => {
    // Check initial health and cold-start recovery
    checkHealthWithRetry(8, 1500).then(({ online }) => {
      setConnectionStatus(online ? 'connected' : 'offline');
    });

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
    }).catch(() => {
      setConnectionStatus('offline');
      setLoading(false);
    });

    // Realtime SSE / Polling Subscription
    const unsubscribe = subscribeToRealtimeEvents(
      (event) => {
        setConnectionStatus('connected');
        console.log('[Realtime Event Received]', event.event_type, event.data);
        if (event.event_type === 'USER_REGISTERED' || event.event_type === 'USER_APPROVED' || event.event_type === 'ROLE_CHANGED') {
          fetchIdentities().then(setIdentities).catch(() => {});
          if (event.data?.recipient_id) {
            setUser(prev => {
              if (prev && (prev.recipient_id === event.data.recipient_id || prev.name === event.data.name)) {
                return { ...prev, role: event.data.role, approved: event.data.role !== 'pending' };
              }
              return prev;
            });
          }
        } else if (event.event_type === 'DOCUMENT_AUTHORIZED' || event.event_type === 'DOCUMENT_AVAILABLE') {
          fetchActiveDocuments().then(setActiveDocs).catch(() => {});
        } else if (event.event_type === 'PROVENANCE_COMMITTED') {
          fetchLedgerBlocks().then(setBlocks).catch(() => {});
          fetchSystemStatus().then(setSystemStatus).catch(() => {});
        } else if (event.event_type === 'IDENTITY_REVOKED') {
          fetchIdentities().then(setIdentities).catch(() => {});
        }
      },
      (err) => {
        console.warn('[Realtime Stream Notice]', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Active Directory & Current User Role Refresh Polling
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchIdentities().then(setIdentities).catch(() => {});
      getCurrentUser().then((me) => {
        if (me && me.role) {
          setUser((prev) => {
            if (prev && prev.role !== me.role) {
              return { ...prev, ...me, approved: me.role !== 'pending' };
            }
            return prev;
          });
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [user?.recipient_id, user?.role]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {}
    clearAuthToken();
    setUser(null);
  };

  const pendingCount = identities.filter(i => i.role === 'pending' || i.approved === false).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-300">Connecting to TraceLeak Security Enclave...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen 
        setupRequired={setupRequired} 
        theme={theme}
        onToggleTheme={toggleTheme}
        onEnclaveChanged={handleEnclaveChanged}
        onLogin={(user, token) => { 
          setAuthToken(token); 
          setUser(user); 
          setSetupRequired(false);
          setConnectionStatus('connected');
          loadAllData();
        }} 
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-900/5 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-blue-500/20 transition-colors duration-300">
      {/* Liquid Frosted Ambient Backdrop Mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-500/20 dark:bg-blue-600/15 blur-3xl filter animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/4 -right-32 w-[28rem] h-[28rem] rounded-full bg-amber-400/20 dark:bg-amber-500/15 blur-3xl filter animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute -bottom-32 left-1/4 w-[32rem] h-[32rem] rounded-full bg-indigo-500/20 dark:bg-indigo-600/15 blur-3xl filter animate-pulse" style={{ animationDuration: '9s' }} />
        <div className="absolute top-2/3 right-1/4 w-80 h-80 rounded-full bg-cyan-400/20 dark:bg-cyan-500/15 blur-3xl filter animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showAdmin={showAdmin}
        setShowAdmin={setShowAdmin}
        user={user}
        onLogout={handleLogout}
        connectionStatus={connectionStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
        pendingCount={pendingCount}
        onEnclaveChanged={handleEnclaveChanged}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div key={activeTab} className="tab-transition-apple">
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
        </div>
      </main>

      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 py-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
        TraceLeak &bull; SIH 2026 &bull; Ministry of Defence / WESEE
      </footer>
    </div>
  );
}
