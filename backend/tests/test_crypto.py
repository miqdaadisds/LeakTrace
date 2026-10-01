"""
Unit tests for Cryptographic Subsystems:
- Real NIST FIPS 203 ML-KEM-768 Hybrid Key Encapsulation
- Real NIST FIPS 204 ML-DSA-65 Post-Quantum Digital Signatures
- Argon2id Memory-Hard Password Protected Credential Vaults
- O(1) AES-256-GCM Single-Ciphertext Envelope Encryption
- Portable .secure Container Packaging & Tamper Detection
"""
import pytest
import base64
from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.container import SecureContainerFormat


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

    # Verification must succeed for authentic message
    assert DigitalSignatureManager.verify(message, signature, pub_sig) is True

    # Tampered message must fail verification
    assert DigitalSignatureManager.verify(message + b"-TAMPERED", signature, pub_sig) is False


def test_argon2id_credential_vault():
    """Tests password protection of private keys using Argon2id."""
    priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()

    password = "CorrectPassphrase2026!"
    vault = EncryptedCredentialVault.create_vault(password, priv_x, priv_pqc, priv_sig)

    # 1. Successful unlock with correct password
    rec_x, rec_pqc, rec_sig, _ = EncryptedCredentialVault.unlock_vault(password, vault)
    assert rec_x == priv_x
    assert rec_pqc == priv_pqc
    assert rec_sig == priv_sig

    # 2. Failure with wrong password
    with pytest.raises(InvalidCredentialsError):
        EncryptedCredentialVault.unlock_vault("WrongPassword123!", vault)


def test_single_ciphertext_multi_recipient_envelope():
    """Tests O(1) single ciphertext encryption and independent multi-recipient CEK unwrap."""
    pdf_bytes = b"%PDF-1.4 Mock classified defence plan for WESEE SIH 26237"
    cek, payload = MultiRecipientEnvelope.encrypt_document_bytes(
        pdf_bytes, "DOC-01", "Plan Alpha", "CONFIDENTIAL", "SENDER-01"
    )

    # Alice and Bob
    alice_x, alice_pub_x, alice_pqc, alice_pub_pqc = HybridPQCKEM.generate_keypair()
    bob_x, bob_pub_x, bob_pqc, bob_pub_pqc = HybridPQCKEM.generate_keypair()

    alice_wrap = MultiRecipientEnvelope.wrap_cek_for_recipient(cek, "USER-ALICE", alice_pub_x, alice_pub_pqc)
    bob_wrap = MultiRecipientEnvelope.wrap_cek_for_recipient(cek, "USER-BOB", bob_pub_x, bob_pub_pqc)

    # Alice decrypts
    alice_cek = MultiRecipientEnvelope.unwrap_cek(alice_wrap, alice_x, alice_pqc)
    assert alice_cek == cek
    alice_pdf = MultiRecipientEnvelope.decrypt_document_bytes(payload, alice_cek)
    assert alice_pdf == pdf_bytes

    # Bob decrypts
    bob_cek = MultiRecipientEnvelope.unwrap_cek(bob_wrap, bob_x, bob_pqc)
    assert bob_cek == cek
    bob_pdf = MultiRecipientEnvelope.decrypt_document_bytes(payload, bob_cek)
    assert bob_pdf == pdf_bytes


def test_secure_container_integrity_and_tamper():
    """Tests .secure file container packaging and detects modifications."""
    vault = {"format": "vault", "salt_b64": "abc", "nonce_b64": "def", "ciphertext_b64": "ghi"}
    wrap = {"wrapped_cek_b64": "123"}
    payload = {"ciphertext_b64": "xyz", "doc_hash_sha256": "456"}

    pkg = SecureContainerFormat.pack(
        doc_id="DOC-01",
        title="Title",
        original_filename="Doc.pdf",
        classification="CONFIDENTIAL",
        doc_hash_sha256="456",
        recipient_id="USER-BOB",
        recipient_name="Bob",
        recipient_public_kem_b64="pk_kem",
        recipient_public_sig_b64="pk_sig",
        encrypted_vault=vault,
        wrapped_cek=wrap,
        encrypted_payload=payload
    )
    serialized = SecureContainerFormat.serialize_to_bytes(pkg)

    # Deserialization succeeds
    unpacked = SecureContainerFormat.deserialize_from_bytes(serialized)
    assert unpacked["document"]["doc_id"] == "DOC-01"

    # Tampered container fails integrity check
    tampered_bytes = serialized.replace(b"USER-BOB", b"ATTACKER")
    with pytest.raises(ValueError, match="integrity check failed"):
        SecureContainerFormat.deserialize_from_bytes(tampered_bytes)
