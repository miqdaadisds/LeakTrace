import time
import secrets
import uuid
import json
from fastapi import APIRouter, HTTPException, Depends
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
except ImportError:
    from backend.app.auth.session_manager import create_session, invalidate_session, validate_session
    from backend.app.auth import middleware
    from backend.app.crypto.pqc_kem import HybridPQCKEM
    from backend.app.crypto.pqc_sig import DigitalSignatureManager
    from backend.app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
    from backend.app.core.state import system_state

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

@router.get("/status")
def auth_status(credentials: Optional[HTTPAuthorizationCredentials] = Depends(middleware.security)):
    if not middleware.db:
        return {"setup_complete": True, "authenticated": False, "user": None}
    setup_complete = middleware.db.is_setup_complete()
    if credentials:
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
    return {"status": "ok"}
