"""
Recipient-Side Decryption & Provenance Commitment API Routes.
Implements the local recipient decryption workflow:
1. Unlocks Argon2id vault with password.
2. Decapsulates ML-KEM-768 shared secret and unwraps CEK.
3. Decrypts AES-256-GCM PDF bytes.
4. Generates unique dynamic forensic watermark (tied to recipient + session).
5. Signs provenance event with recipient's NIST ML-DSA-65 private key.
6. Commits signed receipt to the offline permissioned DLT ledger.
"""
from typing import Optional
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

# In-memory session cache for downloaded watermarked PDFs: (doc_id, recipient_id) -> bytes
_latest_watermarked_pdfs = {}


class DecryptPackageRequest(BaseModel):
    doc_id: str
    recipient_id: str
    password: str
    device_fingerprint: Optional[str] = None


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
    """
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
    except InvalidCredentialsError as e:
        raise HTTPException(status_code=401, detail="Decryption Denied: Invalid passphrase or corrupted credential vault.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decryption failed: {str(e)}")

    # Asynchronously anchor the signed provenance receipt into the permissioned DLT ledger
    block_idx, block_hash = provenance_ledger.commit_receipt(dec_res.receipt)

    # Cache latest decrypted PDF for instant download
    cache_key = f"{dec_res.receipt.doc_id}:{dec_res.receipt.recipient_id}"
    _latest_watermarked_pdfs[cache_key] = dec_res.watermarked_pdf_bytes

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
        "watermarked_pdf_base64": base64.b64encode(dec_res.watermarked_pdf_bytes).decode("utf-8")
    }


@router.get("/download-decrypted-pdf/{doc_id}/{recipient_id}")
def download_decrypted_pdf(doc_id: str, recipient_id: str):
    """
    Downloads the real decrypted, forensically watermarked PDF file.
    This file is what the recipient views, prints, or potentially leaks.
    """
    cache_key = f"{doc_id}:{recipient_id}"
    pdf_bytes = _latest_watermarked_pdfs.get(cache_key)
    if not pdf_bytes:
        # Fallback to decrypting with default demo password if available
        identity = system_state.identities.get(recipient_id)
        if identity and (f"{doc_id}:{recipient_id}" in system_state.secure_packages):
            pkg_bytes = system_state.secure_packages[f"{doc_id}:{recipient_id}"]
            default_pwd = f"{identity.name}Secure2026!"
            try:
                dec_res = LocalRecipientDecryptor.decrypt_secure_package(pkg_bytes, default_pwd)
                provenance_ledger.commit_receipt(dec_res.receipt)
                pdf_bytes = dec_res.watermarked_pdf_bytes
                _latest_watermarked_pdfs[cache_key] = pdf_bytes
            except Exception:
                raise HTTPException(status_code=404, detail="No decrypted PDF available. Decrypt document first.")
        else:
            raise HTTPException(status_code=404, detail="No decrypted PDF available. Decrypt document first.")

    filename = f"Decrypted-{doc_id}-{recipient_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/submit-provenance-receipt")
def submit_remote_provenance_receipt(receipt: DecryptionProvenanceReceipt):
    """
    Allows air-gapped or remote recipient workstations to submit signed provenance receipts
    to the central provenance ledger.
    Verifies the recipient's ML-DSA-65 signature before committing.
    """
    pub_sig_bytes = base64.b64decode(receipt.recipient_public_key_sig_b64)
    sig_bytes = base64.b64decode(receipt.recipient_signature_b64)
    is_valid = DigitalSignatureManager.verify(receipt.event_digest.encode("utf-8"), sig_bytes, pub_sig_bytes)

    if not is_valid:
        raise HTTPException(status_code=403, detail="Receipt rejected: Invalid ML-DSA-65 digital signature.")

    block_idx, block_hash = provenance_ledger.commit_receipt(receipt)
    return {
        "status": "RECEIPT_ANCHORED",
        "block_index": block_idx,
        "block_hash": block_hash,
        "receipt_id": receipt.receipt_id
    }
