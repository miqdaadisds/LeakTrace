"""
Domain entities and Pydantic schemas for SIH26237.
Strict typing and validation for defence-grade multi-recipient cryptography,
steganographic watermarking, and provenance ledger verification.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import time


class RecipientProfile(BaseModel):
    recipient_id: str = Field(..., description="Unique defence officer/command identifier, e.g. DEF-NAVY-0842")
    name: str = Field(..., description="Officer rank and full name")
    unit: str = Field(..., description="Naval Command / Flotilla / Ship Unit")
    public_key_x25519_b64: str = Field(..., description="Classical ECDH public key (Base64)")
    public_key_pqc_b64: str = Field(..., description="Post-Quantum ML-KEM-768 public key (Base64)")
    public_key_sig_b64: str = Field(..., description="Digital signature verification key Ed25519/ML-DSA (Base64)")


class EncryptedKeyWrap(BaseModel):
    recipient_id: str
    encapsulated_key_b64: str = Field(..., description="PQC + ECDH KEM ciphertext")
    wrapped_cek_b64: str = Field(..., description="AES-256-GCM wrapped Content Encryption Key")
    tag_b64: str = Field(..., description="GCM authentication tag for key unwrap")


class EncryptedDocumentPackage(BaseModel):
    doc_id: str
    title: str
    classification: str = "RESTRICTED // NAVAL DEFENCE"
    publisher_id: str
    ciphertext_b64: str
    nonce_b64: str
    aad: str
    recipient_wraps: List[EncryptedKeyWrap]
    created_at: float = Field(default_factory=time.time)
    doc_hash_sha256: str


class WatermarkPayload(BaseModel):
    doc_id: str
    recipient_id: str
    timestamp: float
    session_nonce: str
    hmac_sig: str


class DecryptionProvenanceReceipt(BaseModel):
    receipt_id: str
    doc_id: str
    recipient_id: str
    timestamp: float = Field(default_factory=time.time)
    watermark_hash: str
    device_fingerprint: str
    recipient_signature_b64: str


class ProvenanceBlock(BaseModel):
    block_index: int
    timestamp: float = Field(default_factory=time.time)
    previous_hash: str
    merkle_root: str
    receipts: List[DecryptionProvenanceReceipt]
    block_hash: str


class DecryptDocumentRequest(BaseModel):
    doc_id: str
    recipient_id: str
    private_key_x25519_b64: str
    private_key_pqc_b64: Optional[str] = None
    private_key_sig_b64: str
    device_fingerprint: str = "NAVY-WORKSTATION-SECURE-NODE-04"


class DecryptedDocumentResponse(BaseModel):
    doc_id: str
    title: str
    classification: str
    plaintext_content: str  # Contains dynamic invisible zero-width watermark
    watermark_payload: WatermarkPayload
    receipt: DecryptionProvenanceReceipt
    ledger_block_index: int
    ledger_block_hash: str
    notice: str = "Document cryptographically attributed to your identity. All leaks are mathematically traceable."


class ForensicAttributionResult(BaseModel):
    is_attributed: bool
    doc_id: Optional[str] = None
    leaker_id: Optional[str] = None
    leaker_name: Optional[str] = None
    leaker_unit: Optional[str] = None
    decryption_timestamp: Optional[float] = None
    decryption_time_str: Optional[str] = None
    session_nonce: Optional[str] = None
    hmac_verified: bool = False
    ledger_block_index: Optional[int] = None
    ledger_merkle_verified: bool = False
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    evidence_type: str  # "TEXT_ZERO_WIDTH" or "IMAGE_DCT_QIM" or "NONE"
    forensic_summary: str
