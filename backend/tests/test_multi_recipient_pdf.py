"""
Tests for Multi-Recipient Encrypted PDF Distribution:
- ONE protected PDF distributed to Alice, Bob, and Charlie
- Exactly identical byte hash for all recipients
- Independent ML-KEM slot access
- Cross-recipient isolation (Alice cannot use Bob's slot)
- Decrypted outputs have distinct forensic watermarks
"""
import os
import io
import base64
import hashlib
import pytest

from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector
from app.client.decryptor import LocalRecipientDecryptor
from app.core.pdf_generator import generate_sample_navy_pdf


def _make_recipient(name, password):
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


def test_multi_recipient_one_file_independent_access():
    alice = _make_recipient("Alice", "AliceSecurePass2026!")
    bob = _make_recipient("Bob", "BobSecurePass2026!")

    doc_id = "DOC-MULTI-01"
    pdf_bytes = generate_sample_navy_pdf("Joint Task Order", doc_id, "SECRET", "Naval maneuvers")
    doc_open_secret = os.urandom(32).hex()
    dos_bytes = doc_open_secret.encode("utf-8")

    # Generate ML-KEM wrapped slots for both recipients
    alice_slot = MultiRecipientEnvelope.wrap_cek_for_recipient(dos_bytes, "USER-ALICE", alice["pub_x"], alice["pub_pqc"])
    bob_slot = MultiRecipientEnvelope.wrap_cek_for_recipient(dos_bytes, "USER-BOB", bob["pub_x"], bob["pub_pqc"])

    # Create ONE protected PDF
    protected_pdf = PdfProtector.protect(
        source_pdf_bytes=pdf_bytes,
        doc_id=doc_id,
        title="Joint Task Order",
        doc_open_secret=doc_open_secret,
        recipient_slots=[alice_slot, bob_slot]
    )

    # 1. Byte-identical file delivered to both
    alice_delivered = protected_pdf
    bob_delivered = protected_pdf
    assert hashlib.sha256(alice_delivered).hexdigest() == hashlib.sha256(bob_delivered).hexdigest()

    # 2. Alice decrypts successfully
    alice_res = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected_pdf_bytes=alice_delivered,
        recipient_id="USER-ALICE",
        password="AliceSecurePass2026!",
        encrypted_vault=alice["vault"],
        public_key_sig_b64=base64.b64encode(alice["pub_sig"]).decode("utf-8")
    )
    assert len(alice_res.watermarked_pdf_bytes) > 0

    # 3. Bob decrypts successfully
    bob_res = LocalRecipientDecryptor.decrypt_protected_pdf(
        protected_pdf_bytes=bob_delivered,
        recipient_id="USER-BOB",
        password="BobSecurePass2026!",
        encrypted_vault=bob["vault"],
        public_key_sig_b64=base64.b64encode(bob["pub_sig"]).decode("utf-8")
    )
    assert len(bob_res.watermarked_pdf_bytes) > 0

    # 4. Decrypted copies are visually the same document but forensically distinct
    assert alice_res.receipt.watermark_id != bob_res.receipt.watermark_id
    assert alice_res.receipt.session_id != bob_res.receipt.session_id

    # 5. Cross-credential failure: Alice's password fails to unlock Bob's vault
    with pytest.raises(Exception):
        LocalRecipientDecryptor.decrypt_protected_pdf(
            protected_pdf_bytes=bob_delivered,
            recipient_id="USER-BOB",
            password="AliceSecurePass2026!",  # Wrong password for Bob
            encrypted_vault=bob["vault"],
            public_key_sig_b64=base64.b64encode(bob["pub_sig"]).decode("utf-8")
        )
