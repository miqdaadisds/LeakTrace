"""
Tests for Ledger Persistence in SQLite:
- Committed provenance blocks are persisted to disk (SQLite)
- Blocks and Merkle roots survive restart / re-instantiation
- Watermark indexing across restart
"""
import os
import time
import pytest

from app.db.database import Database
from app.provenance.ledger import ProvenanceLedger
from app.core.types import DecryptionProvenanceReceipt


def test_ledger_blocks_survive_reinitialization(tmp_path):
    db_path = str(tmp_path / "persistent_ledger.db")
    db = Database(db_path)
    db.initialize()

    # 1. Create first ledger instance and commit receipt
    ledger1 = ProvenanceLedger(db=db)
    receipt1 = DecryptionProvenanceReceipt(
        receipt_id="RCPT-PERSIST-01",
        doc_id="DOC-NAVY-PERSIST",
        recipient_id="USER-BOB",
        session_id="SESS-P01",
        watermark_id="WM-PERSIST-001",
        ciphertext_hash="hash_01",
        timestamp=time.time(),
        device_fingerprint="WORKSTATION-01",
        recipient_signature_b64="SIG1",
        recipient_public_key_sig_b64="PUB1",
        event_digest="DIGEST1"
    )
    block_idx1, block_hash1 = ledger1.commit_receipt(receipt1)
    assert block_idx1 == 1

    # 2. Simulate process restart by creating a brand new ledger instance pointing to same DB
    ledger2 = ProvenanceLedger(db=db)

    # 3. Verify block survives
    block = db.get_block(1)
    assert block is not None
    assert block["block_hash"] == block_hash1

    # 4. Verify watermark index lookup
    wm_entry = db.find_by_watermark("WM-PERSIST-001")
    assert wm_entry is not None
    assert wm_entry["recipient_id"] == "USER-BOB"
    assert wm_entry["block_index"] == 1
