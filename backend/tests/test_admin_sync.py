import pytest
import base64
import json
import time
from fastapi.testclient import TestClient

from app.main import app
from app.auth import middleware

@pytest.fixture
def client():
    return TestClient(app)

def test_sync_admin_vault_forbidden_non_admin(client):
    res = client.post("/api/auth/sync-admin-vault", json={
        "recipient_id": "USER-IMPOSTER",
        "name": "Imposter",
        "unit": "Bad Unit",
        "encrypted_vault_b64": base64.b64encode(b"vault").decode("utf-8"),
        "public_key_kem_b64": base64.b64encode(b"kem").decode("utf-8"),
        "public_key_sig_b64": base64.b64encode(b"sig").decode("utf-8"),
        "recovery_key_hash": "hash"
    })
    assert res.status_code == 403

def test_sync_admin_vault_success(client):
    test_vault = json.dumps({"test": "data"}).encode("utf-8")
    test_kem = b"A" * 1216
    test_sig = b"B" * 1952
    
    res = client.post("/api/auth/sync-admin-vault", json={
        "recipient_id": "USER-MIQDAAD_SAYYED",
        "name": "Miqdaad Sayyed",
        "unit": "WESEE Naval Directorate",
        "encrypted_vault_b64": base64.b64encode(test_vault).decode("utf-8"),
        "public_key_kem_b64": base64.b64encode(test_kem).decode("utf-8"),
        "public_key_sig_b64": base64.b64encode(test_sig).decode("utf-8"),
        "recovery_key_hash": "$argon2id$test_hash"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "SUCCESS"
    
    # Verify in DB
    user = middleware.db.get_identity("USER-MIQDAAD_SAYYED")
    assert user is not None
    assert user["role"] == "admin"
    assert user["name"] == "Miqdaad Sayyed"
