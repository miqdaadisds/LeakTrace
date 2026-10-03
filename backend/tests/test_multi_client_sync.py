"""
Comprehensive Multi-Client Synchronization & End-to-End Verification Test.
Simulates two completely independent client workstations (Client A: Admin/Sender and Client B: Recipient)
communicating exclusively through ONE central LeakTrace backend enclave.

Flow:
1. Client B registers sovereign post-quantum identity (ML-KEM-768 + ML-DSA-65).
2. Client A receives live registration event from Central Event Broker.
3. Client A approves B and assigns recipient role.
4. Client B receives live approval event.
5. Client A retrieves B's public identity from central backend.
6. Client A encrypts ONE genuine protected PDF containing B's KEM slot.
7. Client B downloads the EXACT SAME protected PDF from central backend (asserts hash equality).
8. Client B unlocks local vault with password, recovers Document Open Secret via ML-KEM,
   injects dynamic forensic watermark, and signs DecryptionProvenanceReceipt locally with ML-DSA-65.
9. Client B submits signed receipt to central backend.
10. Backend cryptographically verifies signature and commits block to central ledger.
11. Client A receives live PROVENANCE_COMMITTED event.
12. Forensic investigation correctly attributes watermark to Client B.
13. Negative tests: wrong password rejected, tampered receipt rejected.
"""
import os
import json
import time
import base64
import hashlib
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import Database
from app.auth import middleware
from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector
from app.core.pdf_generator import generate_sample_navy_pdf
from app.client.decryptor import LocalRecipientDecryptor
from app.provenance.ledger import provenance_ledger
from app.core.events import event_broker
from app.forensics.attribution_engine import forensic_engine

@pytest.fixture
def central_client(tmp_path):
    # Setup clean shared central database
    shared_db_path = str(tmp_path / "central_enclave.db")
    shared_db = Database(shared_db_path)
    shared_db.initialize()
    middleware.db = shared_db
    provenance_ledger.db = shared_db
    
    test_client = TestClient(app)
    yield test_client

    if os.path.exists(shared_db_path):
        try:
            os.remove(shared_db_path)
        except Exception:
            pass


