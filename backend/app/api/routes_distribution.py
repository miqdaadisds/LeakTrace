"""
Secure Document Distribution API Routes (v1.1 — Genuine Encrypted PDF).
Implements the broadcast-encrypt / individually-decrypt model:
- Encrypts document payload ONCE with genuine AES-256 PDF encryption.
- Generates ONE protected PDF for ALL authorized recipients.
- Embeds ML-KEM wrapped Document Open Secret slots in appended trailer.
- No per-recipient files. No .secure containers.
"""
from typing import List, Optional
import hashlib
import os
import uuid
import base64
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response, Depends

from app.core.state import system_state
from app.core.pdf_generator import generate_sample_navy_pdf
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector
from app.auth import middleware

router = APIRouter(prefix="/api/distribution", tags=["Document Distribution"])

# In-memory store for protected PDFs (keyed by doc_id)
_protected_pdfs = system_state.protected_pdfs


@router.get("/documents")
@router.get("/active-documents")
def list_documents():
    """Returns list of distributed protected documents."""
    docs = []
    seen = set()
    for doc_id, meta in system_state.document_metadata.items():
        seen.add(doc_id)
        docs.append({
            "doc_id": doc_id,
            "title": meta.get("title", ""),
            "classification": meta.get("classification", ""),
            "original_filename": meta.get("original_filename", ""),
            "doc_hash_sha256": meta.get("doc_hash_sha256", ""),
            "authorized_recipients": meta.get("authorized_recipients", []),
            "download_url": f"/api/distribution/download/{doc_id}"
        })
    if middleware.db:
        try:
            import json
            db_docs = middleware.db.list_protected_documents()
            for row in db_docs:
                d_id = row["doc_id"]
                if d_id not in seen:
                    seen.add(d_id)
                    rcpt_ids = json.loads(row["recipient_ids_json"]) if isinstance(row["recipient_ids_json"], str) else []
                    docs.append({
                        "doc_id": d_id,
                        "title": row["title"],
                        "classification": "CONFIDENTIAL // RESTRICTED",
                        "original_filename": f"{d_id}.pdf",
                        "doc_hash_sha256": row["doc_hash"],
                        "authorized_recipients": rcpt_ids,
                        "download_url": f"/api/distribution/download/{d_id}"
                    })
        except Exception:
            pass
    return docs


@router.post("/protect")
async def protect_document(
    title: str = Form(...),
    classification: str = Form("CONFIDENTIAL // RESTRICTED"),
    recipient_ids: str = Form(..., description="Comma-separated recipient IDs"),
    content_body: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Protects a PDF for distribution to multiple recipients.
    Creates ONE genuine AES-256 encrypted PDF with ML-KEM access slots.
    All recipients receive the exact same file.
    """
    rcpt_list = [r.strip() for r in recipient_ids.split(",") if r.strip()]
    if not rcpt_list:
        raise HTTPException(status_code=400, detail="Must provide at least one recipient ID.")

    # Validate all recipients exist (check system_state and DB)
    for r_id in rcpt_list:
        if r_id not in system_state.identities and middleware.db:
            db_row = middleware.db.get_identity(r_id)
            if db_row:
                system_state._register_db_row(db_row)
        if r_id not in system_state.identities:
            raise HTTPException(status_code=404, detail=f"Recipient {r_id} is not enrolled.")

    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"

    # Ingest document bytes
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

    # Generate random Document Open Secret (never shown to users)
    doc_open_secret = os.urandom(32).hex()

    # Wrap DOS for each recipient using ML-KEM
    dos_bytes = doc_open_secret.encode("utf-8")
    recipient_slots = []
    for r_id in rcpt_list:
        identity = system_state.identities[r_id]
        wrap = MultiRecipientEnvelope.wrap_cek_for_recipient(
            cek=dos_bytes,
            recipient_id=r_id,
            pub_x25519_bytes=identity.pub_x25519_bytes,
            pub_pqc_bytes=identity.pub_pqc_bytes
        )
        recipient_slots.append(wrap)

    # Create ONE protected PDF
    protected_pdf = PdfProtector.protect(
        source_pdf_bytes=pdf_bytes,
        doc_id=doc_id,
        title=title,
        doc_open_secret=doc_open_secret,
        recipient_slots=recipient_slots
    )

    # Store metadata and protected PDF
    system_state.original_pdfs[doc_id] = pdf_bytes
    system_state.document_metadata[doc_id] = {
        "doc_id": doc_id,
        "title": title,
        "classification": classification,
        "original_filename": filename,
        "doc_hash_sha256": doc_hash,
        "authorized_recipients": rcpt_list
    }
    _protected_pdfs[doc_id] = protected_pdf

    if middleware.db:
        try:
            import json, time
            middleware.db.store_protected_document(
                doc_id=doc_id,
                title=title,
                sender_id="ADMIN",
                recipient_ids_json=json.dumps(rcpt_list),
                doc_hash=doc_hash,
                protected_pdf=protected_pdf,
                created_at=time.time()
            )
        except Exception:
            pass

    return {
        "status": "SUCCESS",
        "doc_id": doc_id,
        "title": title,
        "doc_hash_sha256": doc_hash,
        "encryption_model": "AES-256 Genuine PDF Encryption",
        "post_quantum_kem": "NIST FIPS 203 ML-KEM-768",
        "recipients_count": len(rcpt_list),
        "authorized_recipients": rcpt_list,
        "protected_pdf_size": len(protected_pdf),
        "download_url": f"/api/distribution/download/{doc_id}"
    }


@router.get("/download/{doc_id}")
def download_protected_pdf(doc_id: str):
    """
    Downloads the protected PDF. Same file for every recipient.
    """
    pdf_bytes = _protected_pdfs.get(doc_id)
    filename = None
    if not pdf_bytes and middleware.db:
        doc_row = middleware.db.get_protected_document(doc_id)
        if doc_row:
            pdf_bytes = doc_row["protected_pdf"]
            filename = f"{doc_row['title'].replace(' ', '_')}.pdf"

    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Protected document not found.")

    if not filename:
        meta = system_state.document_metadata.get(doc_id, {})
        filename = meta.get("original_filename", f"{doc_id}.pdf")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

