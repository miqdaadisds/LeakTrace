import time
import secrets
import uuid
import json
import base64
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Dict, Any
from argon2 import PasswordHasher

try:
    from app.auth.session_manager import create_session, invalidate_session, validate_session
    from app.auth import middleware
    from app.crypto.pqc_kem import HybridPQCKEM
    from app.crypto.pqc_sig import DigitalSignatureManager
    from app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
    from app.core.state import system_state
    from app.core.events import event_broker
except ImportError:
    from backend.app.auth.session_manager import create_session, invalidate_session, validate_session
    from backend.app.auth import middleware
    from backend.app.crypto.pqc_kem import HybridPQCKEM
    from backend.app.crypto.pqc_sig import DigitalSignatureManager
    from backend.app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
    from backend.app.core.state import system_state
    from backend.app.core.events import event_broker

router = APIRouter(prefix="/api/auth", tags=["auth"])
ph = PasswordHasher()

class SetupRequest(BaseModel):
    name: str
    unit: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    unit: str
    password: str

class LoginRequest(BaseModel):
    recipient_id: str
    password: str

class RecoverPasswordRequest(BaseModel):
    recipient_id: str
    recovery_key: str
    new_password: str

class ApproveRequest(BaseModel):
    recipient_id: str

class AssignRoleRequest(BaseModel):
    recipient_id: str
    role: str

class ChallengeRequest(BaseModel):
    recipient_id: str

class LoginChallengeRequest(BaseModel):
    recipient_id: str
    challenge_id: str
    signature_b64: str

class RegisterPublicRequest(BaseModel):
    recipient_id: str
    name: str
    unit: Optional[str] = ""
    public_key_kem_b64: str
    public_key_sig_b64: str
    fingerprint: Optional[str] = ""

class SyncAdminVaultRequest(BaseModel):
    recipient_id: str
    name: str
    unit: str
    encrypted_vault_b64: str
    public_key_kem_b64: str
    public_key_sig_b64: str
    recovery_key_hash: str

@router.get("/status")
def auth_status(credentials: Optional[HTTPAuthorizationCredentials] = Depends(middleware.security)):
    if not middleware.db:
        return {"setup_complete": True, "authenticated": False, "user": None}
    setup_complete = middleware.db.is_setup_complete()
    if credentials and hasattr(credentials, "credentials"):
        user_info = validate_session(middleware.db, credentials.credentials)
        if user_info:
            user = middleware.db.get_identity(user_info['user_id'])
            if user and not user['is_revoked']:
                return {
                    "setup_complete": setup_complete,
                    "authenticated": True,
                    "user": {
                        "recipient_id": user['recipient_id'],
                        "name": user['name'],
                        "role": user['role'],
                        "unit": user['unit']
                    }
                }
    return {"setup_complete": setup_complete, "authenticated": False, "user": None}

def _generate_identity_keys(password: str):
    # KEM Keypair
    priv_x25519, pub_x25519, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    public_key_kem = pub_x25519 + pub_pqc
    
    # Sig Keypair
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
    public_key_sig = pub_sig
    
    # Recovery key (256-bit URL-safe token)
    recovery_key = secrets.token_urlsafe(32)
    recovery_key_hash = ph.hash(recovery_key)
    
    # Primary Vault (encrypted with user password)
    primary_vault = EncryptedCredentialVault.create_vault(
        password=password,
        priv_kem_classical=priv_x25519,
        priv_kem_pqc=priv_pqc,
        priv_sig=priv_sig
    )
    
    # Recovery Vault (encrypted with recovery key to enable recovery without key loss)
    recovery_vault = EncryptedCredentialVault.create_vault(
        password=recovery_key,
        priv_kem_classical=priv_x25519,
        priv_kem_pqc=priv_pqc,
        priv_sig=priv_sig
    )
    
    vault_bundle = {
        "primary": primary_vault,
        "recovery": recovery_vault
    }
    
    return public_key_kem, public_key_sig, vault_bundle, recovery_key, recovery_key_hash

