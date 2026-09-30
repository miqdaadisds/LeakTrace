import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchSystemStatus = async () => {
  const res = await api.get('/api/system/status');
  return res.data;
};

export const fetchOfficers = async () => {
  const res = await api.get('/api/officers');
  return res.data;
};

export const fetchOfficerCredentials = async (recipientId) => {
  const res = await api.get(`/api/officers/${recipientId}/credentials`);
  return res.data;
};

export const fetchDocuments = async () => {
  const res = await api.get('/api/documents');
  return res.data;
};

export const fetchDocumentPackage = async (docId) => {
  const res = await api.get(`/api/documents/${docId}`);
  return res.data;
};

export const publishDocument = async (payload) => {
  const res = await api.post('/api/documents', payload);
  return res.data;
};

export const decryptDocument = async (payload) => {
  const res = await api.post('/api/decrypt', payload);
  return res.data;
};

export const analyzeTextLeak = async (leakedText) => {
  const res = await api.post('/api/forensics/analyze-text', { leaked_text: leakedText });
  return res.data;
};

export const analyzeImageLeak = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/api/forensics/analyze-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const watermarkImage = async (docId, recipientId, imageBase64) => {
  const res = await api.post('/api/forensics/watermark-image', {
    doc_id: docId,
    recipient_id: recipientId,
    image_base64: imageBase64,
  });
  return res.data;
};

export const fetchBlockchainBlocks = async () => {
  const res = await api.get('/api/ledger/blocks');
  return res.data;
};

export const verifyBlockchain = async () => {
  const res = await api.get('/api/ledger/verify');
  return res.data;
};

export default api;
