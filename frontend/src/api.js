import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
});

let authToken = typeof window !== 'undefined' ? localStorage.getItem('leaktrace_auth_token') : null;

export function setAuthToken(token) { 
  authToken = token; 
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('leaktrace_auth_token', token);
    else localStorage.removeItem('leaktrace_auth_token');
  }
}
export function clearAuthToken() { 
  authToken = null; 
  if (typeof window !== 'undefined') {
    localStorage.removeItem('leaktrace_auth_token');
  }
}

function authHeaders() {
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

// Auth API
export const checkAuthStatus = async () => {
  const res = await api.get('/api/auth/status', { headers: authHeaders() });
  return res.data;
};
export const setupOrganization = async (name, unit, password) => {
  const res = await api.post('/api/auth/setup', { name, unit, password });
  return res.data;
};
export const register = async (name, unit, password) => {
  const res = await api.post('/api/auth/register', { name, unit, password });
  return res.data;
};
export const login = async (recipientId, password) => {
  const res = await api.post('/api/auth/login', { recipient_id: recipientId, password });
  return res.data;
};
export const logout = async () => {
  const res = await api.post('/api/auth/logout', {}, { headers: authHeaders() });
  return res.data;
};
export const getCurrentUser = async () => {
  const res = await api.get('/api/auth/me', { headers: authHeaders() });
  return res.data;
};
export const recoverPassword = async (recipientId, recoveryKey, newPassword) => {
  const res = await api.post('/api/auth/recover-password', { recipient_id: recipientId, recovery_key: recoveryKey, new_password: newPassword });
  return res.data;
};
export const approveUser = async (recipientId) => {
  const res = await api.post('/api/auth/approve', { recipient_id: recipientId }, { headers: authHeaders() });
  return res.data;
};
export const assignRole = async (recipientId, role) => {
  const res = await api.post('/api/auth/assign-role', { recipient_id: recipientId, role }, { headers: authHeaders() });
  return res.data;
};
export const protectDocument = async (formData) => {
  const res = await api.post('/api/distribution/protect', formData, {
    headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
  });
  return res.data;
};
export const downloadProtectedDocument = async (docId) => {
  const res = await api.get(`/api/distribution/download/${docId}`, { headers: authHeaders(), responseType: 'blob' });
  return res.data;
};
export const listProtectedDocuments = async () => {
  const res = await api.get('/api/distribution/documents', { headers: authHeaders() });
  return res.data;
};
export const exportEvidence = async (watermarkId) => {
  const res = await api.post('/api/forensics/export-report', { watermark_id: watermarkId }, { headers: authHeaders(), responseType: 'blob' });
  return res.data;
};

// System Status
export const fetchSystemStatus = async () => {
  const res = await api.get('/api/system/status', { headers: authHeaders() });
  return res.data;
};

// 1. DISTRIBUTE
export const fetchActiveDocuments = async () => {
  const res = await api.get('/api/distribution/documents', { headers: authHeaders() });
  return res.data;
};

export const encryptAndDistribute = async (formData) => {
  const res = await api.post('/api/distribution/encrypt', formData, {
    headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
  });
  return res.data;
};

export const getSecurePackageDownloadUrl = (docId, recipientId) => {
  return `${api.defaults.baseURL}/api/distribution/download-package/${docId}/${recipientId}`;
};

// 2. MY DOCUMENTS & LOCAL RECIPIENT CLIENT
export const decryptSecurePackage = async (formData) => {
  const res = await api.post('/api/recipient/decrypt', formData, {
    headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
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
    headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
  });
  return res.data;
};

// 3. PEOPLE / IDENTITIES
export const fetchIdentities = async () => {
  const res = await api.get('/api/identities', { headers: authHeaders() });
  return res.data;
};

export const enrollIdentity = async ({ recipient_id, name, unit, password }) => {
  const res = await api.post('/api/identities/enroll', {
    recipient_id,
    name,
    unit,
    password,
  }, { headers: authHeaders() });
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
    headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
  });
  return res.data;
};

export const analyzeTextLeak = async (leakedText) => {
  const res = await api.post('/api/forensics/analyze-text', { leaked_text: leakedText }, { headers: authHeaders() });
  return res.data;
};

// 5. PROVENANCE & 4-VALIDATOR DLT
export const fetchLedgerBlocks = async () => {
  const res = await api.get('/api/ledger/blocks', { headers: authHeaders() });
  return res.data;
};

export const verifyLedgerIntegrity = async () => {
  const res = await api.get('/api/ledger/verify', { headers: authHeaders() });
  return res.data;
};

export const fetchValidators = async () => {
  const res = await api.get('/api/ledger/validators', { headers: authHeaders() });
  return res.data;
};

// 6. SECURITY CONSOLE & REVOCATION
export const fetchSecurityStatus = async () => {
  const res = await api.get('/api/security/status', { headers: authHeaders() });
  return res.data;
};

export const fetchRevocationList = async () => {
  const res = await api.get('/api/security/revocation-list', { headers: authHeaders() });
  return res.data;
};

export const revokeIdentity = async (recipientId, reason) => {
  const res = await api.post('/api/security/revoke-identity', {
    recipient_id: recipientId,
    reason: reason || 'Key compromise or clearance revoked',
  }, { headers: authHeaders() });
  return res.data;
};

export const unrevokeIdentity = async (recipientId) => {
  const res = await api.post('/api/security/unrevoke-identity', {
    recipient_id: recipientId,
  }, { headers: authHeaders() });
  return res.data;
};

export const revokeDocument = async (docId, reason) => {
  const res = await api.post('/api/security/revoke-document', {
    doc_id: docId,
    reason: reason || 'Document distribution retracted',
  }, { headers: authHeaders() });
  return res.data;
};

export const runSecurityTamperTest = async (blockIndex = 1, fakeRecipient = 'COMPROMISED-ATTACKER') => {
  const res = await api.post('/api/security/tamper-audit-test', {
    block_index: blockIndex,
    fake_recipient: fakeRecipient,
  }, { headers: authHeaders() });
  return res.data;
};

export const restoreLedgerState = async (blockIndex = 1, originalRecipient = 'USER-BOB') => {
  const res = await api.post('/api/security/restore-ledger', {
    block_index: blockIndex,
    original_recipient: originalRecipient,
  }, { headers: authHeaders() });
  return res.data;
};