@router.post("/setup")
def auth_setup(req: SetupRequest):
    if not middleware.db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    if middleware.db.is_setup_complete():
        raise HTTPException(status_code=400, detail="Setup already complete")
        
    recipient_id = f"USER-{req.name.upper().replace(' ', '_')}"
    
    public_key_kem, public_key_sig, vault_bundle, recovery_key, recovery_key_hash = _generate_identity_keys(req.password)
    
    middleware.db.insert_identity(
        recipient_id=recipient_id,
        name=req.name,
        unit=req.unit,
        role='admin',
        encrypted_vault=json.dumps(vault_bundle).encode('utf-8'),
        public_key_kem=public_key_kem,
        public_key_sig=public_key_sig,
        recovery_key_hash=recovery_key_hash,
        fingerprint="",
        created_at=time.time()
    )
    
    middleware.db.set_config('setup_complete', 'true')
    system_state.sync_from_db(middleware.db)
    token = create_session(middleware.db, recipient_id)
    
    return {
        "user": {"recipient_id": recipient_id, "name": req.name, "role": 'admin'},
        "recovery_key": recovery_key,
        "token": token
    }

@router.post("/register")
def auth_register(req: RegisterRequest):
    if not middleware.db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    recipient_id = f"USER-{req.name.upper().replace(' ', '_')}"
    
    public_key_kem, public_key_sig, vault_bundle, recovery_key, recovery_key_hash = _generate_identity_keys(req.password)
    
    middleware.db.insert_identity(
        recipient_id=recipient_id,
        name=req.name,
        unit=req.unit,
        role='pending',
        encrypted_vault=json.dumps(vault_bundle).encode('utf-8'),
        public_key_kem=public_key_kem,
        public_key_sig=public_key_sig,
        recovery_key_hash=recovery_key_hash,
        fingerprint="",
        created_at=time.time()
    )
    system_state.sync_from_db(middleware.db)
    
    event_broker.publish("USER_REGISTERED", {
        "recipient_id": recipient_id,
        "name": req.name,
        "unit": req.unit,
        "role": 'pending',
        "fingerprint": "",
        "created_at": time.time()
    })

    return {
        "user": {"recipient_id": recipient_id, "name": req.name, "role": 'pending'},
        "recovery_key": recovery_key
    }

@router.post("/login")
def auth_login(req: LoginRequest):
    if not middleware.db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    user = middleware.db.get_identity(req.recipient_id)
    if not user or user['is_revoked']:
        raise HTTPException(status_code=401, detail="Invalid credentials or account revoked")
        
    vault_data = json.loads(user['encrypted_vault'].decode('utf-8'))
    # Support both bundled vault {"primary": ..., "recovery": ...} and standalone vault
    primary_vault = vault_data.get("primary", vault_data)
    
    try:
        EncryptedCredentialVault.unlock_vault(req.password, primary_vault)
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    token = create_session(middleware.db, user['recipient_id'])
    return {
        "user": {"recipient_id": user['recipient_id'], "name": user['name'], "role": user['role']},
        "token": token
    }

@router.post("/logout")
def auth_logout(user_info: dict = Depends(middleware.get_current_user), creds = Depends(middleware.security)):
    if middleware.db and creds:
        invalidate_session(middleware.db, creds.credentials)
    return {"status": "ok"}

@router.get("/me")
def auth_me(user_info: dict = Depends(middleware.get_current_user)):
    user = middleware.db.get_identity(user_info['user_id'])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "recipient_id": user['recipient_id'],
        "name": user['name'],
        "role": user['role'],
        "unit": user['unit']
    }

@router.post("/recover-password")
def auth_recover_password(req: RecoverPasswordRequest):
    if not middleware.db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    user = middleware.db.get_identity(req.recipient_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        ph.verify(user['recovery_key_hash'], req.recovery_key)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid recovery key")
        
    vault_data = json.loads(user['encrypted_vault'].decode('utf-8'))
    recovery_vault = vault_data.get("recovery")
    if not recovery_vault:
        raise HTTPException(status_code=400, detail="No recovery vault available for this identity")

    try:
        priv_x, priv_pqc, priv_sig, _ = EncryptedCredentialVault.unlock_vault(req.recovery_key, recovery_vault)
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="Failed to unlock recovery vault with recovery key")

    # Re-encrypt primary vault with new password while retaining the exact same private keys
    new_primary_vault = EncryptedCredentialVault.create_vault(
        password=req.new_password,
        priv_kem_classical=priv_x,
        priv_kem_pqc=priv_pqc,
        priv_sig=priv_sig
    )
    
    updated_vault_bundle = {
        "primary": new_primary_vault,
        "recovery": recovery_vault
    }
    
    conn = middleware.db._get_connection()
    try:
        conn.execute(
            "UPDATE identities SET encrypted_vault = ? WHERE recipient_id = ?",
            (json.dumps(updated_vault_bundle).encode('utf-8'), req.recipient_id)
        )
        conn.commit()
    finally:
        conn.close()

    return {"status": "SUCCESS", "message": "Password successfully reset. You may now sign in."}

