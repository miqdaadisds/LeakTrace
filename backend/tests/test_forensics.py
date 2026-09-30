"""
End-to-End Forensic Attribution & Non-Repudiation Integration Test.
Simulates a real-world military leak scenario:
1. Distribution of classified operational order to multiple commanders.
2. An authorized officer decrypts the document on their terminal.
3. Decryption receipt is cryptographically signed and committed to the Merkle blockchain.
4. A leak occurs (copy-pasting text to an unauthorized forum).
5. Forensic Attribution Engine extracts the zero-width steganographic marker.
6. Mathematical proof verifies HMAC and matches the blockchain ledger entry.
7. Officer identity, exact timestamp, and blockchain block are conclusively proven.
"""
import base64
import time
import hashlib
from app.core.state import system_state
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pqc_sig import DigitalSignatureManager
from app.watermarking.text_stego import TextSteganographyWatermarker
from app.provenance.ledger import provenance_ledger
from app.core.types import DecryptionProvenanceReceipt
from app.forensics.attribution_engine import forensic_engine


def test_end_to_end_leak_attribution_workflow():
    # 1. Target officer: Cdr. Rajesh Sharma
    officer_sharma = system_state.get_officer("DEF-NAVY-0842")
    assert officer_sharma is not None
    assert officer_sharma.name == "Cdr. Rajesh Sharma"

    # 2. Encrypt classified order for the officers
    profiles = system_state.get_all_profiles()
    doc_id = "DOC-E2E-OPS-ARABIAN-SEA"
    doc_title = "MARITIME STRIKE DIRECTIVE: ARABIAN SEA FLEET DEPLOYMENT"
    plaintext = (
        "RESTRICTED OPERATIONAL DIRECTIVE // IMMEDIATE EXECUTION\n"
        "TO: COMMANDER WESTERN FLEET, INS VIKRANT CARRIER BATTLE GROUP\n\n"
        "1. ALL ASSETS IN SECTOR KILO-7 ARE TO COMMENCE FREQUENCY HOPPING AT 0200 HOURS.\n"
        "2. REPORT ALL SATELLITE RADAR CROSS-SECTION ANOMALIES TO NHQ COMSEC DIRECTLY.\n"
        "3. AUTHORIZATION CODE: BRAVO-SEVEN-DELTA-NINER."
    )

    package = MultiRecipientEnvelope.encrypt_document(
        doc_id=doc_id,
        title=doc_title,
        plaintext=plaintext,
        classification="TOP SECRET // DEFENCE",
        publisher_id="WESEE-DIRECTORATE",
        recipients=profiles
    )

    # 3. Simulate Cdr. Rajesh Sharma decrypting the document on his terminal
    priv_x = base64.b64decode(officer_sharma.priv_x25519_b64)
    priv_pqc = base64.b64decode(officer_sharma.priv_pqc_b64)
    priv_sig = base64.b64decode(officer_sharma.priv_sig_b64)

    decrypted_raw = MultiRecipientEnvelope.decrypt_document(
        package=package,
        recipient_id=officer_sharma.recipient_id,
        priv_x25519_bytes=priv_x,
        priv_pqc_bytes=priv_pqc
    )
    assert decrypted_raw == plaintext

    # 4. Decryption-time dynamic watermarking
    watermarker = TextSteganographyWatermarker()
    decryption_time = time.time()
    watermarked_text, wm_payload = watermarker.embed(
        doc_id=doc_id,
        recipient_id=officer_sharma.recipient_id,
        plaintext=decrypted_raw,
        timestamp=decryption_time
    )

    # 5. Compute canonical watermark hash and sign decryption receipt
    wm_hash = hashlib.sha256(
        f"{wm_payload.doc_id}|{wm_payload.recipient_id}|{int(wm_payload.timestamp)}|{wm_payload.session_nonce}".encode("utf-8")
    ).hexdigest()

    receipt_id = "RCPT-SHARMA-001"
    device_id = "INS-VIKRANT-TACTICAL-CONSOLE-02"
    sign_payload = f"{receipt_id}|{doc_id}|{officer_sharma.recipient_id}|{wm_hash}|{device_id}|{int(decryption_time)}".encode("utf-8")
    sig_bytes = DigitalSignatureManager.sign(sign_payload, priv_sig)

    receipt = DecryptionProvenanceReceipt(
        receipt_id=receipt_id,
        doc_id=doc_id,
        recipient_id=officer_sharma.recipient_id,
        timestamp=decryption_time,
        watermark_hash=wm_hash,
        device_fingerprint=device_id,
        recipient_signature_b64=base64.b64encode(sig_bytes).decode("utf-8")
    )

    # 6. Commit receipt to Provenance Blockchain
    block_index, block_hash = provenance_ledger.commit_receipt(receipt)
    assert block_index >= 1

    # 7. SIMULATE LEAK: Someone copy-pastes the watermarked text to an unauthorized forum/memo
    leaked_artifact = watermarked_text

    # 8. FORENSIC INVESTIGATION: WESEE Cyber Command runs attribution analysis
    attribution = forensic_engine.investigate_text_leak(leaked_artifact)

    # 9. Verify mathematical proof and non-repudiation
    assert attribution.is_attributed is True
    assert attribution.leaker_id == "DEF-NAVY-0842"
    assert attribution.leaker_name == "Cdr. Rajesh Sharma"
    assert "INS Vikrant Ops" in attribution.leaker_unit
    assert attribution.hmac_verified is True
    assert attribution.ledger_merkle_verified is True
    assert attribution.ledger_block_index == block_index
    assert attribution.confidence_score >= 0.99
    assert "LEAK ATTRIBUTED WITH MATHEMATICAL CERTAINTY" in attribution.forensic_summary
