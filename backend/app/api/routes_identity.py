"""
Identity Management API Routes.
Manages post-quantum cryptographic identity generation, Argon2id protected credential vaults,
and public-key registration for authorized recipients (Alice, Bob, Charlie).
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.types import RecipientProfile
from app.core.state import system_state

router = APIRouter(prefix="/api/identities", tags=["Identity Management"])


class EnrollIdentityRequest(BaseModel):
    recipient_id: str = Field(..., description="Unique user or officer ID, e.g. USER-DAVE")
    name: str = Field(..., description="Full Name or Callsign")
    unit: str = Field(..., description="Department, Squadron, or Team")
    password: str = Field(..., min_length=8, description="Strong passphrase for Argon2id key derivation")


@router.get("", response_model=List[RecipientProfile])
def list_identities():
    """
    Returns registered recipient profiles with public keys and fingerprints.
    Does NOT expose private keys or passwords.
    """
    return [identity.to_profile() for identity in system_state.identities.values()]


@router.post("/enroll", response_model=RecipientProfile)
def enroll_identity(req: EnrollIdentityRequest):
    """
    Enrolls a new recipient:
    1. Generates genuine NIST ML-KEM-768 and ML-DSA-65 keypairs.
    2. Protects private keys at rest inside an Argon2id memory-hard encrypted vault.
    3. Registers the public keys with the provenance system.
    """
    if req.recipient_id in system_state.identities:
        raise HTTPException(status_code=400, detail=f"Recipient ID {req.recipient_id} is already enrolled.")

    identity = system_state.register_new_identity(
        recipient_id=req.recipient_id,
        name=req.name,
        unit=req.unit,
        password=req.password
    )
    return identity.to_profile()


@router.get("/{recipient_id}/vault")
def get_recipient_vault(recipient_id: str):
    """
    Exports the recipient's password-encrypted Argon2id vault.
    Useless without the recipient's personal password.
    """
    identity = system_state.identities.get(recipient_id)
    if not identity:
        raise HTTPException(status_code=404, detail="Recipient not found.")
    return identity.encrypted_vault
