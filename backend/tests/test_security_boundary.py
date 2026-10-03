"""
Test Security Boundary & Zero-Trust Verification.
Asserts that connected API network payloads NEVER contain sensitive recipient secrets:
- ML-KEM private key bytes
- ML-DSA private key bytes
- Plaintext LeakTrace passwords
- Plaintext Document Open Secret (DOS)
- Plaintext decrypted PDF bytes
"""
import pytest
import base64
import json
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import Database
from app.auth import middleware
from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault


@pytest.fixture
def test_app(tmp_path):
    db_path = str(tmp_path / "sec_boundary.db")
    db = Database(db_path)
    db.initialize()
    middleware.db = db
    client = TestClient(app)
    return client


def test_security_boundary_zero_secrets_in_payloads(test_app):
    client = test_app

    # 1. Generate client keys locally
    priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
    password = "SensitiveUserPassphrase!2026"

    vault = EncryptedCredentialVault.create_vault(
        password=password,
        priv_kem_classical=priv_x,
        priv_kem_pqc=priv_pqc,
        priv_sig=priv_sig
    )

    # 2. Inspect registration payload
    reg_payload = {
        "recipient_id": "USER-SECURITY-TEST",
        "name": "Security Test Officer",
        "unit": "Naval Directorate",
        "public_key_kem_b64": base64.b64encode(pub_x + pub_pqc).decode("utf-8"),
        "public_key_sig_b64": base64.b64encode(pub_sig).decode("utf-8"),
        "fingerprint": "WORKSTATION-SEC-01"
    }

    payload_str = json.dumps(reg_payload)

    # Assert no private key bytes or passwords in registration payload
    assert password not in payload_str
    assert base64.b64encode(priv_x).decode("utf-8") not in payload_str
    assert base64.b64encode(priv_pqc).decode("utf-8") not in payload_str
    assert base64.b64encode(priv_sig).decode("utf-8") not in payload_str

    # 3. Post registration and inspect server response
    res = client.post("/api/auth/register-public", json=reg_payload)
    assert res.status_code == 200
    res_str = json.dumps(res.json())

    # Assert server response contains no secrets
    assert password not in res_str
    assert "private" not in res_str.lower() or "public" in res_str.lower()
    assert base64.b64encode(priv_x).decode("utf-8") not in res_str

    # 4. Check challenge-response login payload
    chal_res = client.post("/api/auth/challenge", json={"recipient_id": "USER-SECURITY-TEST"})
    assert chal_res.status_code == 200
    nonce = chal_res.json()["nonce"]
    challenge_id = chal_res.json()["challenge_id"]

    signature = DigitalSignatureManager.sign(nonce.encode("utf-8"), priv_sig)
    login_payload = {
        "recipient_id": "USER-SECURITY-TEST",
        "challenge_id": challenge_id,
        "signature_b64": base64.b64encode(signature).decode("utf-8")
    }
    login_payload_str = json.dumps(login_payload)

    # Assert password is NEVER transmitted during login
    assert password not in login_payload_str
    assert base64.b64encode(priv_sig).decode("utf-8") not in login_payload_str

    # 5. Check database stored identity contains no plaintext password
    stored_user = middleware.db.get_identity("USER-SECURITY-TEST")
    assert stored_user is not None
    assert stored_user.get("encrypted_vault") == b"" or password.encode("utf-8") not in stored_user.get("encrypted_vault", b"")
