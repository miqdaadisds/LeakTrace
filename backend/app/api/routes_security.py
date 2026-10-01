"""
Security, Revocation, and Audit Management API Routes.
Provides controls for:
1. PQC algorithm and 4-node notary quorum health inspection.
2. Recipient credential revocation (Certificate Revocation List).
3. Document access revocation (distribution retraction).
4. Ledger integrity audit and tamper detection testing.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.state import system_state
from app.provenance.ledger import provenance_ledger
from app.provenance.validator import validator_network

router = APIRouter(prefix="/api/security", tags=["Security Console"])


class RevokeIdentityRequest(BaseModel):
    recipient_id: str
    reason: Optional[str] = "Security clearance revoked or key compromise"


class RevokeDocumentRequest(BaseModel):
    doc_id: str
    reason: Optional[str] = "Document distribution retracted by publisher"


class TamperTestRequest(BaseModel):
    block_index: int = 1
    fake_recipient: str = "COMPROMISED-ATTACKER"


class RestoreLedgerRequest(BaseModel):
    block_index: int = 1
    original_recipient: str = "USER-BOB"


@router.get("/status")
def get_security_status():
    """Returns security parameters, quorum status, and active revocation lists."""
    is_valid, msg, audit_trail = provenance_ledger.verify_chain_integrity()
    validators = validator_network.get_validators_info()

    return {
        "pqc_standards": {
            "key_encapsulation": "NIST FIPS 203 ML-KEM-768 (Hybrid with X25519)",
            "digital_signature": "NIST FIPS 204 ML-DSA-65",
            "symmetric_cipher": "AES-256-GCM (Authenticated Single Ciphertext)",
            "credential_kdf": "Argon2id (t=2, m=64MB, p=4)"
        },
        "validator_network": {
            "nodes_count": len(validators),
            "quorum_threshold": validator_network.quorum_threshold,
            "quorum_rule": f"{validator_network.quorum_threshold}-of-{len(validators)} Nodes Required",
            "nodes": validators
        },
        "ledger_integrity": {
            "is_valid": is_valid,
            "message": msg,
            "blocks_count": len(provenance_ledger.get_chain()),
            "audit_trail": audit_trail
        },
        "revocations": {
            "revoked_identities": list(system_state.revoked_identities.values()),
            "revoked_documents": list(system_state.revoked_documents.values())
        }
    }


@router.get("/revocation-list")
def get_revocation_list():
    """Returns active Certificate Revocation List (CRL) and retracted documents."""
    return {
        "revoked_identities": system_state.revoked_identities,
        "revoked_documents": system_state.revoked_documents
    }


@router.post("/revoke-identity")
def revoke_identity(req: RevokeIdentityRequest):
    """Revokes a recipient's credentials, preventing further decryption."""
    if req.recipient_id not in system_state.identities:
        raise HTTPException(status_code=404, detail="Recipient identity not found.")
    info = system_state.revoke_identity(req.recipient_id, req.reason)
    return {"status": "IDENTITY_REVOKED", "revocation_info": info}


@router.post("/unrevoke-identity")
def unrevoke_identity(req: RevokeIdentityRequest):
    """Restores a previously revoked identity."""
    success = system_state.unrevoke_identity(req.recipient_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recipient was not in revocation list.")
    return {"status": "IDENTITY_RESTORED", "recipient_id": req.recipient_id}


@router.post("/revoke-document")
def revoke_document(req: RevokeDocumentRequest):
    """Retracts document distribution across all recipients."""
    if req.doc_id not in system_state.document_metadata:
        raise HTTPException(status_code=404, detail="Document ID not found.")
    info = system_state.revoke_document(req.doc_id, req.reason)
    return {"status": "DOCUMENT_REVOKED", "revocation_info": info}


@router.post("/tamper-audit-test")
def tamper_audit_test(req: TamperTestRequest):
    """
    Simulates a rogue administrator attempting to silently rewrite history.
    Modifies a historical record and immediately runs the full blockchain verification.
    """
    try:
        tamper_info = provenance_ledger.tamper_historical_record(req.block_index, req.fake_recipient)
        is_valid, msg, audit_trail = provenance_ledger.verify_chain_integrity()
        return {
            "tamper_executed": True,
            "tamper_details": tamper_info,
            "verification_result": {
                "detected_tampering": not is_valid,
                "is_valid": is_valid,
                "message": msg,
                "audit_trail": audit_trail
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/restore-ledger")
def restore_ledger(req: RestoreLedgerRequest):
    """Restores ledger back to authentic state after running tamper test."""
    provenance_ledger.restore_historical_record(req.block_index, req.original_recipient)
    is_valid, msg, _ = provenance_ledger.verify_chain_integrity()
    return {"status": "RESTORED", "is_valid": is_valid, "message": msg}
