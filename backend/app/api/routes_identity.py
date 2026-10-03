"""
Identity Management API Routes.
Manages post-quantum cryptographic identity generation, Argon2id protected credential vaults,
and public-key registration for authorized recipients (Alice, Bob, Charlie).
"""
import base64
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.types import RecipientProfile
from app.core.state import system_state
try:
    from app.auth import middleware
except ImportError:
    from backend.app.auth import middleware

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
    Sources from central database repository with fallback to in-memory state.
    Does NOT expose private keys or passwords.
    """
    profiles = []
    seen_ids = set()

    # 1. Primary Source of Truth: Central/Local Database Repository
    if middleware.db:
        try:
            db_identities = middleware.db.list_identities()
            for row in db_identities:
                if row.get("is_revoked"):
                    continue
                rec_id = row["recipient_id"]
                seen_ids.add(rec_id)

                pub_kem = row.get("public_key_kem")
                if isinstance(pub_kem, memoryview):
                    pub_kem = bytes(pub_kem)
                elif isinstance(pub_kem, str):
                    try:
                        pub_kem = base64.b64decode(pub_kem)
                    except Exception:
                        pub_kem = b""

                pub_sig = row.get("public_key_sig")
                if isinstance(pub_sig, memoryview):
                    pub_sig = bytes(pub_sig)
                elif isinstance(pub_sig, str):
                    try:
                        pub_sig = base64.b64decode(pub_sig)
                    except Exception:
                        pub_sig = b""

                pub_x = pub_kem[:32] if pub_kem and len(pub_kem) >= 32 else b""
                pub_pqc = pub_kem[32:] if pub_kem and len(pub_kem) > 32 else b""

                profiles.append(RecipientProfile(
                    recipient_id=rec_id,
                    name=row.get("name", ""),
                    unit=row.get("unit", ""),
                    public_key_x25519_b64=base64.b64encode(pub_x).decode("utf-8") if pub_x else "",
                    public_key_pqc_b64=base64.b64encode(pub_pqc).decode("utf-8") if pub_pqc else "",
                    public_key_sig_b64=base64.b64encode(pub_sig).decode("utf-8") if pub_sig else "",
                    fingerprint=row.get("fingerprint"),
                    role=row.get("role", "recipient"),
                    approved=(row.get("role") != "pending"),
                    recovery_key_hash=row.get("recovery_key_hash")
                ))
        except Exception:
            pass

    # 2. In-memory state supplement
    for identity in system_state.identities.values():
        if identity.recipient_id not in seen_ids:
            seen_ids.add(identity.recipient_id)
            profiles.append(identity.to_profile())

    return profiles


@router.post("/enroll", response_model=RecipientProfile)
def enroll_identity(req: EnrollIdentityRequest):
    """
    Enrolls a new recipient:
    1. Generates genuine NIST ML-KEM-768 and ML-DSA-65 keypairs.
    2. Protects private keys at rest inside an Argon2id memory-hard encrypted vault.
    3. Registers the public keys with the provenance system.
    """
    if req.recipient_id in system_state.identities or (middleware.db and middleware.db.get_identity(req.recipient_id)):
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
    if middleware.db:
        try:
            row = middleware.db.get_identity(recipient_id)
            if row and row.get("encrypted_vault"):
                vault_data = row["encrypted_vault"]
                if isinstance(vault_data, memoryview):
                    vault_data = bytes(vault_data)
                if isinstance(vault_data, bytes):
                    try:
                        return json.loads(vault_data.decode("utf-8"))
                    except Exception:
                        return json.loads(vault_data)
                elif isinstance(vault_data, str):
                    return json.loads(vault_data)
                elif isinstance(vault_data, dict):
                    return vault_data
        except Exception:
            pass

    identity = system_state.identities.get(recipient_id)
    if not identity:
        raise HTTPException(status_code=404, detail="Recipient not found.")
    return identity.encrypted_vault
