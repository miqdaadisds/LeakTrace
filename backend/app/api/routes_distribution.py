"""
Secure Document Distribution API Routes.
Implements the broadcast-encrypt / individually-decrypt model.
Encrypts document payload ONCE with AES-256-GCM and generates portable single-file
.secure packages per recipient containing ML-KEM wrapped CEKs and Argon2id vaults.
"""
from typing import List, Optional, Dict, Any
import hashlib
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel, Field

from app.core.state import system_state
from app.core.pdf_generator import generate_sample_navy_pdf
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.container import SecureContainerFormat

router = APIRouter(prefix="/api/distribution", tags=["Document Distribution"])


class DistributionRequest(BaseModel):
    title: str = Field(..., description="Document Title, e.g. Confidential Strategic Roadmap")
    classification: str = Field(default="CONFIDENTIAL // RESTRICTED")
    recipient_ids: List[str] = Field(..., min_length=1, description="List of authorized recipient IDs")
    content_body: Optional[str] = Field(None, description="Document plaintext body if synthesized")


@router.get("/active-documents")
def get_active_documents():
    """Returns active distributed documents and available recipient packages."""
    docs = []
    for doc_id, meta in system_state.document_metadata.items():
        packages = []
        for r_id in meta["authorized_recipients"]:
            pkg_key = f"{doc_id}:{r_id}"
            has_pkg = pkg_key in system_state.secure_packages
            identity = system_state.identities.get(r_id)
            packages.append({
                "recipient_id": r_id,
                "recipient_name": identity.name if identity else r_id,
                "has_secure_package": has_pkg,
                "download_url": f"/api/distribution/download-package/{doc_id}/{r_id}"
            })
        docs.append({
            "doc_id": doc_id,
            "title": meta["title"],
            "classification": meta["classification"],
            "original_filename": meta["original_filename"],
            "doc_hash_sha256": meta["doc_hash_sha256"],
            "packages": packages
        })
    return docs


@router.post("/encrypt")
async def encrypt_and_distribute(
    title: str = Form(...),
    classification: str = Form("CONFIDENTIAL // RESTRICTED"),
    recipient_ids: str = Form(..., description="Comma-separated recipient IDs"),
    content_body: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Encrypts a document ONCE and generates individual .secure files for each authorized recipient.
    """
    rcpt_list = [r.strip() for r in recipient_ids.split(",") if r.strip()]
    if not rcpt_list:
        raise HTTPException(status_code=400, detail="Must provide at least one recipient ID.")

    # Validate all recipients exist
    for r_id in rcpt_list:
        if r_id not in system_state.identities:
            raise HTTPException(status_code=404, detail=f"Recipient {r_id} is not enrolled.")

    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"

    # Ingest document bytes (from uploaded PDF or synthesized PDF)
    if file and file.filename:
        pdf_bytes = await file.read()
        filename = file.filename
    else:
        body = content_body or (
            f"1. OPERATIONAL MANDATE: Classified strategic plan for {title}.\n"
            "2. POST-QUANTUM ASSURANCE: Protected under NIST ML-KEM-768 & ML-DSA-65.\n"
            "3. FORENSIC AUDIT: Decryption events are non-repudiably signed and fingerprinted."
        )
        pdf_bytes = generate_sample_navy_pdf(title, doc_id, classification, body)
        filename = f"{title.replace(' ', '_')}.pdf"

    doc_hash = hashlib.sha256(pdf_bytes).hexdigest()
    system_state.original_pdfs[doc_id] = pdf_bytes
    system_state.document_metadata[doc_id] = {
        "doc_id": doc_id,
        "title": title,
        "classification": classification,
        "original_filename": filename,
        "doc_hash_sha256": doc_hash,
        "authorized_recipients": rcpt_list
    }

    # Encrypt document payload ONCE with AES-256-GCM
    cek, encrypted_payload = MultiRecipientEnvelope.encrypt_document_bytes(
        document_bytes=pdf_bytes,
        doc_id=doc_id,
        title=title,
        classification=classification,
        publisher_id="SECURE-DISTRIBUTOR-01"
    )

    # Wrap CEK and package container for each recipient
    generated_packages = []
    for r_id in rcpt_list:
        identity = system_state.identities[r_id]
        wrapped_cek = MultiRecipientEnvelope.wrap_cek_for_recipient(
            cek=cek,
            recipient_id=r_id,
            pub_x25519_bytes=identity.pub_x25519_bytes,
            pub_pqc_bytes=identity.pub_pqc_bytes
        )

        pkg = SecureContainerFormat.pack(
            doc_id=doc_id,
            title=title,
            original_filename=filename,
            classification=classification,
            doc_hash_sha256=doc_hash,
            recipient_id=r_id,
            recipient_name=identity.name,
            recipient_public_kem_b64=identity.pub_pqc_b64,
            recipient_public_sig_b64=identity.pub_sig_b64,
            encrypted_vault=identity.encrypted_vault,
            wrapped_cek=wrapped_cek,
            encrypted_payload=encrypted_payload
        )

        pkg_bytes = SecureContainerFormat.serialize_to_bytes(pkg)
        pkg_key = f"{doc_id}:{r_id}"
        system_state.secure_packages[pkg_key] = pkg_bytes

        generated_packages.append({
            "recipient_id": r_id,
            "recipient_name": identity.name,
            "package_filename": f"{filename.rsplit('.', 1)[0]}-{identity.name}.secure",
            "download_url": f"/api/distribution/download-package/{doc_id}/{r_id}"
        })

    return {
        "status": "SUCCESS",
        "doc_id": doc_id,
        "title": title,
        "doc_hash_sha256": doc_hash,
        "encryption_model": "O(1) AES-256-GCM Single Ciphertext",
        "post_quantum_kem": "NIST FIPS 203 ML-KEM-768",
        "recipients_count": len(rcpt_list),
        "packages": generated_packages
    }


@router.get("/download-package/{doc_id}/{recipient_id}")
def download_secure_package(doc_id: str, recipient_id: str):
    """
    Downloads the portable single-file .secure container for the specified recipient.
    Contains the single-ciphertext payload, recipient's ML-KEM wrapped CEK, and encrypted vault.
    """
    pkg_key = f"{doc_id}:{recipient_id}"
    pkg_bytes = system_state.secure_packages.get(pkg_key)
    if not pkg_bytes:
        raise HTTPException(status_code=404, detail="Secure package not found for recipient.")

    meta = system_state.document_metadata.get(doc_id, {})
    identity = system_state.identities.get(recipient_id)
    name = identity.name if identity else recipient_id
    base_name = meta.get("original_filename", "Document.pdf").rsplit(".", 1)[0]
    filename = f"{base_name}-{name}.secure"

    return Response(
        content=pkg_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
