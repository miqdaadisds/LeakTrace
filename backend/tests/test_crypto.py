"""
Unit tests for Cryptographic Subsystems:
- Hybrid PQC KEM (ML-KEM-768 + X25519)
- Ed25519/ML-DSA Digital Signatures
- Multi-Recipient AES-256-GCM Envelope Encryption
"""
import base64
import pytest
from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.envelope import MultiRecipientEnvelope
from app.core.types import RecipientProfile


def test_hybrid_pqc_kem_flow():
    # 1. Generate keypairs
    priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    assert len(priv_x) == 32
    assert len(pub_x) == 32
    assert len(priv_pqc) > 0
    assert len(pub_pqc) > 0

    # 2. Encapsulate
    shared_secret_enc, kem_ciphertext = HybridPQCKEM.encapsulate(pub_x, pub_pqc)
    assert len(shared_secret_enc) == 32
    assert len(kem_ciphertext) > 0

    # 3. Decapsulate
    shared_secret_dec = HybridPQCKEM.decapsulate(priv_x, priv_pqc, kem_ciphertext)
    assert len(shared_secret_dec) == 32

    # 4. Assert key agreement holds exactly
    assert shared_secret_enc == shared_secret_dec


def test_digital_signature_flow():
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
    message = b"DEC-RECEIPT:DEF-NAVY-0842|INS-VIKRANT|DOC-99"

    signature = DigitalSignatureManager.sign(message, priv_sig)
    assert len(signature) == 64

    # Verification must succeed
    assert DigitalSignatureManager.verify(message, signature, pub_sig) is True

    # Tampered message must fail verification
    assert DigitalSignatureManager.verify(message + b"-TAMPERED", signature, pub_sig) is False


def test_multi_recipient_envelope_encryption():
    # Setup 3 recipients
    recipients = []
    keys = []
    for i in range(3):
        priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
        keys.append((priv_x, priv_pqc))
        recipients.append(RecipientProfile(
            recipient_id=f"OFFICER-{i}",
            name=f"Officer {i}",
            unit=f"Naval Unit {i}",
            public_key_x25519_b64=base64.b64encode(pub_x).decode("utf-8"),
            public_key_pqc_b64=base64.b64encode(pub_pqc).decode("utf-8"),
            public_key_sig_b64="MOCK-SIG-KEY"
        ))

    doc_id = "DOC-TEST-ENVELOPE-01"
    title = "Classified Fleet Maneuvers"
    plaintext = "SECRET TACTICAL INSTRUCTIONS: Execute formation Bravo-Zulu at 0400Z."
    classification = "TOP SECRET"
    publisher_id = "NAVY-HQ"

    # Encrypt once for all 3 recipients
    package = MultiRecipientEnvelope.encrypt_document(
        doc_id=doc_id,
        title=title,
        plaintext=plaintext,
        classification=classification,
        publisher_id=publisher_id,
        recipients=recipients
    )

    assert package.doc_id == doc_id
    assert len(package.recipient_wraps) == 3

    # All 3 recipients must be able to decrypt the exact same plaintext
    for i in range(3):
        priv_x, priv_pqc = keys[i]
        decrypted = MultiRecipientEnvelope.decrypt_document(
            package=package,
            recipient_id=f"OFFICER-{i}",
            priv_x25519_bytes=priv_x,
            priv_pqc_bytes=priv_pqc
        )
        assert decrypted == plaintext

    # Unauthorized party must fail
    priv_unauth_x, _, priv_unauth_pqc, _ = HybridPQCKEM.generate_keypair()
    with pytest.raises(PermissionError):
        MultiRecipientEnvelope.decrypt_document(
            package=package,
            recipient_id="OFFICER-ROGUE",
            priv_x25519_bytes=priv_unauth_x,
            priv_pqc_bytes=priv_unauth_pqc
        )
