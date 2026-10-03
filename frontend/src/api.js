import axios from 'axios';

// Detect active backend endpoint (Electron preload, runtime override, environment variable, or central cloud default)
export const CENTRAL_DEFAULT_BACKEND = 'https://leaktrace-backend.onrender.com';

function resolveDefaultApiUrl() {
  if (typeof window !== 'undefined' && window.electronAPI?.apiUrl) {
    return window.electronAPI.apiUrl;
  }
  if (typeof window !== 'undefined' && window.__LEAKTRACE_API_URL__) {
    return window.__LEAKTRACE_API_URL__;
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('leaktrace_api_url');
    // If saved is an obsolete local url, ignore it unless forced offline
    if (saved && !saved.includes('127.0.0.1') && !saved.includes('localhost')) {
      return saved;
    }
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return CENTRAL_DEFAULT_BACKEND;
}

const defaultUrl = resolveDefaultApiUrl();

const api = axios.create({
  baseURL: defaultUrl,
  timeout: 30000,
});

export function getApiBaseUrl() {
  return api.defaults.baseURL;
}

export function setApiBaseUrl(url) {
  if (url) {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    api.defaults.baseURL = cleanUrl;
    if (typeof window !== 'undefined') {
      localStorage.setItem('leaktrace_api_url', cleanUrl);
    }
  }
}

// Security Boundary: Session token held strictly in-memory per security specification
let inMemoryToken = null;

export function setAuthToken(token) { 
  inMemoryToken = token; 
}

export function getAuthToken() {
  return inMemoryToken;
}

export function clearAuthToken() { 
  inMemoryToken = null; 
}

function authHeaders() {
  const headers = {};
  if (inMemoryToken) headers['Authorization'] = `Bearer ${inMemoryToken}`;
  return headers;
}

// ==========================================
// 1. HEALTH & COLD-START RECOVERY
// ==========================================
export const checkHealthWithRetry = async (maxAttempts = 15, intervalMs = 2000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await api.get('/health', { timeout: 5000 });
      if (res.status === 200) {
        return { online: true, data: res.data };
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        return { online: false, error: err.message };
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return { online: false };
};

// ==========================================
// 2. AUTHENTICATION & ZERO-PASSWORD LOGIN
// ==========================================
export const checkAuthStatus = async () => {
  const res = await api.get('/api/auth/status', { headers: authHeaders() });
  return res.data;
};

export const setupOrganization = async (name, unit, password) => {
  const res = await api.post('/api/auth/setup', { name, unit, password });
  if (res.data?.token) setAuthToken(res.data.token);
  return res.data;
};

// Classical/Offline password registration & login fallback
export const register = async (name, unit, password) => {
  const res = await api.post('/api/auth/register', { name, unit, password });
  return res.data;
};

export const login = async (recipientId, password) => {
  const res = await api.post('/api/auth/login', { recipient_id: recipientId, password });
  if (res.data?.token) setAuthToken(res.data.token);
  return res.data;
};

// Connected Sovereign Public Registration
export const registerPublic = async ({ recipient_id, name, unit, public_key_kem_b64, public_key_sig_b64, fingerprint }) => {
  const res = await api.post('/api/auth/register-public', {
    recipient_id,
    name,
    unit: unit || '',
    public_key_kem_b64,
    public_key_sig_b64,
    fingerprint: fingerprint || ''
  });
  return res.data;
};

// Connected Zero-Password Challenge-Response Login Flow
export const requestAuthChallenge = async (recipientId) => {
  const res = await api.post('/api/auth/challenge', { recipient_id: recipientId });
  return res.data;
};

export const submitAuthChallenge = async (recipientId, challengeId, signatureB64) => {
  const res = await api.post('/api/auth/login-challenge', {
    recipient_id: recipientId,
    challenge_id: challengeId,
    signature_b64: signatureB64
  });
  if (res.data?.token) {
    setAuthToken(res.data.token);
  }
  return res.data;
};

export const logout = async () => {
  try {
    await api.post('/api/auth/logout', {}, { headers: authHeaders() });
  } finally {
    clearAuthToken();
  }
  return { status: 'ok' };
};

export const getCurrentUser = async () => {
  const res = await api.get('/api/auth/me', { headers: authHeaders() });
  return res.data;
};

export const recoverPassword = async (recipientId, recoveryKey, newPassword) => {
  const res = await api.post('/api/auth/recover-password', {
    recipient_id: recipientId,
    recovery_key: recoveryKey,
    new_password: newPassword
  });
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

// ==========================================
// 3. REALTIME EVENTS (SSE & POLLING FALLBACK)
// ==========================================
export function subscribeToRealtimeEvents(onEvent, onError) {
  const baseURL = api.defaults.baseURL;
  const sseUrl = `${baseURL}/api/events`;
  let eventSource = null;
  let pollInterval = null;
  let lastTimestamp = Date.now() / 1000;

  try {
    eventSource = new EventSource(sseUrl);
    
    const handleMessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.timestamp) lastTimestamp = parsed.timestamp;
        onEvent(parsed);
      } catch (_) {}
    };

    eventSource.onopen = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    eventSource.onmessage = handleMessage;
    eventSource.addEventListener('USER_REGISTERED', handleMessage);
    eventSource.addEventListener('USER_APPROVED', handleMessage);
    eventSource.addEventListener('ROLE_CHANGED', handleMessage);
    eventSource.addEventListener('DOCUMENT_AUTHORIZED', handleMessage);
    eventSource.addEventListener('DOCUMENT_AVAILABLE', handleMessage);
    eventSource.addEventListener('PROVENANCE_COMMITTED', handleMessage);
    eventSource.addEventListener('IDENTITY_REVOKED', handleMessage);

    eventSource.onerror = (err) => {
      if (onError) onError(err);
      if (!pollInterval) {
        pollInterval = setInterval(async () => {
          try {
            const res = await api.get(`/api/events/poll?since=${lastTimestamp}`);
            if (res.data?.events) {
              for (const ev of res.data.events) {
                if (ev.timestamp > lastTimestamp) lastTimestamp = ev.timestamp;
                onEvent(ev);
              }
            }
          } catch (_) {}
        }, 3000);
      }
    };
  } catch (err) {
    pollInterval = setInterval(async () => {
      try {
        const res = await api.get(`/api/events/poll?since=${lastTimestamp}`);
        if (res.data?.events) {
          for (const ev of res.data.events) {
            if (ev.timestamp > lastTimestamp) lastTimestamp = ev.timestamp;
            onEvent(ev);
          }
        }
      } catch (_) {}
    }, 3000);
  }

  return () => {
    if (eventSource) eventSource.close();
    if (pollInterval) clearInterval(pollInterval);
  };
}