@router.post("/approve")
def auth_approve(req: ApproveRequest, user_info: dict = Depends(middleware.require_role('admin'))):
    user = middleware.db.get_identity(req.recipient_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user['role'] == 'pending':
        middleware.db.update_identity_role(req.recipient_id, 'recipient')
        system_state.sync_from_db(middleware.db)
        event_broker.publish("USER_APPROVED", {
            "recipient_id": req.recipient_id,
            "role": "recipient"
        })
    return {"status": "ok"}

@router.post("/assign-role")
def auth_assign_role(req: AssignRoleRequest, user_info: dict = Depends(middleware.require_role('admin'))):
    user = middleware.db.get_identity(req.recipient_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user['role'] == 'admin' and req.role != 'admin':
        raise HTTPException(status_code=400, detail="Cannot demote the organization administrator")
    middleware.db.update_identity_role(req.recipient_id, req.role)
    system_state.sync_from_db(middleware.db)
    event_broker.publish("ROLE_CHANGED", {
        "recipient_id": req.recipient_id,
        "role": req.role
    })
    return {"status": "ok"}

@router.post("/challenge")
def auth_challenge(req: ChallengeRequest):
    """
    Zero-Password Challenge-Response Login Step 1:
    Issues a fresh, single-use cryptographic nonce for the requested identity.
    """
    if not middleware.db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    user = middleware.db.get_identity(req.recipient_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"Identity {req.recipient_id} not found.")
    if user.get("is_revoked"):
        raise HTTPException(status_code=403, detail="Identity credentials have been revoked.")

    challenge_id = f"CHAL-{uuid.uuid4().hex[:12].upper()}"
    nonce = secrets.token_urlsafe(32)
    now = time.time()
    middleware.db.create_auth_challenge(
        challenge_id=challenge_id,
        recipient_id=user["recipient_id"],
        nonce=nonce,
        created_at=now,
        expires_at=now + 300.0  # 5 minutes validity
    )
    return {
        "challenge_id": challenge_id,
        "nonce": nonce,
        "recipient_id": user["recipient_id"]
    }

@router.post("/login-challenge")
def auth_login_challenge(req: LoginChallengeRequest):
    """
    Zero-Password Challenge-Response Login Step 2:
    Verifies the client's ML-DSA-65 post-quantum digital signature over the challenge nonce.
    Guarantees user's password and private keys never traverse the network.
    """
    if not middleware.db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    challenge = middleware.db.get_auth_challenge(req.challenge_id)
    if not challenge or challenge["expires_at"] < time.time():
        raise HTTPException(status_code=401, detail="Invalid or expired authentication challenge.")

    # Invalidate challenge immediately (single-use nonce)
    middleware.db.delete_auth_challenge(req.challenge_id)

    user = middleware.db.get_identity(req.recipient_id)
    if not user or user.get("is_revoked"):
        raise HTTPException(status_code=401, detail="Invalid credentials or account revoked.")

    # Cryptographically verify ML-DSA-65 signature on nonce
    pub_sig = user["public_key_sig"]
    if isinstance(pub_sig, memoryview):
        pub_sig = bytes(pub_sig)

    try:
        sig_bytes = base64.b64decode(req.signature_b64)
        is_valid = DigitalSignatureManager.verify(
            message_bytes=challenge["nonce"].encode("utf-8"),
            signature_bytes=sig_bytes,
            public_key_bytes=pub_sig
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Signature verification error: {str(e)}")

    if not is_valid:
        raise HTTPException(status_code=401, detail="Cryptographic challenge signature rejected.")

    if user["role"] == "pending":
        return {
            "status": "PENDING_APPROVAL",
            "message": "Account pending administrator authorization.",
            "user": {
                "recipient_id": user["recipient_id"],
                "name": user["name"],
                "role": "pending",
                "unit": user["unit"]
            },
            "token": None
        }

    token = create_session(middleware.db, user["recipient_id"])
    return {
        "status": "AUTHENTICATED",
        "user": {
            "recipient_id": user["recipient_id"],
            "name": user["name"],
            "role": user["role"],
            "unit": user["unit"]
        },
        "token": token
    }

@router.post("/register-public")
def auth_register_public(req: RegisterPublicRequest):
    """
    Sovereign Client Registration Endpoint:
    Stores ONLY public identity metadata and public keys on the central server.
    Argon2id credential vault and private keys remain exclusively on the client workstation.
    """
    if not middleware.db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    clean_id = req.recipient_id.strip()
    if middleware.db.get_identity(clean_id):
        raise HTTPException(status_code=400, detail=f"Identity {clean_id} already exists.")

    try:
        pub_kem = base64.b64decode(req.public_key_kem_b64)
        pub_sig = base64.b64decode(req.public_key_sig_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Malformed public key base64 data: {str(e)}")

    now = time.time()
    middleware.db.insert_identity(
        recipient_id=clean_id,
        name=req.name,
        unit=req.unit or "",
        role="pending",
        encrypted_vault=b"",  # Client maintains private vault sovereignty
        public_key_kem=pub_kem,
        public_key_sig=pub_sig,
        recovery_key_hash="",
        fingerprint=req.fingerprint or "",
        created_at=now,
        is_revoked=0
    )
    system_state.sync_from_db(middleware.db)

    # Broadcast realtime event so Admin dashboard updates immediately without refresh
    event_broker.publish("USER_REGISTERED", {
        "recipient_id": clean_id,
        "name": req.name,
        "unit": req.unit or "",
        "role": "pending",
        "fingerprint": req.fingerprint or "",
        "created_at": now
    })

    return {
        "status": "PENDING_APPROVAL",
        "message": "Public identity enrolled centrally. Awaiting administrator approval.",
        "user": {
            "recipient_id": clean_id,
            "name": req.name,
            "unit": req.unit or "",
            "role": "pending"
        }
    }

@router.post("/sync-admin-vault")
def auth_sync_admin_vault(req: SyncAdminVaultRequest):
    """
    Administrative Synchronization Endpoint:
    Synchronizes the organization administrator's Argon2id protected credential vault
    and post-quantum public keys between connected enclaves.
    """
    if not middleware.db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    if req.recipient_id.strip().upper() != "USER-MIQDAAD_SAYYED":
        raise HTTPException(status_code=403, detail="Only organization admin vault can be synchronized")

    try:
        vault_bytes = base64.b64decode(req.encrypted_vault_b64)
        kem_bytes = base64.b64decode(req.public_key_kem_b64)
        sig_bytes = base64.b64decode(req.public_key_sig_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Base64 decoding error: {str(e)}")

    middleware.db.insert_identity(
        recipient_id=req.recipient_id.strip(),
        name=req.name.strip(),
        unit=req.unit.strip(),
        role="admin",
        encrypted_vault=vault_bytes,
        public_key_kem=kem_bytes,
        public_key_sig=sig_bytes,
        recovery_key_hash=req.recovery_key_hash.strip(),
        fingerprint="",
        created_at=time.time(),
        is_revoked=0
    )
    middleware.db.set_config('setup_complete', 'true')
    system_state.sync_from_db(middleware.db)

    # Broadcast event so all connected dashboard listeners refresh identity cache
    event_broker.publish("ROLE_CHANGED", {
        "recipient_id": req.recipient_id.strip(),
        "role": "admin"
    })

    return {
        "status": "SUCCESS",
        "message": "Administrator vault synchronized successfully across enclaves."
    }

@router.get("/events")
async def sse_events():
    """
    Server-Sent Events (SSE) stream for real-time connected dashboard updates.
    Delivers instant notifications on user registrations, approvals, and ledger commits.
    """
    return StreamingResponse(
        event_broker.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/events/poll")
def poll_events(since: float = 0.0):
    """
    Short-interval polling fallback for environments where persistent SSE is interrupted.
    """
    return {"events": event_broker.get_recent_events(since=since)}

