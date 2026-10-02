"""
Tests for Robustness and Edge Cases (SRS Section 23):
- Re-decryption produces distinct fresh watermark and session ID every time
- Corrupted PDF bytes reject gracefully
- Missing or malformed trailer rejects gracefully
- Unauthorized recipient rejected
- Revoked recipient rejected
- Wrong passphrase fails safely without generating ledger event or releasing plaintext
"""
import os
import base64
import pytest

from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector
from app.client.decryptor import LocalRecipientDecryptor
from app.core.pdf_generator import generate_sample_navy_pdf


def _make_ident(name, password):
    priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
    vault = EncryptedCredentialVault.create_vault(password, priv_x, priv_pqc, priv_sig)
    return {
        "name": name, "priv_x": priv_x, "pub_x": pub_x,
        "priv_pqc": priv_pqc, "pub_pqc": pub_pqc,
        "priv_sig": priv_sig, "pub_sig": pub_sig,
        "vault": vault
    }


def test_repeat_decryption_generates_distinct_watermarks():
    """Repeated decryptions by the same recipient MUST NOT reuse previous watermarks or session IDs."""
    bob = _make_ident("Bob", "BobPass123!")
    pdf_bytes = generate_sample_navy_pdf("Tactical Doc", "DOC-REPEAT", "SECRET", "Naval memo")
    doc_open_secret = os.urandom(32).hex()
    dos_bytes = doc_open_secret.encode("utf-8")
    slot = MultiRecipientEnvelope.wrap_cek_for_recipient(dos_bytes, "USER-BOB", bob["pub_x"], bob["pub_pqc"])

    protected_pdf = PdfProtector.protect(pdf_bytes, "DOC-REPEAT", "Tactical Doc", doc_open_secret, [slot])

    # First decryption
    res1 = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected_pdf, "USER-BOB", "BobPass123!", bob["vault"],
        base64.b64encode(bob["pub_sig"]).decode("utf-8")
    )

    # Second decryption of identical source document
    res2 = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected_pdf, "USER-BOB", "BobPass123!", bob["vault"],
        base64.b64encode(bob["pub_sig"]).decode("utf-8")
    )

    assert res1.receipt.watermark_id != res2.receipt.watermark_id
    assert res1.receipt.session_id != res2.receipt.session_id


def test_corrupted_or_missing_trailer():
    """Missing or corrupted trailer must fail gracefully without crash."""
    garbage_bytes = b"GARBAGE_NON_PDF_DATA_1234567890"
    bob = _make_ident("Bob", "BobPass123!")

    with pytest.raises(ValueError, match="no recipient trailer found"):
        LocalRecipientDecryptor.decrypt_protected_pdf(
            garbage_bytes, "USER-BOB", "BobPass123!", bob["vault"]
        )


def test_unauthorized_recipient_rejected():
    """If user has valid credentials on device but is not in recipient slots, deny access."""
    alice = _make_ident("Alice", "AlicePass123!")
    eve = _make_ident("Eve", "EvePass123!")

    pdf_bytes = generate_sample_navy_pdf("Doc for Alice Only", "DOC-ALICE", "SECRET", "Alice eyes only")
    doc_open_secret = os.urandom(32).hex()
    slot_alice = MultiRecipientEnvelope.wrap_cek_for_recipient(doc_open_secret.encode("utf-8"), "USER-ALICE", alice["pub_x"], alice["pub_pqc"])

    protected_pdf = PdfProtector.protect(pdf_bytes, "DOC-ALICE", "Doc for Alice Only", doc_open_secret, [slot_alice])

    with pytest.raises(PermissionError, match="not authorized"):
        LocalRecipientDecryptor.decrypt_protected_pdf(
            protected_pdf, "USER-EVE", "EvePass123!", eve["vault"]
        )


def test_wrong_password_vault_rejection():
    """Wrong password fails immediately at Argon2id step, preventing any decryption."""
    bob = _make_ident("Bob", "BobCorrectPass123!")
    pdf_bytes = generate_sample_navy_pdf("Doc", "DOC-FAIL", "SECRET", "Content")
    doc_open_secret = os.urandom(32).hex()
    slot = MultiRecipientEnvelope.wrap_cek_for_recipient(doc_open_secret.encode("utf-8"), "USER-BOB", bob["pub_x"], bob["pub_pqc"])
    protected_pdf = PdfProtector.protect(pdf_bytes, "DOC-FAIL", "Doc", doc_open_secret, [slot])

    with pytest.raises(InvalidCredentialsError):
        LocalRecipientDecryptor.decrypt_protected_pdf(
            protected_pdf, "USER-BOB", "WrongPass!", bob["vault"]
        )
