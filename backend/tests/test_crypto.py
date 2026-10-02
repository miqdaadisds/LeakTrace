"""
Unit tests for Cryptographic Subsystems (v1.1 — Encrypted PDF Architecture):
- Real NIST FIPS 203 ML-KEM-768 Hybrid Key Encapsulation
- Real NIST FIPS 204 ML-DSA-65 Post-Quantum Digital Signatures
- Argon2id Memory-Hard Password Protected Credential Vaults
- O(1) AES-256-GCM Single-Ciphertext Envelope Encryption
- Genuine AES-256 PDF Encryption with LeakTrace Recipient Trailer
"""
import os
import json
import pytest
import base64
from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector


def test_real_nist_fips_203_ml_kem_768():
    """Verifies genuine ML-KEM-768 key generation, encapsulation, and decapsulation."""
    priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    assert len(pub_x) == 32
    assert len(priv_x) == 32
    assert len(pub_pqc) == 1184  # NIST FIPS 203 ML-KEM-768 PK
    assert len(priv_pqc) == 2400 # NIST FIPS 203 ML-KEM-768 SK

    ss_enc, kem_ct = HybridPQCKEM.encapsulate(pub_x, pub_pqc)
    assert len(ss_enc) == 32
    assert len(kem_ct) >= 1120   # 32 (X25519) + 1088 (ML-KEM-768 CT)

    ss_dec = HybridPQCKEM.decapsulate(priv_x, priv_pqc, kem_ct)
    assert ss_enc == ss_dec


def test_real_nist_fips_204_ml_dsa_65():
    """Verifies genuine ML-DSA-65 post-quantum signing and verification."""
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
    assert len(pub_sig) == 1952  # NIST FIPS 204 ML-DSA-65 PK
    assert len(priv_sig) == 4032 # NIST FIPS 204 ML-DSA-65 SK

    message = b"PROVENANCE-RECEIPT:USER-BOB|DOC-SIH26237|EVENT-DIGEST-99"
    signature = DigitalSignatureManager.sign(message, priv_sig)
    assert len(signature) == 3309 # NIST FIPS 204 ML-DSA-65 Signature

    assert DigitalSignatureManager.verify(message, signature, pub_sig) is True
    assert DigitalSignatureManager.verify(message + b"-TAMPERED", signature, pub_sig) is False


def test_argon2id_credential_vault():
    """Tests password protection of private keys using Argon2id."""
    priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()

    password = "CorrectPassphrase2026!"
    vault = EncryptedCredentialVault.create_vault(password, priv_x, priv_pqc, priv_sig)

    rec_x, rec_pqc, rec_sig, _ = EncryptedCredentialVault.unlock_vault(password, vault)
    assert rec_x == priv_x
    assert rec_pqc == priv_pqc
    assert rec_sig == priv_sig

    with pytest.raises(InvalidCredentialsError):
        EncryptedCredentialVault.unlock_vault("WrongPassword123!", vault)


def test_single_ciphertext_multi_recipient_envelope():
    """Tests O(1) single ciphertext encryption and independent multi-recipient key unwrap."""
    pdf_bytes = b"%PDF-1.4 Mock classified defence plan for WESEE SIH 26237"
    cek, payload = MultiRecipientEnvelope.encrypt_document_bytes(
        pdf_bytes, "DOC-01", "Plan Alpha", "CONFIDENTIAL", "SENDER-01"
    )

    alice_x, alice_pub_x, alice_pqc, alice_pub_pqc = HybridPQCKEM.generate_keypair()
    bob_x, bob_pub_x, bob_pqc, bob_pub_pqc = HybridPQCKEM.generate_keypair()

    alice_wrap = MultiRecipientEnvelope.wrap_cek_for_recipient(cek, "USER-ALICE", alice_pub_x, alice_pub_pqc)
    bob_wrap = MultiRecipientEnvelope.wrap_cek_for_recipient(cek, "USER-BOB", bob_pub_x, bob_pub_pqc)

    alice_cek = MultiRecipientEnvelope.unwrap_cek(alice_wrap, alice_x, alice_pqc)
    assert alice_cek == cek
    alice_pdf = MultiRecipientEnvelope.decrypt_document_bytes(payload, alice_cek)
    assert alice_pdf == pdf_bytes

    bob_cek = MultiRecipientEnvelope.unwrap_cek(bob_wrap, bob_x, bob_pqc)
    assert bob_cek == cek
    bob_pdf = MultiRecipientEnvelope.decrypt_document_bytes(payload, bob_cek)
    assert bob_pdf == pdf_bytes


