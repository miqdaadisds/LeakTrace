"""
Domain entities and Pydantic schemas for SIH26237.
Strict typing and validation for defence-grade multi-recipient cryptography,
steganographic watermarking, and provenance ledger verification.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import time


class RecipientProfile(BaseModel):
    recipient_id: str = Field(..., description="Unique defence officer/user identifier, e.g. USER-BOB")
    name: str = Field(..., description="Full name or operational callsign")
    unit: str = Field(..., description="Department, Team, or Military Command")
    public_key_x25519_b64: str = Field(..., description="Classical ECDH public key (Base64)")
    public_key_pqc_b64: str = Field(..., description="Post-Quantum ML-KEM-768 public key (Base64)")
    public_key_sig_b64: str = Field(..., description="Digital signature verification key ML-DSA-65 (Base64)")
    fingerprint: Optional[str] = Field(None, description="SHA-256 fingerprint of public keys")


class EncryptedKeyWrap(BaseModel):
    recipient_id: str
    kem_ciphertext_b64: str = Field(..., description="ML-KEM-768 + X25519 KEM ciphertext")
    wrapped_cek_b64: str = Field(..., description="AES-256-GCM wrapped Content Encryption Key")
    wrap_nonce_b64: str = Field(..., description="Nonce for CEK wrapping")
    tag_b64: str = Field(..., description="GCM authentication tag for key unwrap")


class WatermarkPayload(BaseModel):
    doc_id: str
    recipient_id: str
    timestamp: float
    session_nonce: str
    hmac_sig: str
    session_id: Optional[str] = None
    watermark_id: Optional[str] = None


class DecryptionProvenanceReceipt(BaseModel):
    receipt_id: str
    doc_id: str
    recipient_id: str
    session_id: str
    watermark_id: str
    ciphertext_hash: str
    timestamp: float = Field(default_factory=time.time)
    device_fingerprint: str
    recipient_signature_b64: str
    recipient_public_key_sig_b64: str
    event_digest: str


class ProvenanceBlock(BaseModel):
    block_index: int
    timestamp: float = Field(default_factory=time.time)
    previous_hash: str
    merkle_root: str
    receipts: List[DecryptionProvenanceReceipt]
    validator_signatures: List[Dict[str, str]] = []
    block_hash: str


class ForensicAttributionResult(BaseModel):
    is_attributed: bool
    doc_id: Optional[str] = None
    doc_title: Optional[str] = None
    recipient_id: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_unit: Optional[str] = None
    session_id: Optional[str] = None
    watermark_id: Optional[str] = None
    decryption_timestamp: Optional[float] = None
    decryption_time_str: Optional[str] = None
    evidence_type: str = "PDF_STRUCTURAL_CARRIER"
    watermark_status: str = "NOT_FOUND"  # "MATCHED", "CORRUPTED", "NOT_FOUND"
    signature_status: str = "UNVERIFIED"  # "VALID", "INVALID", "UNVERIFIED"
    ledger_status: str = "UNVERIFIED"     # "VALID", "INVALID", "UNVERIFIED"
    ledger_block_index: Optional[int] = None
    merkle_root: Optional[str] = None
    validator_quorum_status: Optional[str] = None
    forensic_summary: str
    detailed_evidence: Dict[str, Any] = {}
