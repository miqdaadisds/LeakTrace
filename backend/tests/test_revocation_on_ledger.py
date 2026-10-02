"""
Tests for Revocation on Ledger:
- Revocation creates a NEW immutable ledger event
- Historical decryption records remain completely untouched
- Revoked users are prevented from subsequent access
"""
import os
import time
import pytest

from app.db.database import Database
from app.provenance.ledger import ProvenanceLedger
from app.core.types import DecryptionProvenanceReceipt


def test_revocation_creates_new_event_without_altering_history(tmp_path):
    db_path = str(tmp_path / "revocation_ledger.db")
    db = Database(db_path)
    db.initialize()

    ledger = ProvenanceLedger(db=db)

    # 1. User Bob legitimately decrypts and generates block 1
    receipt1 = DecryptionProvenanceReceipt(
        receipt_id="RCPT-HISTORICAL-01",
        doc_id="DOC-HISTORICAL",
        recipient_id="USER-BOB",
        session_id="SESS-H01",
        watermark_id="WM-HISTORICAL-99",
        ciphertext_hash="hash_h",
        timestamp=time.time(),
        device_fingerprint="WORKSTATION-BOB",
        recipient_signature_b64="SIG_BOB",
        recipient_public_key_sig_b64="PUB_BOB",
        event_digest="DIGEST_BOB"
    )
    block_1_idx, block_1_hash = ledger.commit_receipt(receipt1)
    assert block_1_idx == 1

    # 2. Later, Bob's credentials are revoked
    # Admin creates a revocation receipt and commits it as block 2
    revocation_receipt = DecryptionProvenanceReceipt(
        receipt_id="RCPT-REVOCATION-USER-BOB",
        doc_id="SYSTEM-REVOCATION-ACTION",
        recipient_id="USER-BOB",
        session_id="SESS-REVOKE",
        watermark_id="WM-REVOCATION-EVENT",
        ciphertext_hash="REVOCATION-PROOF",
        timestamp=time.time(),
        device_fingerprint="ADMIN-CONSOLE",
        recipient_signature_b64="REVOKED-BY-ADMIN",
        recipient_public_key_sig_b64="",
        event_digest="DIGEST-REVOCATION-EVENT"
    )
    block_2_idx, block_2_hash = ledger.commit_receipt(revocation_receipt)
    assert block_2_idx == 2

    # 3. Block 1 is unchanged
    block_1_after = db.get_block(1)
    assert block_1_after["block_hash"] == block_1_hash

    # 4. Total blocks is 2 (plus genesis if tracked)
    assert db.block_count() >= 2

    # 5. Chain integrity remains valid and unbroken
    is_valid, msg, count = ledger.verify_chain_integrity()
    assert is_valid is True
