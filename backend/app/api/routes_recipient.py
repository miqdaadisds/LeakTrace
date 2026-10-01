"""
Recipient-Side Decryption & Provenance Commitment API Routes.
Implements the genuine recipient-side decryption workflow:
1. Validates recipient identity and document against revocation list.
2. Unlocks Argon2id vault locally with recipient's password.
3. Decapsulates ML-KEM-768 shared secret and unwraps CEK locally.
4. Decrypts AES-256-GCM PDF bytes locally.
5. Injects dynamic unique forensic watermark (tied to recipient + session).
6. Signs provenance event with recipient's NIST ML-DSA-65 private key.
7. Anchors signed receipt into offline permissioned DLT ledger.
8. NEVER executes server-side fallback decryption.
"""
from typing import Optional, Dict, Any, List
import json
import base64
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel, Field

from app.core.state import system_state
from app.client.decryptor import LocalRecipientDecryptor
from app.crypto.vault import InvalidCredentialsError
from app.provenance.ledger import provenance_ledger
from app.crypto.pqc_sig import DigitalSignatureManager
from app.core.types import DecryptionProvenanceReceipt

router = APIRouter(prefix="/api/recipient", tags=["Recipient Workstation"])

# In-memory session cache for locally decrypted watermarked PDFs and receipts:
# (doc_id, recipient_id) -> bytes
_latest_watermarked_pdfs: Dict[str, bytes] = {}
_latest_provenance_receipts: Dict[str, DecryptionProvenanceReceipt] = {}


@router.post("/decrypt")
async def decrypt_package_endpoint(
    doc_id: Optional[str] = Form(None),
    recipient_id: Optional[str] = Form(None),
    password: str = Form(...),
    device_fingerprint: Optional[str] = Form(None),
    package_file: Optional[UploadFile] = File(None)
):
    """
    Executes recipient-side local decryption.
    Accepts either an uploaded .secure file OR active (doc_id, recipient_id) selection + recipient password.
    Enforces revocation checks: revoked recipients or documents are rejected immediately.
    """
    # Pre-check revocation if IDs provided
    if recipient_id and system_state.is_identity_revoked(recipient_id):
        raise HTTPException(
            status_code=403, 
            detail=f"Access Denied: Recipient {recipient_id} credentials have been revoked."
        )
    if doc_id and system_state.is_document_revoked(doc_id):
        raise HTTPException(
            status_code=403, 
            detail=f"Access Denied: Document {doc_id} distribution has been retracted."
        )

    if package_file and package_file.filename:
        pkg_bytes = await package_file.read()
    elif doc_id and recipient_id:
        pkg_key = f"{doc_id}:{recipient_id}"
        pkg_bytes = system_state.secure_packages.get(pkg_key)
        if not pkg_bytes:
            raise HTTPException(status_code=404, detail="Secure package not found for recipient.")
    else:
        raise HTTPException(status_code=400, detail="Must provide either a .secure package file or doc_id and recipient_id.")

    dev_fp = device_fingerprint or "WORKSTATION-ENCLAVE-NODE-01"

    try:
        dec_res = LocalRecipientDecryptor.decrypt_secure_package(
            package_input=pkg_bytes,
            password=password,
            device_fingerprint=dev_fp
        )
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="Decryption Denied: Invalid passphrase or corrupted credential vault.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decryption failed: {str(e)}")

    # Post-unpack revocation check (in case package was loaded from file)
    actual_rcpt = dec_res.receipt.recipient_id
    actual_doc = dec_res.receipt.doc_id
    if system_state.is_identity_revoked(actual_rcpt):
        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: Recipient {actual_rcpt} credentials have been revoked."
        )
    if system_state.is_document_revoked(actual_doc):
        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: Document {actual_doc} distribution has been retracted."
        )

    # Anchor the signed provenance receipt into the permissioned DLT ledger
    block_idx, block_hash = provenance_ledger.commit_receipt(dec_res.receipt)

    # Store in local session cache
    cache_key = f"{dec_res.receipt.doc_id}:{dec_res.receipt.recipient_id}"
    _latest_watermarked_pdfs[cache_key] = dec_res.watermarked_pdf_bytes
    _latest_provenance_receipts[cache_key] = dec_res.receipt
    system_state.offline_receipt_store[dec_res.receipt.receipt_id] = dec_res.receipt

    return {
        "status": "DECRYPTION_SUCCESSFUL",
        "doc_id": dec_res.receipt.doc_id,
        "recipient_id": dec_res.receipt.recipient_id,
        "session_id": dec_res.receipt.session_id,
        "watermark_id": dec_res.receipt.watermark_id,
        "device_fingerprint": dec_res.receipt.device_fingerprint,
        "timestamp": dec_res.receipt.timestamp,
        "ledger_block_index": block_idx,
        "ledger_block_hash": block_hash,
        "signature_algorithm": "NIST FIPS 204 ML-DSA-65",
        "receipt": dec_res.receipt.model_dump(),
        "pdf_download_url": f"/api/recipient/download-decrypted-pdf/{dec_res.receipt.doc_id}/{dec_res.receipt.recipient_id}",
        "receipt_download_url": f"/api/recipient/download-provenance-receipt/{dec_res.receipt.doc_id}/{dec_res.receipt.recipient_id}",
        "watermarked_pdf_base64": base64.b64encode(dec_res.watermarked_pdf_bytes).decode("utf-8")
    }


