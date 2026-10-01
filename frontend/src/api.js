import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
});

// System Status
export const fetchSystemStatus = async () => {
  const res = await api.get('/api/system/status');
  return res.data;
};

// 1. Identity Manager
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

// 2. Document Distributor
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

// 3. Recipient Workstation Decryption
export const decryptSecurePackage = async (formData) => {
  const res = await api.post('/api/recipient/decrypt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getDecryptedPdfDownloadUrl = (docId, recipientId) => {
  return `${api.defaults.baseURL}/api/recipient/download-decrypted-pdf/${docId}/${recipientId}`;
};

// 4. Provenance & Multi-Validator DLT
export const fetchLedgerBlocks = async () => {
  const res = await api.get('/api/ledger/blocks');
  return res.data;
};

export const verifyLedgerIntegrity = async () => {
  const res = await api.get('/api/ledger/verify');
  return res.data;
};

export const runTamperTest = async (blockIndex = 1, fakeRecipient = 'COMPROMISED-ATTACKER') => {
  const res = await api.post('/api/ledger/tamper-test', {
    block_index: blockIndex,
    fake_recipient: fakeRecipient,
  });
  return res.data;
};

export const fetchValidators = async () => {
  const res = await api.get('/api/ledger/validators');
  return res.data;
};

// 5. Forensics Lab
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
