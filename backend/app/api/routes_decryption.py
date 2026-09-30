"""
Recipient Decryption & Provenance Commitment API Routes.
Implements decryption-time dynamic attribution and cryptographic receipt anchoring
to the immutable blockchain ledger.
"""
from typing import Optional
import base64
import hashlib
import time
import uuid
from fastapi import APIRouter, HTTPException

from app.core.types import (
    DecryptDocumentRequest,
    DecryptedDocumentResponse,
    DecryptionProvenanceReceipt,
    WatermarkPayload
)
from app.core.state import system_state
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pqc_sig import DigitalSignatureManager
from app.watermarking.text_stego import TextSteganographyWatermarker
from app.provenance.ledger import provenance_ledger

router = APIRouter(prefix="/api", tags=["Recipient Decryption"])

text_watermarker = TextSteganographyWatermarker()


@router.post("/decrypt", response_model=DecryptedDocumentResponse)
def decrypt_document_endpoint(req: DecryptDocumentRequest):
    """
    Simulates recipient client workstation decryption:
    1. Decapsulates hybrid CEK using recipient's private key.
    2. Decrypts AES-256-GCM document payload.
    3. Dynamically embeds invisible zero-width forensic watermark into plaintext.
    4. Computes digital signature on receipt using recipient's signing key.
    5. Commits signed receipt to immutable Merkle blockchain ledger.
    """
    package = system_state.documents.get(req.doc_id)
    if not package:
        raise HTTPException(status_code=404, detail="Document package not found.")

    officer = system_state.get_officer(req.recipient_id)
    if not officer:
        raise HTTPException(status_code=403, detail="Officer identity not enrolled.")

    # Validate recipient is in the distribution envelope
    if not any(wrap.recipient_id == req.recipient_id for wrap in package.recipient_wraps):
        raise HTTPException(status_code=403, detail="Access Denied: Officer not authorized in this document envelope.")

    try:
        priv_x25519 = base64.b64decode(req.private_key_x25519_b64)
        priv_pqc = base64.b64decode(req.private_key_pqc_b64) if req.private_key_pqc_b64 else base64.b64decode(officer.priv_pqc_b64)
        priv_sig = base64.b64decode(req.private_key_sig_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid cryptographic key format: {str(e)}")

    # 1. Decrypt document payload
    try:
        raw_plaintext = MultiRecipientEnvelope.decrypt_document(
            package=package,
            recipient_id=req.recipient_id,
            priv_x25519_bytes=priv_x25519,
            priv_pqc_bytes=priv_pqc
        )
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Cryptographic Decapsulation Failed: {str(e)}")

    # 2. Dynamic Watermark Generation & Injection at Decryption Time
    decryption_time = time.time()
    watermarked_text, wm_payload = text_watermarker.embed(
        doc_id=req.doc_id,
        recipient_id=req.recipient_id,
        plaintext=raw_plaintext,
        timestamp=decryption_time
    )

    # 3. Compute Canonical Watermark Hash
    wm_hash = hashlib.sha256(
        f"{wm_payload.doc_id}|{wm_payload.recipient_id}|{int(wm_payload.timestamp)}|{wm_payload.session_nonce}".encode("utf-8")
    ).hexdigest()

    # 4. Construct Non-Repudiation Decryption Provenance Receipt
    receipt_id = f"RCPT-{uuid.uuid4().hex[:12].upper()}"
    receipt_sign_payload = f"{receipt_id}|{req.doc_id}|{req.recipient_id}|{wm_hash}|{req.device_fingerprint}|{int(decryption_time)}".encode("utf-8")
    
    # 5. Cryptographically sign the receipt with recipient's private key
    sig_bytes = DigitalSignatureManager.sign(receipt_sign_payload, priv_sig)
    receipt_sig_b64 = base64.b64encode(sig_bytes).decode("utf-8")

    receipt = DecryptionProvenanceReceipt(
        receipt_id=receipt_id,
        doc_id=req.doc_id,
        recipient_id=req.recipient_id,
        timestamp=decryption_time,
        watermark_hash=wm_hash,
        device_fingerprint=req.device_fingerprint,
        recipient_signature_b64=receipt_sig_b64
    )

    # 6. Commit to Provenance Blockchain Ledger
    block_index, block_hash = provenance_ledger.commit_receipt(receipt)

    return DecryptedDocumentResponse(
        doc_id=req.doc_id,
        title=package.title,
        classification=package.classification,
        plaintext_content=watermarked_text,
        watermark_payload=wm_payload,
        receipt=receipt,
        ledger_block_index=block_index,
        ledger_block_hash=block_hash,
        notice=f"CONFIDENTIAL: Attributed to {officer.name} [{req.recipient_id}]. Cryptographic receipt #{receipt_id} recorded in Blockchain Block #{block_index}."
    )