// ==========================================
// 4. DOCUMENT DISTRIBUTION
// ==========================================
export const protectDocument = async (formData) => {
  const res = await api.post('/api/distribution/protect', formData, {
    headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
  });
  return res.data;
};

export const downloadProtectedDocument = async (docId) => {
  const res = await api.get(`/api/distribution/download/${docId}`, {
    headers: authHeaders(),
    responseType: 'blob'
  });
  return res.data;
};

export const listProtectedDocuments = async () => {
  const res = await api.get('/api/distribution/documents', { headers: authHeaders() });
  return res.data;
};

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

// ==========================================
// 5. RECIPIENT CLIENT & PROVENANCE
// ==========================================
export const fetchMyAuthorizedDocuments = async () => {
  const res = await api.get('/api/recipient/my-documents', { headers: authHeaders() });
  return res.data;
};

export const decryptSecurePackage = async (formData) => {
  const res = await api.post('/api/recipient/decrypt', formData, {
    headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
  });
  return res.data;
};

export const submitProvenanceReceipt = async (receiptData) => {
  const res = await api.post('/api/recipient/submit-provenance-receipt', receiptData, {
    headers: authHeaders()
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

// ==========================================
// 6. IDENTITIES & DIRECTORY
// ==========================================
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

// ==========================================
// 7. FORENSICS LAB
// ==========================================
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

export const exportEvidence = async (watermarkId) => {
  const res = await api.post('/api/forensics/export-report', { watermark_id: watermarkId, format: 'pdf' }, {
    headers: authHeaders(),
    responseType: 'blob'
  });
  return res.data;
};

// ==========================================
// 8. PROVENANCE & 4-VALIDATOR DLT
// ==========================================
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

// ==========================================
// 9. SECURITY CONSOLE & REVOCATION
// ==========================================
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

export const fetchSystemStatus = async () => {
  const res = await api.get('/api/system/status', { headers: authHeaders() });
  return res.data;
};
