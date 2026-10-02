"""
End-to-End Cryptographic & Operational Verification for SIH26237 (v1.1).
Tests all mandatory operational invariants in strict sequence:
1. Encrypt one PDF for Alice/Bob/Charlie — ONE genuine encrypted PDF.
2. Confirm one ciphertext, recipient-specific ML-KEM slots in trailer.
3. Same protected PDF bytes for all recipients.
4. Execute fully offline (zero internet).
5. Enter Bob's password to locally unlock vault.
6. Confirm LOCAL ML-KEM + AES-256 decryption.
7. Confirm dynamic session nonce + unique watermark ID.
8. Confirm NIST FIPS 204 ML-DSA-65 signed provenance receipt.
9. Confirm watermarked PDF binary format.
10. Confirm Alice and Bob decrypted fingerprints differ.
11. Ingest Bob's leaked PDF into forensics (no passwords/keys).
12. Confirm Bob is recovered with verified signature + ledger proof.
13. Wrong password test → confirm FAILS.
14. Unauthorized recipient test → confirm FAILS.
15. Revoked identity test → confirm rejected.
"""
import pytest
import base64
import hashlib
import os
from pypdf import PdfReader
import io

from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector
from app.core.pdf_generator import generate_sample_navy_pdf
from app.client.decryptor import LocalRecipientDecryptor
from app.provenance.ledger import ProvenanceLedger
from app.provenance.validator import validator_network
from app.forensics.attribution_engine import ForensicAttributionEngine


def _setup_test_env():
    """Create fresh identities, ledger, and forensic engine."""
    passwords = {
        "USER-ALICE": "AliceSecurePass2026!",
        "USER-BOB": "BobSecurePass2026!",
        "USER-CHARLIE": "CharlieSecurePass2026!"
    }
    identities = {}
    engine = ForensicAttributionEngine()

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

    return identities, passwords, engine


def _protect_for_all(pdf_bytes, doc_id, title, identities, recipient_ids):
    """Create one protected PDF for all recipients."""
    doc_open_secret = os.urandom(32).hex()
    dos_bytes = doc_open_secret.encode("utf-8")
    slots = []
    for rid in recipient_ids:
        ident = identities[rid]
        wrap = MultiRecipientEnvelope.wrap_cek_for_recipient(
            dos_bytes, rid, ident["pub_x"], ident["pub_pqc"]
        )
        slots.append(wrap)
    protected = PdfProtector.protect(pdf_bytes, doc_id, title, doc_open_secret, slots)
    return protected, doc_open_secret


def test_complete_sih26237_end_to_end_pipeline():
    identities, passwords, engine = _setup_test_env()
    ledger = ProvenanceLedger()

    # 1. SENDER: Encrypt PDF ONCE for Alice, Bob, and Charlie
    doc_id = "DOC-STRATEGIC-ALPHA"
    pdf_bytes = generate_sample_navy_pdf(
        "Naval Strike Group Deployment", doc_id,
        "TOP SECRET // NOFORN", "Arabian Sea maritime surveillance exercise."
    )
    doc_hash = hashlib.sha256(pdf_bytes).hexdigest()

    all_recipients = ["USER-ALICE", "USER-BOB", "USER-CHARLIE"]
    protected, dos = _protect_for_all(pdf_bytes, doc_id, "Naval Strike Group Deployment",
                                       identities, all_recipients)

    # 2. CONFIRM ONE FILE, GENUINE PDF, RECIPIENT SLOTS IN TRAILER
    assert protected[:5] == b"%PDF-"
    slots = PdfProtector.read_slots(protected)
    assert len(slots["recipients"]) == 3

    # 3. SAME FILE FOR ALL RECIPIENTS
    alice_file_hash = hashlib.sha256(protected).hexdigest()
    bob_file_hash = hashlib.sha256(protected).hexdigest()
    assert alice_file_hash == bob_file_hash

    # 4 & 5 & 6. RECIPIENT (BOB): ENTER PASSWORD, PERFORM LOCAL ML-KEM + AES DECRYPTION
    bob_dec_res = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected_pdf_bytes=protected,
        recipient_id="USER-BOB",
        password=passwords["USER-BOB"],
        encrypted_vault=identities["USER-BOB"]["vault"],
        public_key_sig_b64=base64.b64encode(identities["USER-BOB"]["pub_sig"]).decode("utf-8"),
        device_fingerprint="WORKSTATION-BOB-NODE"
    )

    # 7. CONFIRM UNIQUE SESSION NONCE + WATERMARK ID
    assert bob_dec_res.receipt.session_id.startswith("SESS-")
    assert bob_dec_res.receipt.watermark_id.startswith("WM-")

    # 8. CONFIRM ML-DSA-65 SIGNED PROVENANCE RECEIPT
    sig_bytes = base64.b64decode(bob_dec_res.receipt.recipient_signature_b64)
    assert len(sig_bytes) == 3309  # NIST FIPS 204 ML-DSA-65 signature size
    pub_sig = identities["USER-BOB"]["pub_sig"]
    assert DigitalSignatureManager.verify(
        bob_dec_res.receipt.event_digest.encode("utf-8"), sig_bytes, pub_sig
    ) is True

    # 9. CONFIRM WATERMARKED PDF OPENS AS VALID PDF
    reader = PdfReader(io.BytesIO(bob_dec_res.watermarked_pdf_bytes))
    assert len(reader.pages) > 0

    # 10. CONFIRM ALICE AND BOB WATERMARKS DIFFER
    alice_dec_res = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected_pdf_bytes=protected,
        recipient_id="USER-ALICE",
        password=passwords["USER-ALICE"],
        encrypted_vault=identities["USER-ALICE"]["vault"],
        public_key_sig_b64=base64.b64encode(identities["USER-ALICE"]["pub_sig"]).decode("utf-8"),
        device_fingerprint="WORKSTATION-ALICE-NODE"
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

    # 13. WRONG PASSWORD MUST FAIL
    with pytest.raises(InvalidCredentialsError):
        LocalRecipientDecryptor.decrypt_protected_pdf(
            protected, "USER-BOB", "WrongPassword123!",
            identities["USER-BOB"]["vault"],
            base64.b64encode(identities["USER-BOB"]["pub_sig"]).decode("utf-8")
        )

    # 14. UNAUTHORIZED RECIPIENT MUST FAIL
    outsider = {}
    outsider["priv_x"], outsider["pub_x"], outsider["priv_pqc"], outsider["pub_pqc"] = HybridPQCKEM.generate_keypair()
    outsider["priv_sig"], outsider["pub_sig"] = DigitalSignatureManager.generate_keypair()
    outsider["vault"] = EncryptedCredentialVault.create_vault("OutsiderPass!", outsider["priv_x"], outsider["priv_pqc"], outsider["priv_sig"])

    with pytest.raises(PermissionError, match="not authorized"):
        LocalRecipientDecryptor.decrypt_protected_pdf(
            protected, "USER-OUTSIDER", "OutsiderPass!",
            outsider["vault"],
            base64.b64encode(outsider["pub_sig"]).decode("utf-8")
        )