def test_complete_two_client_connected_lifecycle(central_client):
    client = central_client

    # =========================================================================
    # STEP 0: Bootstrap Central Enclave Administrator (Client A / Sayed)
    # =========================================================================
    setup_res = client.post("/api/auth/setup", json={
        "name": "Miqdaad Sayyed",
        "unit": "WESEE Naval Command",
        "password": "AdminSecurePassword2026!"
    })
    assert setup_res.status_code == 200, setup_res.text
    admin_token = setup_res.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_id = setup_res.json()["user"]["recipient_id"]

    # Verify admin status
    status_res = client.get("/api/auth/status", headers=admin_headers)
    assert status_res.json()["authenticated"] is True
    assert status_res.json()["user"]["role"] == "admin"

    # =========================================================================
    # STEP 1: Client B (Friend / Annam Kazi) Generates Local Sovereignty Keypairs
    # =========================================================================
    friend_recipient_id = "USER-ANNAM_KAZI"
    friend_name = "Annam Kazi"
    friend_unit = "Naval Communications"
    friend_password = "FriendPass2026!Strong"

    # Generate ML-KEM-768 and ML-DSA-65 keys strictly on Client B's workstation
    b_priv_x, b_pub_x, b_priv_pqc, b_pub_pqc = HybridPQCKEM.generate_keypair()
    b_public_kem = b_pub_x + b_pub_pqc
    b_priv_sig, b_pub_sig = DigitalSignatureManager.generate_keypair()

    # Client B locks private keys in local Argon2id credential vault
    b_local_vault = EncryptedCredentialVault.create_vault(
        password=friend_password,
        priv_kem_classical=b_priv_x,
        priv_kem_pqc=b_priv_pqc,
        priv_sig=b_priv_sig
    )

    # Client B sends ONLY public registration data to Central Backend
    b_pub_kem_b64 = base64.b64encode(b_public_kem).decode("utf-8")
    b_pub_sig_b64 = base64.b64encode(b_pub_sig).decode("utf-8")

    register_res = client.post("/api/auth/register-public", json={
        "recipient_id": friend_recipient_id,
        "name": friend_name,
        "unit": friend_unit,
        "public_key_kem_b64": b_pub_kem_b64,
        "public_key_sig_b64": b_pub_sig_b64,
        "fingerprint": "WORKSTATION-ANNAM-LAPTOP-B"
    })
    assert register_res.status_code == 200, register_res.text
    assert register_res.json()["status"] == "PENDING_APPROVAL"
    assert register_res.json()["user"]["role"] == "pending"

    # =========================================================================
    # STEP 2: Client A Receives Live Realtime Notification & Approves Friend
    # =========================================================================
    recent_events = client.get("/api/events/poll?since=0").json()["events"]
    reg_events = [e for e in recent_events if e["event_type"] == "USER_REGISTERED"]
    assert len(reg_events) > 0
    assert reg_events[-1]["data"]["recipient_id"] == friend_recipient_id

    # Admin (Client A) approves Friend and assigns Recipient role
    approve_res = client.post("/api/auth/approve", json={"recipient_id": friend_recipient_id}, headers=admin_headers)
    assert approve_res.status_code == 200

    # Verify live USER_APPROVED event
    events_after_app = client.get(f"/api/events/poll?since={reg_events[-1]['timestamp']}").json()["events"]
    app_events = [e for e in events_after_app if e["event_type"] == "USER_APPROVED"]
    assert len(app_events) > 0
    assert app_events[-1]["data"]["recipient_id"] == friend_recipient_id

    # =========================================================================
    # STEP 3: Client B Authenticates Using Zero-Password Challenge-Response
    # =========================================================================
    # 3.1 Client B requests challenge from central backend
    chal_res = client.post("/api/auth/challenge", json={"recipient_id": friend_recipient_id})
    assert chal_res.status_code == 200
    challenge_id = chal_res.json()["challenge_id"]
    nonce = chal_res.json()["nonce"]

    # 3.2 Client B unlocks local vault with password & signs nonce with ML-DSA-65
    b_unlocked_priv_x, b_unlocked_priv_pqc, b_unlocked_priv_sig, _ = EncryptedCredentialVault.unlock_vault(
        friend_password, b_local_vault
    )
    b_nonce_signature = DigitalSignatureManager.sign(nonce.encode("utf-8"), b_unlocked_priv_sig)
    b_sig_b64 = base64.b64encode(b_nonce_signature).decode("utf-8")

    # 3.3 Client B sends signature to backend (password never traverses network!)
    login_chal_res = client.post("/api/auth/login-challenge", json={
        "recipient_id": friend_recipient_id,
        "challenge_id": challenge_id,
        "signature_b64": b_sig_b64
    })
    assert login_chal_res.status_code == 200, login_chal_res.text
    assert login_chal_res.json()["status"] == "AUTHENTICATED"
    friend_token = login_chal_res.json()["token"]
    assert friend_token is not None
    friend_headers = {"Authorization": f"Bearer {friend_token}"}

    # =========================================================================
    # STEP 4: Client A (Sender) Encrypts ONE Genuine PDF for Authorized Friend
    # =========================================================================
    raw_pdf_bytes = generate_sample_navy_pdf(
        title="Operation Trishul Strategic Plan",
        doc_id="DOC-TRISHUL-01",
        classification="RESTRICTED // NAVAL DEFENCE",
        directive_body="Strategic operational mandate for naval units. Top secret distribution."
    )
    assert raw_pdf_bytes.startswith(b"%PDF")
    raw_pdf_hash = hashlib.sha256(raw_pdf_bytes).hexdigest()

    # Client A retrieves approved recipients list from central backend
    identities_res = client.get("/api/identities", headers=admin_headers)
    assert identities_res.status_code == 200
    all_identities = identities_res.json()
    assert any(i["recipient_id"] == friend_recipient_id for i in all_identities)

    # Client A protects document for Friend via central distribution endpoint
    protect_res = client.post("/api/distribution/protect", data={
        "title": "Operation Trishul Strategic Plan",
        "classification": "RESTRICTED // NAVAL DEFENCE",
        "recipient_ids": friend_recipient_id,
        "content_body": "Strategic operational mandate for naval units."
    })
    assert protect_res.status_code == 200, protect_res.text
    doc_id = protect_res.json()["doc_id"]
    download_url = protect_res.json()["download_url"]

    # =========================================================================
    # STEP 5: Both Client A and Client B Download the EXACT SAME Protected File
    # =========================================================================
    dl_a = client.get(download_url)
    assert dl_a.status_code == 200
    pdf_bytes_a = dl_a.content

    dl_b = client.get(download_url, headers=friend_headers)
    assert dl_b.status_code == 200
    pdf_bytes_b = dl_b.content

    # Assert exact binary identity: O(1) single shared protected PDF
    assert hashlib.sha256(pdf_bytes_a).hexdigest() == hashlib.sha256(pdf_bytes_b).hexdigest()
    assert pdf_bytes_b.startswith(b"%PDF")

    # Assert standard PDF viewers see encrypted payload
    slots = PdfProtector.read_slots(pdf_bytes_b)
    assert slots is not None
    assert any(s["recipient_id"] == friend_recipient_id for s in slots["recipients"])

    # =========================================================================
    # STEP 6: Client B Performs Local Decryption with Password
    # =========================================================================
    dec_result = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected_pdf_bytes=pdf_bytes_b,
        recipient_id=friend_recipient_id,
        password=friend_password,
        encrypted_vault=b_local_vault,
        public_key_sig_b64=b_pub_sig_b64,
        device_fingerprint="WORKSTATION-ANNAM-SECURE-ENCLAVE"
    )
    assert dec_result.watermarked_pdf_bytes.startswith(b"%PDF")
    watermark_id = dec_result.receipt.watermark_id
    receipt = dec_result.receipt

    # =========================================================================
    # STEP 7: Client B Submits Signed Provenance Receipt to Central Backend
    # =========================================================================
    submit_res = client.post("/api/recipient/submit-provenance-receipt", json=receipt.model_dump())
    assert submit_res.status_code == 200, submit_res.text
    assert submit_res.json()["status"] == "RECEIPT_ANCHORED"
    block_index = submit_res.json()["block_index"]
    assert block_index > 0

    # =========================================================================
    # STEP 8: Central Blockchain Verification & Quorum Confirmation
    # =========================================================================
    is_valid, msg, audit_trail = provenance_ledger.verify_chain_integrity()
    assert is_valid is True, msg
    assert provenance_ledger.block_count() >= 2

    # Check live PROVENANCE_COMMITTED event reached Client A
    recent_after_dec = client.get("/api/events/poll?since=0").json()["events"]
    prov_events = [e for e in recent_after_dec if e["event_type"] == "PROVENANCE_COMMITTED"]
    assert len(prov_events) > 0
    assert prov_events[-1]["data"]["watermark_id"] == watermark_id

    # =========================================================================
    # STEP 9: Forensics Investigation Attribution
    # =========================================================================
    # Investigator analyzes leaked watermarked PDF
    analysis_res = forensic_engine.investigate_pdf_leak(dec_result.watermarked_pdf_bytes, ledger=provenance_ledger)
    assert analysis_res.is_attributed is True
    assert analysis_res.recipient_id == friend_recipient_id
    assert analysis_res.watermark_id == watermark_id
    assert analysis_res.ledger_status == "VALID"
    assert analysis_res.signature_status == "VALID"

    # =========================================================================
    # STEP 10: Negative Security Tests (Zero-Trust Enforcement)
    # =========================================================================
    # 10.1 Wrong password fails local decryption
    with pytest.raises(Exception):
        LocalRecipientDecryptor.decrypt_protected_pdf(
            protected_pdf_bytes=pdf_bytes_b,
            recipient_id=friend_recipient_id,
            password="WrongPassword123!",
            encrypted_vault=b_local_vault,
            public_key_sig_b64=b_pub_sig_b64
        )

    # 10.2 Tampered receipt signature rejected by central backend
    tampered_receipt = receipt.model_dump()
    tampered_receipt["recipient_signature_b64"] = base64.b64encode(b"FORGED_SIGNATURE_BYTES").decode("utf-8")
    tampered_res = client.post("/api/recipient/submit-provenance-receipt", json=tampered_receipt)
    assert tampered_res.status_code == 403