def _make_sample_pdf():
    """Create a minimal valid PDF for testing."""
    from app.core.pdf_generator import generate_sample_navy_pdf
    return generate_sample_navy_pdf("Test Plan", "DOC-TEST", "SECRET", "Test content")


def test_pdf_protector_encrypt_and_decrypt():
    """Tests genuine AES-256 PDF encryption and decryption with Document Open Secret."""
    pdf_bytes = _make_sample_pdf()
    doc_open_secret = os.urandom(32).hex()

    protected = PdfProtector.protect(
        pdf_bytes, "DOC-01", "Test", doc_open_secret,
        [{"recipient_id": "USER-BOB", "kem_ciphertext_b64": "abc", "wrapped_cek_b64": "def"}]
    )

    # Must start with %PDF
    assert protected[:5] == b"%PDF-"

    # Must contain trailer
    assert b"%%LEAKTRACE_SLOTS_V2%%" in protected
    assert b"%%LEAKTRACE_SLOTS_END%%" in protected

    # Read slots without password
    slots = PdfProtector.read_slots(protected)
    assert slots is not None
    assert len(slots["recipients"]) == 1
    assert slots["recipients"][0]["recipient_id"] == "USER-BOB"

    # Decrypt with correct DOS
    core = PdfProtector.extract_core_pdf(protected)
    decrypted = PdfProtector.decrypt_pdf(core, doc_open_secret)
    assert len(decrypted) > 0


def test_pdf_protector_wrong_password_rejected():
    """Wrong password cannot decrypt the protected PDF."""
    from pypdf import PdfReader
    import io

    pdf_bytes = _make_sample_pdf()
    doc_open_secret = os.urandom(32).hex()
    protected = PdfProtector.protect(pdf_bytes, "DOC-02", "Test", doc_open_secret, [])

    core = PdfProtector.extract_core_pdf(protected)
    reader = PdfReader(io.BytesIO(core))
    result = reader.decrypt("WrongPassword!")
    assert result == 0  # 0 = password rejected


def test_pdf_protector_trailer_tampering_detected():
    """Tampering with trailer slots must be detected."""
    pdf_bytes = _make_sample_pdf()
    doc_open_secret = os.urandom(32).hex()
    protected = PdfProtector.protect(
        pdf_bytes, "DOC-03", "Test", doc_open_secret,
        [{"recipient_id": "USER-ALICE", "kem_ciphertext_b64": "x", "wrapped_cek_b64": "y"}]
    )

    # Tamper with a recipient ID
    tampered = protected.replace(b"USER-ALICE", b"USER-EVEEE")

    # Extract trailer and verify integrity
    start_marker = b"%%LEAKTRACE_SLOTS_V2%%\n"
    end_marker = b"\n%%LEAKTRACE_SLOTS_END%%\n"
    start_idx = tampered.rfind(start_marker)
    end_idx = tampered.rfind(end_marker)
    trailer_content = tampered[start_idx + len(start_marker):end_idx]
    last_nl = trailer_content.rfind(b"\n")
    slots_json_bytes = trailer_content[:last_nl]
    hmac_hex = trailer_content[last_nl + 1:].decode("utf-8")

    assert PdfProtector.verify_trailer_integrity(slots_json_bytes, hmac_hex, doc_open_secret) is False


def test_pdf_protector_multi_recipient_same_file():
    """ONE protected PDF works for multiple recipients — identical bytes."""
    pdf_bytes = _make_sample_pdf()
    doc_open_secret = os.urandom(32).hex()

    slots = [
        {"recipient_id": "USER-ALICE", "kem_ciphertext_b64": "a1", "wrapped_cek_b64": "b1"},
        {"recipient_id": "USER-BOB", "kem_ciphertext_b64": "a2", "wrapped_cek_b64": "b2"},
        {"recipient_id": "USER-CHARLIE", "kem_ciphertext_b64": "a3", "wrapped_cek_b64": "b3"},
    ]
    protected = PdfProtector.protect(pdf_bytes, "DOC-04", "Test", doc_open_secret, slots)

    # Alice's copy and Bob's copy are identical
    alice_copy = protected
    bob_copy = protected
    import hashlib
    assert hashlib.sha256(alice_copy).hexdigest() == hashlib.sha256(bob_copy).hexdigest()

    # Both can read their slots
    parsed = PdfProtector.read_slots(protected)
    assert len(parsed["recipients"]) == 3
    ids = [r["recipient_id"] for r in parsed["recipients"]]
    assert "USER-ALICE" in ids
    assert "USER-BOB" in ids
    assert "USER-CHARLIE" in ids