@router.get("/download-decrypted-pdf/{doc_id}/{recipient_id}")
def download_decrypted_pdf(doc_id: str, recipient_id: str):
    """
    Downloads the real decrypted, forensically watermarked PDF file.
    Only available after the recipient has legitimately decrypted with their password.
    Zero server-side fallback decryption.
    """
    cache_key = f"{doc_id}:{recipient_id}"
    pdf_bytes = _latest_watermarked_pdfs.get(cache_key)
    if not pdf_bytes:
        raise HTTPException(
            status_code=404, 
            detail="No decrypted PDF in local session cache. Recipient must perform local decryption first."
        )

    filename = f"Decrypted-{doc_id}-{recipient_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/download-provenance-receipt/{doc_id}/{recipient_id}")
def download_provenance_receipt(doc_id: str, recipient_id: str):
    """
    Exports the signed provenance receipt as a portable .receipt JSON file
    for air-gapped transport and ledger synchronization.
    """
    cache_key = f"{doc_id}:{recipient_id}"
    receipt = _latest_provenance_receipts.get(cache_key)
    if not receipt:
        raise HTTPException(
            status_code=404, 
            detail="No provenance receipt available. Decrypt document first."
        )

    filename = f"Receipt-{doc_id}-{recipient_id}.receipt"
    receipt_json = json.dumps(receipt.model_dump(), indent=2).encode("utf-8")
    return Response(
        content=receipt_json,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/import-provenance-receipt-file")
async def import_provenance_receipt_file(receipt_file: UploadFile = File(...)):
    """
    Imports a portable .receipt file from an air-gapped recipient computer.
    Verifies the ML-DSA-65 post-quantum digital signature before committing to ledger.
    """
    try:
        content = await receipt_file.read()
        data = json.loads(content.decode("utf-8"))
        receipt = DecryptionProvenanceReceipt(**data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse receipt file: {str(e)}")

    # Verify recipient's ML-DSA-65 signature
    pub_sig_bytes = base64.b64decode(receipt.recipient_public_key_sig_b64)
    sig_bytes = base64.b64decode(receipt.recipient_signature_b64)
    is_valid = DigitalSignatureManager.verify(receipt.event_digest.encode("utf-8"), sig_bytes, pub_sig_bytes)

    if not is_valid:
        raise HTTPException(status_code=403, detail="Receipt rejected: Invalid ML-DSA-65 signature.")

    block_idx, block_hash = provenance_ledger.commit_receipt(receipt)
    system_state.offline_receipt_store[receipt.receipt_id] = receipt

    return {
        "status": "AIRGAP_RECEIPT_ANCHORED",
        "block_index": block_idx,
        "block_hash": block_hash,
        "receipt_id": receipt.receipt_id,
        "recipient_id": receipt.recipient_id,
        "watermark_id": receipt.watermark_id
    }


@router.post("/submit-provenance-receipt")
def submit_remote_provenance_receipt(receipt: DecryptionProvenanceReceipt):
    """
    Allows air-gapped or remote recipient workstations to submit signed provenance receipts
    to the central provenance ledger via JSON payload.
    Verifies the recipient's ML-DSA-65 signature before committing.
    """
    pub_sig_bytes = base64.b64decode(receipt.recipient_public_key_sig_b64)
    sig_bytes = base64.b64decode(receipt.recipient_signature_b64)
    is_valid = DigitalSignatureManager.verify(receipt.event_digest.encode("utf-8"), sig_bytes, pub_sig_bytes)

    if not is_valid:
        raise HTTPException(status_code=403, detail="Receipt rejected: Invalid ML-DSA-65 digital signature.")

    block_idx, block_hash = provenance_ledger.commit_receipt(receipt)
    system_state.offline_receipt_store[receipt.receipt_id] = receipt
    return {
        "status": "RECEIPT_ANCHORED",
        "block_index": block_idx,
        "block_hash": block_hash,
        "receipt_id": receipt.receipt_id
    }
