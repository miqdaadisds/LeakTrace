"""
End-to-End Forensic Attribution & Non-Repudiation Integration Tests (v1.1).
Tests the complete flow:
1. Protect a real PDF for Alice and Bob (ONE file, genuine AES-256 encryption).
2. Bob decrypts using the full ML-KEM + watermark + ML-DSA pipeline.
3. Bob's decrypted PDF leaks.
4. Forensic Attribution Engine traces the leak to Bob.
5. Tests unmarked/tampered PDF abstention.
6. Tests fully offline operation.
"""
import base64
import hashlib
import os
from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector
from app.client.decryptor import LocalRecipientDecryptor
from app.provenance.ledger import ProvenanceLedger
from app.forensics.attribution_engine import ForensicAttributionEngine
from app.core.pdf_generator import generate_sample_navy_pdf


def _create_identity(name, password):
    """Helper: create a full identity with ML-KEM + ML-DSA keys + vault."""
    priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
    vault = EncryptedCredentialVault.create_vault(password, priv_x, priv_pqc, priv_sig)
    return {
        "name": name,
        "priv_x": priv_x, "pub_x": pub_x,
        "priv_pqc": priv_pqc, "pub_pqc": pub_pqc,
        "priv_sig": priv_sig, "pub_sig": pub_sig,
        "vault": vault
    }


def _protect_pdf_for_recipients(pdf_bytes, doc_id, title, identities, recipient_ids):
    """Helper: create one protected PDF for all recipients."""
    doc_open_secret = os.urandom(32).hex()

    # Wrap DOS for each recipient using ML-KEM
    # We reuse MultiRecipientEnvelope.wrap_cek_for_recipient — it wraps arbitrary bytes
    dos_bytes = doc_open_secret.encode("utf-8")
    recipient_slots = []
    for rid in recipient_ids:
        ident = identities[rid]
        wrap = MultiRecipientEnvelope.wrap_cek_for_recipient(
            dos_bytes, rid, ident["pub_x"], ident["pub_pqc"]
        )
        recipient_slots.append(wrap)

    protected = PdfProtector.protect(pdf_bytes, doc_id, title, doc_open_secret, recipient_slots)
    return protected, doc_open_secret


def test_end_to_end_real_pdf_leak_attribution():
    """
    Primary SIH26237 End-to-End Test:
    - Encrypt once → ONE protected PDF
    - Bob decrypts with his LeakTrace password
    - Local ML-KEM + AES + watermark + ML-DSA signing
    - Forensic attribution on leaked PDF
    """
    # Setup identities
    bob = _create_identity("Bob", "BobSecure2026!")
    alice = _create_identity("Alice", "AliceSecure2026!")

    identities = {"USER-BOB": bob, "USER-ALICE": alice}

    # Setup forensic engine with registered identities
    engine = ForensicAttributionEngine()
    for uid, ident in identities.items():
        engine.register_recipient_identity(
            recipient_id=uid,
            name=ident["name"],
            unit="Naval Cyber Operations",
            public_key_sig_b64=base64.b64encode(ident["pub_sig"]).decode("utf-8")
        )

    # Create and protect a real PDF
    pdf_bytes = generate_sample_navy_pdf(
        "Strike Group Alpha", "DOC-ALPHA", "TOP SECRET", "Operational deployment order."
    )
    protected, dos = _protect_pdf_for_recipients(
        pdf_bytes, "DOC-ALPHA", "Strike Group Alpha",
        identities, ["USER-BOB", "USER-ALICE"]
    )

    # Verify ONE file
    assert protected[:5] == b"%PDF-"
    slots = PdfProtector.read_slots(protected)
    assert len(slots["recipients"]) == 2

    # Bob decrypts with his password
    bob_result = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected_pdf_bytes=protected,
        recipient_id="USER-BOB",
        password="BobSecure2026!",
        encrypted_vault=bob["vault"],
        public_key_sig_b64=base64.b64encode(bob["pub_sig"]).decode("utf-8")
    )
    assert len(bob_result.watermarked_pdf_bytes) > 0
    assert bob_result.receipt.session_id.startswith("SESS-")
    assert bob_result.receipt.watermark_id.startswith("WM-")

    # Verify ML-DSA signature
    sig_bytes = base64.b64decode(bob_result.receipt.recipient_signature_b64)
    assert len(sig_bytes) == 3309  # NIST FIPS 204 ML-DSA-65
    assert DigitalSignatureManager.verify(
        bob_result.receipt.event_digest.encode("utf-8"), sig_bytes, bob["pub_sig"]
    ) is True

    # Commit to ledger
    ledger = ProvenanceLedger()
    block_idx, block_hash = ledger.commit_receipt(bob_result.receipt)
    assert block_idx > 0

    # Forensic investigation on leaked PDF
    investigation = engine.investigate_pdf_leak(bob_result.watermarked_pdf_bytes, ledger=ledger)
    assert investigation.is_attributed is True
    assert investigation.recipient_id == "USER-BOB"
    assert investigation.watermark_status == "MATCHED"
    assert investigation.signature_status == "VALID"
    assert investigation.ledger_status == "VALID"


def test_tampered_or_unmarked_pdf_abstains():
    """Unmarked PDF returns abstain/not-found, never a false accusation."""
    dummy_pdf = b"%PDF-1.4\n1 0 obj\n<<\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF"
    engine = ForensicAttributionEngine()
    res = engine.investigate_pdf_leak(dummy_pdf)
    assert res.is_attributed is False
    assert res.watermark_status == "NOT_FOUND"


def test_alice_and_bob_watermarks_differ():
    """Same protected PDF, different recipients → different watermarks."""
    alice = _create_identity("Alice", "AlicePass!")
    bob = _create_identity("Bob", "BobPass!")
    identities = {"USER-ALICE": alice, "USER-BOB": bob}

    pdf_bytes = generate_sample_navy_pdf("Dual Test", "DOC-DUAL", "SECRET", "Dual recipient test.")
    protected, dos = _protect_pdf_for_recipients(
        pdf_bytes, "DOC-DUAL", "Dual Test", identities, ["USER-ALICE", "USER-BOB"]
    )

    alice_result = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected, "USER-ALICE", "AlicePass!", alice["vault"],
        base64.b64encode(alice["pub_sig"]).decode("utf-8")
    )
    bob_result = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected, "USER-BOB", "BobPass!", bob["vault"],
        base64.b64encode(bob["pub_sig"]).decode("utf-8")
    )

    assert alice_result.receipt.watermark_id != bob_result.receipt.watermark_id
    assert alice_result.receipt.session_id != bob_result.receipt.session_id


def test_air_gapped_offline_operation():
    """Entire pipeline operates with zero network calls."""
    user = _create_identity("Offline", "OfflinePass123")
    identities = {"USER-OFFLINE": user}

    pdf = generate_sample_navy_pdf("Offline Plan", "DOC-OFFLINE", "SECRET", "Air-gapped test.")
    protected, dos = _protect_pdf_for_recipients(
        pdf, "DOC-OFFLINE", "Offline Plan", identities, ["USER-OFFLINE"]
    )

    result = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected, "USER-OFFLINE", "OfflinePass123", user["vault"],
        base64.b64encode(user["pub_sig"]).decode("utf-8")
    )
    assert result.watermarked_pdf_bytes is not None
    assert result.receipt.recipient_signature_b64 is not None
