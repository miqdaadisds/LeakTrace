"""
Document Management & Multi-Recipient Distribution API Routes.
Provides endpoints for publishing classified documents, viewing envelope packages,
and querying enrolled officer directories.
"""
from typing import List, Optional
import time
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.types import EncryptedDocumentPackage, RecipientProfile
from app.core.state import system_state
from app.crypto.envelope import MultiRecipientEnvelope

router = APIRouter(prefix="/api", tags=["Document Distribution"])


class PublishDocumentRequest(BaseModel):
    title: str = Field(..., description="Document Title")
    classification: str = Field(default="TOP SECRET // DEFENCE", description="Security clearance banner")
    plaintext: str = Field(..., description="Unencrypted document content")
    publisher_id: str = Field(default="WESEE-DIRECTORATE-DELHI", description="Publishing unit")
    recipient_ids: List[str] = Field(..., description="List of authorized recipient IDs")


class DocumentSummary(BaseModel):
    doc_id: str
    title: str
    classification: str
    publisher_id: str
    recipient_count: int
    recipient_ids: List[str]
    created_at: float
    doc_hash_sha256: str
    ciphertext_length: int


@router.get("/officers", response_model=List[RecipientProfile])
def list_officers():
    """Returns directory of enrolled officers and their public cryptographic keys."""
    return system_state.get_all_profiles()


@router.get("/officers/{recipient_id}/credentials")
def get_officer_credentials(recipient_id: str):
    """
    Returns full credentials including simulated private keys for client decryption demonstration.
    In real production, private keys stay in HSM / smartcards.
    """
    officer = system_state.get_officer(recipient_id)
    if not officer:
        raise HTTPException(status_code=404, detail="Officer identity not found.")
    return {
        "recipient_id": officer.recipient_id,
        "name": officer.name,
        "unit": officer.unit,
        "clearance": officer.clearance,
        "public_key_x25519_b64": officer.pub_x25519_b64,
        "private_key_x25519_b64": officer.priv_x25519_b64,
        "public_key_pqc_b64": officer.pub_pqc_b64,
        "private_key_pqc_b64": officer.priv_pqc_b64,
        "public_key_sig_b64": officer.pub_sig_b64,
        "private_key_sig_b64": officer.priv_sig_b64,
    }


@router.get("/documents", response_model=List[DocumentSummary])
def list_documents():
    """Lists all encrypted documents distributed across naval units."""
    summaries = []
    for doc in system_state.documents.values():
        summaries.append(DocumentSummary(
            doc_id=doc.doc_id,
            title=doc.title,
            classification=doc.classification,
            publisher_id=doc.publisher_id,
            recipient_count=len(doc.recipient_wraps),
            recipient_ids=[w.recipient_id for w in doc.recipient_wraps],
            created_at=doc.created_at,
            doc_hash_sha256=doc.doc_hash_sha256,
            ciphertext_length=len(doc.ciphertext_b64)
        ))
    return summaries


@router.get("/documents/{doc_id}", response_model=EncryptedDocumentPackage)
def get_document_package(doc_id: str):
    """Retrieves the encrypted document package with all recipient key encapsulations."""
    doc = system_state.documents.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.post("/documents", response_model=EncryptedDocumentPackage)
def publish_document(req: PublishDocumentRequest):
    """
    Encrypts a classified document ONCE and encapsulates the Content Encryption Key (CEK)
    for all selected recipients using Post-Quantum ML-KEM-768 + X25519 hybrid cryptography.
    """
    if not req.recipient_ids:
        raise HTTPException(status_code=400, detail="Must authorize at least one recipient.")

    recipients: List[RecipientProfile] = []
    for r_id in req.recipient_ids:
        officer = system_state.get_officer(r_id)
        if not officer:
            raise HTTPException(status_code=400, detail=f"Recipient {r_id} does not exist.")
        recipients.append(officer.to_profile())

    doc_id = f"DOC-NAVY-{int(time.time())}-{uuid.uuid4().hex[:6].upper()}"

    package = MultiRecipientEnvelope.encrypt_document(
        doc_id=doc_id,
        title=req.title,
        plaintext=req.plaintext,
        classification=req.classification,
        publisher_id=req.publisher_id,
        recipients=recipients
    )

    system_state.documents[doc_id] = package
    system_state.raw_documents_cache[doc_id] = req.plaintext
    return package
