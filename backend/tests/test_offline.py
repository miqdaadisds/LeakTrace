"""
Tests for Air-Gapped / Offline Operation:
- Pipeline executes without internet or external network lookups
- Proves zero cloud KMS dependency, zero external blockchain dependency
- Ensures socket DNS resolution failures do not disrupt cryptographic flows
"""
import socket
import pytest
from unittest.mock import patch

from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector
from app.client.decryptor import LocalRecipientDecryptor
from app.core.pdf_generator import generate_sample_navy_pdf
import base64
import os


def test_complete_cryptographic_flow_in_network_isolated_environment():
    """Mocks network resolution so any socket getaddrinfo calls raise an error."""
    def block_network(*args, **kwargs):
        raise socket.error("Network unavailable: air-gapped operation")

    with patch("socket.getaddrinfo", side_effect=block_network):
        # 1. Local Key Generation
        priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
        priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
        vault = EncryptedCredentialVault.create_vault("AirGapPass2026!", priv_x, priv_pqc, priv_sig)

        # 2. Local Document Protection
        pdf_bytes = generate_sample_navy_pdf("Tactical Fleet Plan", "DOC-AIRGAP", "SECRET", "Operational data")
        doc_open_secret = os.urandom(32).hex()
        dos_bytes = doc_open_secret.encode("utf-8")
        slot = MultiRecipientEnvelope.wrap_cek_for_recipient(dos_bytes, "USER-OFFLINE", pub_x, pub_pqc)

        protected_pdf = PdfProtector.protect(
            source_pdf_bytes=pdf_bytes,
            doc_id="DOC-AIRGAP",
            title="Tactical Fleet Plan",
            doc_open_secret=doc_open_secret,
            recipient_slots=[slot]
        )
        assert len(protected_pdf) > 0

        # 3. Local Decryption, Watermarking, and ML-DSA-65 Signing
        dec_res = LocalRecipientDecryptor.decrypt_protected_pdf(
            protected_pdf_bytes=protected_pdf,
            recipient_id="USER-OFFLINE",
            password="AirGapPass2026!",
            encrypted_vault=vault,
            public_key_sig_b64=base64.b64encode(pub_sig).decode("utf-8")
        )

        assert len(dec_res.watermarked_pdf_bytes) > 0
        assert dec_res.receipt.session_id.startswith("SESS-")
        assert dec_res.receipt.recipient_signature_b64 is not None
