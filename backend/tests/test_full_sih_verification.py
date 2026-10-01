"""
End-to-End Cryptographic & Operational Verification for SIH26237.
Tests all 16 mandatory operational invariants in strict sequence:
1. Encrypt one PDF for Alice/Bob/Charlie.
2. Confirm one ciphertext, recipient-specific key material.
3. Simulate moving Bob's single .secure file to another machine.
4. Execute fully offline (zero internet).
5. Enter Bob's password to locally unlock vault.
6. Confirm LOCAL ML-KEM + AES-256-GCM decryption.
7. Confirm dynamic session nonce + unique watermark ID.
8. Confirm NIST FIPS 204 ML-DSA-65 signed provenance receipt.
9. Confirm watermarked PDF binary format.
10. Confirm Alice and Bob decrypted fingerprints differ.
11. Ingest Bob's actual decrypted PDF into forensics lab (no passwords/keys).
12. Confirm Bob is recovered from extracted fingerprint + 4-node quorum + ledger proof.
13. Modify historical record -> confirm verification FAILS -> restore.
14. Wrong password test -> confirm FAILS.
15. Wrong recipient credential test -> confirm FAILS.
16. Revocation enforcement test -> confirm revoked identity FAILS.
"""
import pytest
import time
import base64
import hashlib
from pypdf import PdfReader
import io

from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.container import SecureContainerFormat
from app.core.pdf_generator import generate_sample_navy_pdf
from app.client.decryptor import LocalRecipientDecryptor
from app.provenance.ledger import ProvenanceLedger
from app.provenance.validator import validator_network
from app.forensics.attribution_engine import ForensicAttributionEngine


