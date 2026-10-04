import axios from 'axios';

// Detect active backend endpoint (Electron preload, runtime override, environment variable, or local enclave default)
export const LOCAL_DEFAULT_BACKEND = 'http://127.0.0.1:8000';
export const CENTRAL_DEFAULT_BACKEND = 'https://leaktrace-backend.onrender.com';

function resolveDefaultApiUrl() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('traceleak_api_url') || localStorage.getItem('leaktrace_api_url');
    if (saved) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined' && window.electronAPI?.apiUrl) {
    return window.electronAPI.apiUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.__TRACELEAK_API_URL__) {
    return window.__TRACELEAK_API_URL__.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '');
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

export function setApiBaseUrl(url, persist = true) {
  if (url) {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    api.defaults.baseURL = cleanUrl;
    if (persist && typeof window !== 'undefined') {
      localStorage.setItem('traceleak_api_url', cleanUrl);
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
export const testEnclaveHealth = async (url) => {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const start = Date.now();
  try {
    const res = await axios.get(`${cleanUrl}/health`, { timeout: 6000 });
    return { online: res.status === 200, latency: Date.now() - start, data: res.data };
  } catch (err) {
    return { online: false, error: err.message };
  }
};

export const checkHealthWithRetry = async (maxAttempts = 10, intervalMs = 2000) => {
  const currentBase = api.defaults.baseURL;
  const isCloud = currentBase.includes('onrender.com');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await api.get('/health', { timeout: isCloud ? 6000 : 3000 });
      if (res.status === 200) {
        return { online: true, data: res.data, url: api.defaults.baseURL };
      }
    } catch (err) {
      // If cloud is cold-starting or unreachable after several attempts, test local fallback
      if (attempt >= 3 && isCloud) {
        try {
          const localRes = await axios.get('http://127.0.0.1:8000/health', { timeout: 2000 });
          if (localRes.status === 200) {
            console.log('[TraceLeak] Detected local secure enclave at http://127.0.0.1:8000');
            // Do not permanently overwrite saved preference, but switch active session if cloud is down
            if (attempt === maxAttempts) {
              setApiBaseUrl('http://127.0.0.1:8000', false);
              return { online: true, data: localRes.data, url: 'http://127.0.0.1:8000', fallback: true };
            }
          }
        } catch (_) {}
      }

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

export const syncAdminVault = async (vaultPayload) => {
  const res = await api.post('/api/auth/sync-admin-vault', vaultPayload);
  return res.data;
};

// ==========================================
// 3. REALTIME EVENTS (DUAL SSE & HEARTBEAT POLLING)
// ==========================================
export function subscribeToRealtimeEvents(onEvent, onError) {
  const baseURL = api.defaults.baseURL;
  const sseUrl = `${baseURL}/api/events`;
  let eventSource = null;
  let pollInterval = null;
  let lastTimestamp = Date.now() / 1000;
  const processedEventKeys = new Set();

  const handleMessage = (e) => {
    try {
      const parsed = JSON.parse(e.data);
      const evKey = `${parsed.event_type}_${parsed.timestamp || ''}_${JSON.stringify(parsed.data || '')}`;
      if (processedEventKeys.has(evKey)) return;
      processedEventKeys.add(evKey);
      if (processedEventKeys.size > 200) {
        const oldest = Array.from(processedEventKeys).slice(0, 50);
        oldest.forEach(k => processedEventKeys.delete(k));
      }

      if (parsed.timestamp && parsed.timestamp > lastTimestamp) {
        lastTimestamp = parsed.timestamp;
      }
      onEvent(parsed);
    } catch (_) {}
  };

  // 1. Establish SSE Persistent Stream
  try {
    eventSource = new EventSource(sseUrl);
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
    };
  } catch (err) {
    if (onError) onError(err);
  }

  // 2. Active Heartbeat Polling Fallback (runs in parallel every 3.5s to bypass cloud proxy buffering)
  pollInterval = setInterval(async () => {
    try {
      const res = await api.get(`/api/events/poll?since=${lastTimestamp}`, { timeout: 4000 });
      if (res.data?.events && Array.isArray(res.data.events)) {
        for (const ev of res.data.events) {
          const evKey = `${ev.event_type}_${ev.timestamp || ''}_${JSON.stringify(ev.data || '')}`;
          if (!processedEventKeys.has(evKey)) {
            processedEventKeys.add(evKey);
            if (ev.timestamp && ev.timestamp > lastTimestamp) {
              lastTimestamp = ev.timestamp;
            }
            onEvent(ev);
          }
        }
      }
    } catch (_) {}
  }, 3500);

  return () => {
    if (eventSource) {
      try { eventSource.close(); } catch (_) {}
    }
    if (pollInterval) {
      clearInterval(pollInterval);
    }
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
