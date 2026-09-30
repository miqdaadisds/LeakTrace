import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import JudgeDemoGuide from './components/JudgeDemoGuide';
import DocumentPublisher from './components/DocumentPublisher';
import DecryptionViewer from './components/DecryptionViewer';
import ForensicsConsole from './components/ForensicsConsole';
import BlockchainExplorer from './components/BlockchainExplorer';
import { 
  fetchSystemStatus, 
  fetchOfficers, 
  fetchDocuments, 
  fetchOfficerCredentials,
  decryptDocument 
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('publish');
  const [systemStatus, setSystemStatus] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [simulatedLeakText, setSimulatedLeakText] = useState('');
  const [autoAnalyzeTrigger, setAutoAnalyzeTrigger] = useState(false);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
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

  // 1-Click Interactive Judge Demo Walkthrough
  const handleRunQuickDemo = async () => {
    if (officers.length === 0 || documents.length === 0) return;
    setIsRunningDemo(true);

    try {
      // 1. Pick target officer: Cdr. Rajesh Sharma (DEF-NAVY-0842)
      const officer = officers[0];
      const doc = documents[0];

      // 2. Fetch credentials
      const creds = await fetchOfficerCredentials(officer.recipient_id);

      // 3. Decrypt document as officer (embeds invisible steganography and commits blockchain receipt)
      const decryptRes = await decryptDocument({
        doc_id: doc.doc_id,
        recipient_id: creds.recipient_id,
        private_key_x25519_b64: creds.private_key_x25519_b64,
        private_key_pqc_b64: creds.private_key_pqc_b64,
        private_key_sig_b64: creds.private_key_sig_b64,
        device_fingerprint: `NAVY-TERMINAL-${creds.recipient_id.split('-')[2]}`,
      });

      // 4. Simulate leak: transfer marked text to Forensics Lab
      setSimulatedLeakText(decryptRes.plaintext_content);
      setActiveTab('forensics');
      setAutoAnalyzeTrigger(true);
      setTimeout(() => setAutoAnalyzeTrigger(false), 1000);

      // Refresh system metrics
      handleDecrypted();
    } catch (err) {
      console.error('1-Click demo failed:', err);
    } finally {
      setIsRunningDemo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center space-y-4 font-sans text-slate-800">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-semibold tracking-tight text-slate-700">
          Loading NISHAN-PQ Prototype...
        </div>
        <div className="text-xs text-slate-400">
          Initializing NIST FIPS 203 ML-KEM-768 Enclave &amp; Air-Gapped Ledger
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-900 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 90-Second Judge Guided Walkthrough */}
        <JudgeDemoGuide
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onRunQuickDemo={handleRunQuickDemo}
          isRunningDemo={isRunningDemo}
        />

        {activeTab === 'publish' && (
          <DocumentPublisher
            officers={officers}
            documents={documents}
            onDocumentPublished={handleDocumentPublished}
            onGoToDecrypt={() => setActiveTab('decrypt')}
          />
        )}

        {activeTab === 'decrypt' && (
          <DecryptionViewer
            officers={officers}
            documents={documents}
            onDecrypted={handleDecrypted}
            onSimulateLeak={handleSimulateLeak}
            onGoToForensics={() => setActiveTab('forensics')}
          />
        )}

        {activeTab === 'forensics' && (
          <ForensicsConsole
            simulatedLeakText={simulatedLeakText}
            autoAnalyzeTrigger={autoAnalyzeTrigger}
          />
        )}

        {activeTab === 'ledger' && (
          <BlockchainExplorer />
        )}
      </main>

      {/* Minimal Apple-Style Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Smart India Hackathon 2026 &bull; Problem Statement #26237 (PS 237)
          </div>
          <div className="text-slate-600 font-medium">
            Ministry of Defence &bull; Weapons &amp; Electronics Systems Engineering Establishment (WESEE)
          </div>
        </div>
      </footer>
    </div>
  );
}
