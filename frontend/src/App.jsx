import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import JudgeDemoGuide from './components/JudgeDemoGuide';
import IdentityManager from './components/IdentityManager';
import DocumentPublisher from './components/DocumentPublisher';
import DecryptionViewer from './components/DecryptionViewer';
import ForensicsConsole from './components/ForensicsConsole';
import BlockchainExplorer from './components/BlockchainExplorer';

import { 
  fetchSystemStatus, 
  fetchIdentities, 
  fetchActiveDocuments, 
  fetchLedgerBlocks,
  decryptSecurePackage
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('publish');
  const [systemStatus, setSystemStatus] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [activeDocs, setActiveDocs] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [preloadedPdfLeak, setPreloadedPdfLeak] = useState(null);
  const [autoAnalyzeTrigger, setAutoAnalyzeTrigger] = useState(false);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
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

  const handleSendToForensics = (decryptionResult) => {
    if (!decryptionResult || !decryptionResult.watermarked_pdf_base64) return;
    
    // Convert base64 to real binary PDF File object
    const byteCharacters = atob(decryptionResult.watermarked_pdf_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const leakedPdfFile = new File([blob], `LEAKED_${decryptionResult.recipient_id}.pdf`, { type: 'application/pdf' });

    setPreloadedPdfLeak(leakedPdfFile);
    setActiveTab('forensics');
  };

  // 1-Click 30s Live Demo Walkthrough for Hackathon Judges
  const handleRunQuickDemo = async () => {
    setIsRunningDemo(true);
    try {
      // Step 1: Open Decryption tab for Bob
      setActiveTab('decrypt');
      await new Promise((r) => setTimeout(r, 600));

      // Step 2: Decrypt locally as Bob using Bob's password
      const formData = new FormData();
      formData.append('doc_id', 'DOC-7F3A29B1');
      formData.append('recipient_id', 'USER-BOB');
      formData.append('password', 'BobSecure2026!');
      formData.append('device_fingerprint', 'WORKSTATION-BOB-AIRGAP-NODE');

      const decRes = await decryptSecurePackage(formData);
      
      // Step 3: Convert Bob's real decrypted watermarked PDF to a file
      const byteCharacters = atob(decRes.watermarked_pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const leakedPdfFile = new File([blob], 'LEAKED_BOB_ROADMAP.pdf', { type: 'application/pdf' });

      // Step 4: Pass to Forensics and run audit
      setPreloadedPdfLeak(leakedPdfFile);
      setActiveTab('forensics');
      setAutoAnalyzeTrigger(true);
      setTimeout(() => setAutoAnalyzeTrigger(false), 800);

      // Refresh ledger blocks
      const updatedBlocks = await fetchLedgerBlocks();
      setBlocks(updatedBlocks);
    } catch (err) {
      console.error('Quick demo error:', err);
    } finally {
      setIsRunningDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRunQuickDemo={handleRunQuickDemo}
        isRunningDemo={isRunningDemo}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <JudgeDemoGuide activeTab={activeTab} setActiveTab={setActiveTab} />

        {loading ? (
          <div className="apple-glass-card p-12 text-center text-slate-400 text-xs">
            Loading secure defence enclave...
          </div>
        ) : (
          <>
            {activeTab === 'identities' && (
              <IdentityManager
                identities={identities}
                onIdentityCreated={loadAllData}
              />
            )}

            {activeTab === 'publish' && (
              <DocumentPublisher
                identities={identities}
                activeDocs={activeDocs}
                onDocumentPublished={loadAllData}
                onGoToDecrypt={() => setActiveTab('decrypt')}
              />
            )}

            {activeTab === 'decrypt' && (
              <DecryptionViewer
                identities={identities}
                activeDocs={activeDocs}
                onDecrypted={loadAllData}
                onSendToForensics={handleSendToForensics}
              />
            )}

            {activeTab === 'forensics' && (
              <ForensicsConsole
                preloadedPdfLeak={preloadedPdfLeak}
                autoAnalyzeTrigger={autoAnalyzeTrigger}
              />
            )}

            {activeTab === 'ledger' && (
              <BlockchainExplorer
                blocks={blocks}
                onRefreshBlocks={loadAllData}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200/60 bg-white/40 py-3 text-center text-[11px] text-slate-500">
        NISHAN-PQ &bull; SIH 2026 Problem Statement #237 &bull; Weapons and Electronics Systems Engineering Establishment (WESEE)
      </footer>
    </div>
  );
}
