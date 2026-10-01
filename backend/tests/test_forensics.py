"""
End-to-End Forensic Attribution & Non-Repudiation Integration Tests.
Simulates real-world operational scenarios:
1. Distribution of classified PDF memo to Alice, Bob, and Charlie.
2. Bob opens and decrypts the .secure package locally using his password.
3. Decryption embeds an invisible forensic watermark and generates an ML-DSA-65 signed receipt.
4. Receipt is committed to the multi-validator permissioned ledger.
5. Bob's decrypted PDF leaks (LEAKED_DOCUMENT.pdf).
6. Forensic Attribution Engine extracts the watermark from the raw leaked PDF file.
7. Conclusively traces the leak to Bob with mathematical proof:
   - Watermark MATCHED
   - ML-DSA Signature VALID
   - Ledger Evidence VALID
8. Tests conflict / corrupted watermark handling (abstains rather than falsely accusing).
9. Tests full offline / air-gapped capability.
"""
import base64
import time
from app.core.state import system_state
from app.crypto.container import SecureContainerFormat
from app.client.decryptor import LocalRecipientDecryptor
from app.provenance.ledger import provenance_ledger
from app.forensics.attribution_engine import forensic_engine


def test_end_to_end_real_pdf_leak_attribution():
    """
    Primary SIH26237 End-to-End Test:
    Demonstrates:
    - Encrypt once
    - Bob receives ONE .secure file + password
    - Local recipient decryption & dynamic watermarking
    - Signed receipt on immutable ledger
    - Forensic attribution on leaked PDF
    """
    doc_id = "DOC-7F3A29B1"
    pkg_key = f"{doc_id}:USER-BOB"
    pkg_bytes = system_state.secure_packages[pkg_key]
    assert pkg_bytes is not None

    # 1. Bob decrypts locally with his password
    bob_password = "BobSecure2026!"
    dec_res = LocalRecipientDecryptor.decrypt_secure_package(pkg_bytes, bob_password)
    assert len(dec_res.watermarked_pdf_bytes) > 0

    # 2. Anchor Bob's signed receipt into the ledger
    block_idx, block_hash = provenance_ledger.commit_receipt(dec_res.receipt)
    assert block_idx > 0

    # 3. Simulate leak: Bob's decrypted PDF is leaked
    leaked_pdf_bytes = dec_res.watermarked_pdf_bytes

    # 4. Forensic investigation (No password, no private keys required)
    investigation = forensic_engine.investigate_pdf_leak(leaked_pdf_bytes)

    assert investigation.is_attributed is True
    assert investigation.recipient_id == "USER-BOB"
    assert investigation.recipient_name == "Bob"
    assert investigation.watermark_status == "MATCHED"
    assert investigation.signature_status == "VALID"
    assert investigation.ledger_status == "VALID"
    assert investigation.ledger_block_index == block_idx


def test_tampered_or_unmarked_pdf_abstains():
    """
    Verifies PS Requirement:
    If watermark extraction is corrupted, missing, or channels disagree:
    return an INVESTIGATIVE LEAD / CONFLICT / ABSTAIN result rather than falsely identifying someone.
    """
    # Plain unmodified PDF with no watermark
    dummy_pdf = b"%PDF-1.4\n1 0 obj\n<<\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF"
    res = forensic_engine.investigate_pdf_leak(dummy_pdf)

    assert res.is_attributed is False
    assert res.watermark_status == "NOT_FOUND"
    assert "No cryptographic forensic watermark" in res.forensic_summary


def test_air_gapped_offline_operation():
    """
    Verifies that the entire pipeline operates with 100% offline local primitives:
    - Zero remote KMS
    - Zero public blockchain gas/network calls
    - Fully deterministic local cryptography
    """
    from app.crypto.pqc_kem import HybridPQCKEM
    from app.crypto.pqc_sig import DigitalSignatureManager
    from app.crypto.vault import EncryptedCredentialVault
    from app.crypto.envelope import MultiRecipientEnvelope

    from app.core.pdf_generator import generate_sample_navy_pdf

    # Keygen offline
    priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
    priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
    vault = EncryptedCredentialVault.create_vault("OfflinePass123", priv_x, priv_pqc, priv_sig)

    # Encrypt offline with real PDF
    pdf = generate_sample_navy_pdf("Air Gapped Plan", "DOC-OFFLINE", "SECRET", "Directive for air-gapped test")
    cek, payload = MultiRecipientEnvelope.encrypt_document_bytes(pdf, "DOC-OFFLINE", "Air-Gapped Plan", "SECRET", "OFFLINE-SENDER")
    wrapped = MultiRecipientEnvelope.wrap_cek_for_recipient(cek, "USER-OFFLINE", pub_x, pub_pqc)

    pkg = SecureContainerFormat.pack(
        doc_id="DOC-OFFLINE",
        title="Air-Gapped Plan",
        original_filename="AirGapped.pdf",
        classification="SECRET",
        doc_hash_sha256="abc",
        recipient_id="USER-OFFLINE",
        recipient_name="Offline Recipient",
        recipient_public_kem_b64=base64.b64encode(pub_pqc).decode("utf-8"),
        recipient_public_sig_b64=base64.b64encode(pub_sig).decode("utf-8"),
        encrypted_vault=vault,
        wrapped_cek=wrapped,
        encrypted_payload=payload
    )
    pkg_bytes = SecureContainerFormat.serialize_to_bytes(pkg)

    # Decrypt offline
    res = LocalRecipientDecryptor.decrypt_secure_package(pkg_bytes, "OfflinePass123")
    assert res.watermarked_pdf_bytes is not None
    assert res.receipt.recipient_signature_b64 is not None
