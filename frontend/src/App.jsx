import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DocumentPublisher from './components/DocumentPublisher';
import DecryptionViewer from './components/DecryptionViewer';
import ForensicsConsole from './components/ForensicsConsole';
import BlockchainExplorer from './components/BlockchainExplorer';
import { fetchSystemStatus, fetchOfficers, fetchDocuments } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('publish');
  const [systemStatus, setSystemStatus] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [simulatedLeakText, setSimulatedLeakText] = useState('');
  const [loading, setLoading] = useState(true);

  const loadInitialData = async () => {
    try {
      const [status, officerList, docList] = await Promise.all([
        fetchSystemStatus(),
        fetchOfficers(),
        fetchDocuments(),
      ]);
      setSystemStatus(status);
      setOfficers(officerList);
      setDocuments(docList);
    } catch (err) {
      console.error('Failed to initialize state from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSimulateLeak = (text) => {
    setSimulatedLeakText(text);
    setActiveTab('forensics');
  };

  const handleDocumentPublished = async () => {
    try {
      const docList = await fetchDocuments();
      setDocuments(docList);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDecrypted = async () => {
    try {
      const status = await fetchSystemStatus();
      setSystemStatus(status);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center space-y-4 text-white font-mono">
        <div className="w-12 h-12 border-4 border-defence-gold border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-semibold tracking-wider text-slate-300">
          INITIALIZING WESEE CRYPTOGRAPHIC ENCLAVE...
        </div>
        <div className="text-xs text-slate-500">
          Loading NIST FIPS 203 ML-KEM-768 Lattice & Provenance Ledger
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'publish' && (
          <DocumentPublisher
            officers={officers}
            documents={documents}
            onDocumentPublished={handleDocumentPublished}
          />
        )}

        {activeTab === 'decrypt' && (
          <DecryptionViewer
            officers={officers}
            documents={documents}
            onDecrypted={handleDecrypted}
            onSimulateLeak={handleSimulateLeak}
          />
        )}

        {activeTab === 'forensics' && (
          <ForensicsConsole
            simulatedLeakText={simulatedLeakText}
          />
        )}

        {activeTab === 'ledger' && (
          <BlockchainExplorer />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-800 bg-navy-950 py-4 px-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Smart India Hackathon (SIH) 2026 // Problem Statement No. 237 (ID: 26237)
          </div>
          <div className="text-slate-400">
            Ministry of Defence &bull; Weapons & Electronics Systems Engineering Establishment (WESEE)
          </div>
        </div>
      </footer>
    </div>
  );
}
