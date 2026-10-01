import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
});

// System Status
export const fetchSystemStatus = async () => {
  const res = await api.get('/api/system/status');
  return res.data;
};

// 1. DISTRIBUTE
export const fetchActiveDocuments = async () => {
  const res = await api.get('/api/distribution/active-documents');
  return res.data;
};

export const encryptAndDistribute = async (formData) => {
  const res = await api.post('/api/distribution/encrypt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getSecurePackageDownloadUrl = (docId, recipientId) => {
  return `${api.defaults.baseURL}/api/distribution/download-package/${docId}/${recipientId}`;
};

// 2. MY DOCUMENTS & LOCAL RECIPIENT CLIENT
export const decryptSecurePackage = async (formData) => {
  const res = await api.post('/api/recipient/decrypt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getDecryptedPdfDownloadUrl = (docId, recipientId) => {
  return `${api.defaults.baseURL}/api/recipient/download-decrypted-pdf/${docId}/${recipientId}`;
};

export const getProvenanceReceiptDownloadUrl = (docId, recipientId) => {
  return `${api.defaults.baseURL}/api/recipient/download-provenance-receipt/${docId}/${recipientId}`;
};

export const importProvenanceReceiptFile = async (receiptFile) => {
  const formData = new FormData();
  formData.append('receipt_file', receiptFile);
  const res = await api.post('/api/recipient/import-provenance-receipt-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// 3. PEOPLE / IDENTITIES
export const fetchIdentities = async () => {
  const res = await api.get('/api/identities');
  return res.data;
};

export const enrollIdentity = async ({ recipient_id, name, unit, password }) => {
  const res = await api.post('/api/identities/enroll', {
    recipient_id,
    name,
    unit,
    password,
  });
  return res.data;
};

export const getRecipientVaultUrl = (recipientId) => {
  return `${api.defaults.baseURL}/api/identities/${recipientId}/vault`;
};

// 4. FORENSICS LAB
export const analyzePdfLeak = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/api/forensics/analyze-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const analyzeTextLeak = async (leakedText) => {
  const res = await api.post('/api/forensics/analyze-text', { leaked_text: leakedText });
  return res.data;
};

// 5. PROVENANCE & 4-VALIDATOR DLT
export const fetchLedgerBlocks = async () => {
  const res = await api.get('/api/ledger/blocks');
  return res.data;
};

export const verifyLedgerIntegrity = async () => {
  const res = await api.get('/api/ledger/verify');
  return res.data;
};

export const fetchValidators = async () => {
  const res = await api.get('/api/ledger/validators');
  return res.data;
};

// 6. SECURITY CONSOLE & REVOCATION
export const fetchSecurityStatus = async () => {
  const res = await api.get('/api/security/status');
  return res.data;
};

export const fetchRevocationList = async () => {
  const res = await api.get('/api/security/revocation-list');
  return res.data;
};

export const revokeIdentity = async (recipientId, reason) => {
  const res = await api.post('/api/security/revoke-identity', {
    recipient_id: recipientId,
    reason: reason || 'Key compromise or clearance revoked',
  });
  return res.data;
};

export const unrevokeIdentity = async (recipientId) => {
  const res = await api.post('/api/security/unrevoke-identity', {
    recipient_id: recipientId,
  });
  return res.data;
};

export const revokeDocument = async (docId, reason) => {
  const res = await api.post('/api/security/revoke-document', {
    doc_id: docId,
    reason: reason || 'Document distribution retracted',
  });
  return res.data;
};

export const runSecurityTamperTest = async (blockIndex = 1, fakeRecipient = 'COMPROMISED-ATTACKER') => {
  const res = await api.post('/api/security/tamper-audit-test', {
    block_index: blockIndex,
    fake_recipient: fakeRecipient,
  });
  return res.data;
};

export const restoreLedgerState = async (blockIndex = 1, originalRecipient = 'USER-BOB') => {
  const res = await api.post('/api/security/restore-ledger', {
    block_index: blockIndex,
    original_recipient: originalRecipient,
  });
  return res.data;
};
