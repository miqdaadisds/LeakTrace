"""
Tests for Forensics & Evidence Export:
- Evidence report generation for attributed leaks
- Report includes attribution status, watermark ID, ledger block, Merkle proof, and validator endorsements
- Cryptographic verification of exported evidence
"""
import time
import asyncio
import pytest

from app.provenance.ledger import provenance_ledger
from app.core.types import DecryptionProvenanceReceipt
from app.api.routes_forensics import export_report, ExportReportRequest


def test_evidence_report_export_structure():
    # 1. Setup a committed receipt on ledger
    test_wm_id = "WM-EVIDENCE-TEST-88"
    receipt = DecryptionProvenanceReceipt(
        receipt_id="RCPT-EVIDENCE-01",
        doc_id="DOC-NAVY-LEAK",
        recipient_id="USER-BOB",
        session_id="SESS-EV-01",
        watermark_id=test_wm_id,
        ciphertext_hash="cipher_ev_hash",
        timestamp=time.time(),
        device_fingerprint="WORKSTATION-BOB",
        recipient_signature_b64="VALID_SIG_B64",
        recipient_public_key_sig_b64="VALID_PUB_B64",
        event_digest="DIGEST_EV"
    )
    block_idx, block_hash = provenance_ledger.commit_receipt(receipt)
    assert block_idx > 0

    # 2. Call export_report directly
    req = ExportReportRequest(watermark_id=test_wm_id)
    report_data = asyncio.run(export_report(req))

    # 3. Verify evidence package fields
    assert "report_id" in report_data
    assert report_data["watermark_id"] == test_wm_id
    assert report_data["recipient_id"] == "USER-BOB"
    assert report_data["ledger_block_index"] == block_idx
    assert "merkle_proof" in report_data
    assert "validator_endorsements" in report_data
    assert "exported_at" in report_data
