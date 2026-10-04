import React, { useState } from 'react';
import { 
  Lock, 
  Upload, 
  Download, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  X,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { protectDocument, getApiBaseUrl } from '../api';
import { downloadFileToDisk, openFolderForFile } from '../utils/fileSaver';
import { playClick, playSuccess, playError } from '../utils/soundEffects';

export default function DocumentPublisher({ identities = [], activeDocs = [], onDocumentPublished, onGoToDecrypt }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState(
    identities.map((i) => i.recipient_id)
  );
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [distributionResult, setDistributionResult] = useState(null);
  const [savedFilePath, setSavedFilePath] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelection = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      playError();
      setError('Only PDF files are supported.');
      return;
    }
    setError(null);
    setSelectedFile(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setTitle(cleanName);
    playClick();
  };

  const toggleRecipient = (id) => {
    playClick();
    if (selectedRecipients.includes(id)) {
      if (selectedRecipients.length > 1) {
        setSelectedRecipients(selectedRecipients.filter((r) => r !== id));
      }
    } else {
      setSelectedRecipients([...selectedRecipients, id]);
    }
  };

  const handleProtectAndDistribute = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      playError();
      setError('Please select or drop a PDF document to encrypt.');
      return;
    }
    if (selectedRecipients.length === 0) {
      playError();
      setError('Please select at least one recipient.');
      return;
    }

    setIsEncrypting(true);
    setError(null);
    playClick();

    const formData = new FormData();
    formData.append('title', title || selectedFile.name.replace(/\.[^/.]+$/, ''));
    formData.append('classification', 'CONFIDENTIAL');
    formData.append('recipient_ids', selectedRecipients.join(','));
    formData.append('file', selectedFile);

    try {
      const res = await protectDocument(formData);
      playSuccess();
      setDistributionResult(res);
      if (onDocumentPublished) onDocumentPublished();
    } catch (err) {
      playError();
      setError(err.response?.data?.detail || 'Document distribution failed.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleSaveToDisk = async (docId, docTitle, base64Data) => {
    playClick();
    const filename = `${docTitle || docId}.pdf`;
    try {
      const res = await downloadFileToDisk({
        defaultFilename: filename,
        base64Content: base64Data,
        mimeType: 'application/pdf'
      });
      if (res && res.success && res.filePath) {
        playSuccess();
        setSavedFilePath(res.filePath);
      }
    } catch (_) {
      playError();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Primary Studio */}
        <div className="lg:col-span-7 space-y-5">
          <form onSubmit={handleProtectAndDistribute} className="liquid-glass-card p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/60">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2 tracking-tight">
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span>Encrypt & Distribute Studio</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Encrypt document once with AES-256 and wrap access slots using ML-KEM-768.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 border border-blue-500/20 shadow-xs">
                Post-Quantum
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-red-50/90 border border-red-200/80 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* 1. Primary Action: File Upload Dropzone (REQUIRED) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 block">
                Source Document <span className="text-red-500">*</span>
              </label>

              {!selectedFile ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelection(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                      : 'border-slate-300 hover:border-blue-400 bg-white/60 hover:bg-white/90'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileSelection(e.target.files?.[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shadow-xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Drop your PDF document here, or <span className="text-blue-600 underline">browse</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports authentic PDF documents up to 50MB</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-white/90 border border-slate-200/90 rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center space-x-3 truncate">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready to encrypt</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setTitle(''); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* 2. Optional Title (Auto-populated from file) */}
            {selectedFile && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Strategic Product Roadmap"
                  className="w-full bg-white/85 border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-xs"
                />
              </div>
            )}

            {/* 3. Recipient Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Authorized Recipients ({selectedRecipients.length} of {identities.length})
                </label>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setSelectedRecipients(
                      selectedRecipients.length === identities.length
                        ? [identities[0]?.recipient_id]
                        : identities.map((i) => i.recipient_id)
                    );
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  {selectedRecipients.length === identities.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {identities.map((ident) => {
                  const isSelected = selectedRecipients.includes(ident.recipient_id);
                  return (
                    <div
                      key={ident.recipient_id}
                      onClick={() => toggleRecipient(ident.recipient_id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all duration-200 select-none ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold shadow-xs'
                          : 'bg-white/60 border-slate-200/80 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{ident.name}</span>
                        {isSelected && <span className="text-blue-600 font-bold">&bull;</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono truncate">{ident.recipient_id}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isEncrypting || !selectedFile}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition-all duration-200 shadow-md transform hover:scale-[1.01] active:scale-[0.99]"
            >
              {isEncrypting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Encrypting with ML-KEM-768...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Encrypt PDF & Embed Recipient Slots</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Status & Distribution Result */}
        <div className="lg:col-span-5 space-y-4">
          {distributionResult ? (
            <div className="liquid-glass-card p-6 space-y-4 border-emerald-500/30 bg-emerald-50/20">
              <div className="flex items-center space-x-2.5 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-extrabold text-sm text-slate-900">Protected PDF Ready</h3>
              </div>

              <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/60 text-xs text-slate-700 space-y-1">
                <div>Document: <span className="font-bold text-slate-900">{distributionResult.title}</span></div>
                <div className="font-mono text-[10px] text-slate-500 truncate">ID: {distributionResult.doc_id}</div>
                <div className="text-[10px] text-slate-600">Encrypted for {distributionResult.authorized_recipients?.length || distributionResult.recipients_count} recipients</div>
              </div>

              {savedFilePath && (
                <div className="p-2.5 bg-emerald-100/80 border border-emerald-300 rounded-xl text-[11px] text-emerald-900 space-y-1">
                  <div className="font-bold">Saved to disk:</div>
                  <div className="font-mono text-[10px] break-all">{savedFilePath}</div>
                  <button
                    onClick={() => openFolderForFile(savedFilePath)}
                    className="flex items-center space-x-1 text-emerald-800 font-bold hover:underline pt-0.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open in Folder</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleSaveToDisk(distributionResult.doc_id, distributionResult.title, distributionResult.protected_pdf_base64)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Save Protected PDF to Disk</span>
              </button>

              {onGoToDecrypt && (
                <button
                  type="button"
                  onClick={onGoToDecrypt}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1 transition-all"
                >
                  <span>Proceed to Decrypt Workstation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="liquid-glass-card p-6 space-y-3.5">
              <h3 className="font-bold text-xs text-slate-800 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Enclave Encrypted Repository</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Documents encrypted on the shared enclave:
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activeDocs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No encrypted documents distributed yet.</p>
                ) : (
                  activeDocs.map((doc) => (
                    <div key={doc.doc_id} className="p-3 rounded-xl bg-white/70 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 truncate">{doc.title}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{doc.doc_id}</span>
                      </div>
                      <a
                        href={`${getApiBaseUrl()}/api/distribution/download/${doc.doc_id}`}
                        download={`${doc.title || doc.doc_id}.pdf`}
                        className="w-full py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-semibold text-slate-700 flex items-center justify-center space-x-1 transition-colors"
                      >
                        <Download className="w-3 h-3 text-blue-600" />
                        <span>Download Protected PDF</span>
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