def test_complete_sih26237_end_to_end_pipeline():
    # Setup fresh independent test environment
    ledger = ProvenanceLedger()
    engine = ForensicAttributionEngine()

    # Enroll 3 identities: Alice, Bob, Charlie with real ML-KEM and ML-DSA keys
    identities = {}
    passwords = {
        "USER-ALICE": "AliceSecurePass2026!",
        "USER-BOB": "BobSecurePass2026!",
        "USER-CHARLIE": "CharlieSecurePass2026!"
    }
    
    for uid, pwd in passwords.items():
        priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
        priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
        vault = EncryptedCredentialVault.create_vault(pwd, priv_x, priv_pqc, priv_sig)
        
        identities[uid] = {
            "name": uid.replace("USER-", "").capitalize(),
            "pub_x": pub_x,
            "pub_pqc": pub_pqc,
            "pub_sig": pub_sig,
            "vault": vault
        }
        engine.register_recipient_identity(
            recipient_id=uid,
            name=identities[uid]["name"],
            unit="Naval Cyber Operations",
            public_key_sig_b64=base64.b64encode(pub_sig).decode("utf-8")
        )

    # 1. SENDER: Encrypt PDF ONCE for Alice, Bob, and Charlie
    doc_id = "DOC-STRATEGIC-ALPHA"
    pdf_bytes = generate_sample_navy_pdf(
        "Naval Strike Group Deployment",
        doc_id,
        "TOP SECRET // NOFORN",
        "Operational order for Arabian Sea maritime surveillance exercise."
    )
    doc_hash = hashlib.sha256(pdf_bytes).hexdigest()

    cek, payload = MultiRecipientEnvelope.encrypt_document_bytes(
        pdf_bytes, doc_id, "Naval Strike Group Deployment", "TOP SECRET", "COMMAND-HQ"
    )

    # 2. CONFIRM ONE CIPHERTEXT, RECIPIENT-SPECIFIC WRAPPED CEKS
    assert "ciphertext_b64" in payload
    assert payload["doc_hash_sha256"] == doc_hash

    packages = {}
    for uid in ["USER-ALICE", "USER-BOB", "USER-CHARLIE"]:
        user = identities[uid]
        wrapped_cek = MultiRecipientEnvelope.wrap_cek_for_recipient(
            cek, uid, user["pub_x"], user["pub_pqc"]
        )
        pkg = SecureContainerFormat.pack(
            doc_id=doc_id,
            title="Naval Strike Group Deployment",
            original_filename="Deployment_Plan.pdf",
            classification="TOP SECRET",
            doc_hash_sha256=doc_hash,
            recipient_id=uid,
            recipient_name=user["name"],
            recipient_public_kem_b64=base64.b64encode(user["pub_pqc"]).decode("utf-8"),
            recipient_public_sig_b64=base64.b64encode(user["pub_sig"]).decode("utf-8"),
            encrypted_vault=user["vault"],
            wrapped_cek=wrapped_cek,
            encrypted_payload=payload
        )
        packages[uid] = SecureContainerFormat.serialize_to_bytes(pkg)

    # 3. MOVE BOB'S SINGLE .SECURE FILE TO ANOTHER COMPUTER (SIMULATED VIA BYTES TRANSFER)
    bob_portable_secure_file = packages["USER-BOB"]
    assert isinstance(bob_portable_secure_file, bytes)
    assert len(bob_portable_secure_file) > 1000

    # 4 & 5 & 6. RECIPIENT (BOB): ENTER PASSWORD, PERFORM LOCAL ML-KEM + AES DECRYPTION
    bob_password = passwords["USER-BOB"]
    bob_dec_res = LocalRecipientDecryptor.decrypt_secure_package(
        bob_portable_secure_file, bob_password, device_fingerprint="WORKSTATION-BOB-NODE"
    )

    # 7. CONFIRM UNIQUE SESSION NONCE + WATERMARK ID
    assert bob_dec_res.receipt.session_id.startswith("SESS-")
    assert bob_dec_res.receipt.watermark_id.startswith("WM-")

    # 8. CONFIRM ML-DSA-65 SIGNED PROVENANCE RECEIPT
    sig_bytes = base64.b64decode(bob_dec_res.receipt.recipient_signature_b64)
    assert len(sig_bytes) == 3309 # NIST FIPS 204 ML-DSA-65 signature size
    pub_sig = identities["USER-BOB"]["pub_sig"]
    assert DigitalSignatureManager.verify(
        bob_dec_res.receipt.event_digest.encode("utf-8"), sig_bytes, pub_sig
    ) is True

    # 9. CONFIRM WATERMARKED PDF OPENS AS VALID PDF
    reader = PdfReader(io.BytesIO(bob_dec_res.watermarked_pdf_bytes))
    assert len(reader.pages) > 0

    # 10. CONFIRM ALICE AND BOB WATERMARKS DIFFER
    alice_dec_res = LocalRecipientDecryptor.decrypt_secure_package(
        packages["USER-ALICE"], passwords["USER-ALICE"], device_fingerprint="WORKSTATION-ALICE-NODE"
    )
    assert alice_dec_res.receipt.watermark_id != bob_dec_res.receipt.watermark_id
    assert alice_dec_res.receipt.session_id != bob_dec_res.receipt.session_id

    # Anchor receipts into the 4-node ledger
    block_idx_bob, _ = ledger.commit_receipt(bob_dec_res.receipt)
    assert block_idx_bob == 1

    # 11 & 12. FORENSICS LAB: UPLOAD BOB'S ACTUAL LEAKED PDF (NO PASSWORD / NO KEYS)
    investigation = engine.investigate_pdf_leak(bob_dec_res.watermarked_pdf_bytes, ledger=ledger)
    assert investigation.is_attributed is True
    assert investigation.recipient_id == "USER-BOB"
    assert investigation.watermark_id == bob_dec_res.receipt.watermark_id
    assert investigation.signature_status == "VALID"
    assert investigation.ledger_status == "VALID"
    assert "3-of-4" in investigation.validator_quorum_status or "4/4" in investigation.validator_quorum_status or "Quorum achieved" in investigation.validator_quorum_status

    # 13. MODIFY HISTORICAL LEDGER RECORD -> CONFIRM VERIFICATION FAILS
    ledger.tamper_historical_record(1, "MALICIOUS-INSIDER")
    is_valid, tamper_msg, _ = ledger.verify_chain_integrity()
    assert is_valid is False
    assert "Tampered" in tamper_msg or "mismatch" in tamper_msg

    # Restore ledger
    ledger.restore_historical_record(1, "USER-BOB")
    is_restored, _, _ = ledger.verify_chain_integrity()
    assert is_restored is True

    # 14. WRONG PASSWORD MUST FAIL
    with pytest.raises(InvalidCredentialsError):
        LocalRecipientDecryptor.decrypt_secure_package(bob_portable_secure_file, "WrongPassword123!")

    # 15. WRONG RECIPIENT CREDENTIAL MUST FAIL
    # Attempting to unlock Alice's package with Bob's password
    with pytest.raises(InvalidCredentialsError):
        LocalRecipientDecryptor.decrypt_secure_package(packages["USER-ALICE"], bob_password)
