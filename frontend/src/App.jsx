import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DocumentPublisher from './components/DocumentPublisher';
import MyDocuments from './components/MyDocuments';
import IdentityManager from './components/IdentityManager';
import ForensicsConsole from './components/ForensicsConsole';
import BlockchainExplorer from './components/BlockchainExplorer';
import SecurityConsole from './components/SecurityConsole';

import { 
  fetchSystemStatus, 
  fetchIdentities, 
  fetchActiveDocuments, 
  fetchLedgerBlocks
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('distribute');
  const [systemStatus, setSystemStatus] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [activeDocs, setActiveDocs] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAllData = async () => {
    try {
      const [status, idList, docList, blockList] = await Promise.all([
        fetchSystemStatus(),
        fetchIdentities(),
        fetchActiveDocuments(),
        fetchLedgerBlocks(),
      ]);
      setSystemStatus(status);
      setIdentities(idList);
      setActiveDocs(docList);
      setBlocks(blockList);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="apple-glass-card p-12 text-center text-slate-400 text-xs">
            Loading secure defence enclave...
          </div>
        ) : (
          <>
            {/* 1. DISTRIBUTE */}
            {activeTab === 'distribute' && (
              <DocumentPublisher
                identities={identities}
                activeDocs={activeDocs}
                onDocumentPublished={loadAllData}
                onGoToDecrypt={() => setActiveTab('my-documents')}
              />
            )}

            {/* 2. MY DOCUMENTS */}
            {activeTab === 'my-documents' && (
              <MyDocuments
                identities={identities}
                activeDocs={activeDocs}
                onDecrypted={loadAllData}
              />
            )}

            {/* 3. PEOPLE / IDENTITIES */}
            {activeTab === 'identities' && (
              <IdentityManager
                identities={identities}
                onIdentityCreated={loadAllData}
              />
            )}

            {/* 4. FORENSICS */}
            {activeTab === 'forensics' && (
              <ForensicsConsole />
            )}

            {/* 5. PROVENANCE */}
            {activeTab === 'provenance' && (
              <BlockchainExplorer
                blocks={blocks}
                onRefreshBlocks={loadAllData}
              />
            )}

            {/* 6. SECURITY */}
            {activeTab === 'security' && (
              <SecurityConsole
                identities={identities}
                activeDocs={activeDocs}
                onSecurityUpdated={loadAllData}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200/60 bg-white/40 py-3 text-center text-[11px] text-slate-500">
        LeakTrace &bull; SIH 2026 Problem Statement #237 &bull; Weapons and Electronics Systems Engineering Establishment (WESEE)
      </footer>
    </div>
  );
}
