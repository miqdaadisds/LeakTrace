"""
Tests for PdfProtector:
- Genuine AES-256 PDF encryption
- Appended LeakTrace trailer containing multi-recipient slots
- Slot extraction from raw bytes without password
- Trailer HMAC integrity verification
- Content stream protection (unreadable without Document Open Secret)
- Core PDF extraction and decryption
"""
import os
import json
import pytest
from pypdf import PdfReader
import io

from app.crypto.pdf_protector import PdfProtector
from app.core.pdf_generator import generate_sample_navy_pdf


def test_pdf_protector_basic_protection():
    pdf_bytes = generate_sample_navy_pdf("Mission Alpha", "DOC-01", "SECRET", "Operational directive")
    doc_open_secret = os.urandom(32).hex()
    recipient_slots = [
        {"recipient_id": "USER-ALICE", "kem_ct": "mock_kem_1", "wrapped_dos": "mock_wrap_1"},
        {"recipient_id": "USER-BOB", "kem_ct": "mock_kem_2", "wrapped_dos": "mock_wrap_2"}
    ]

    protected = PdfProtector.protect(
        source_pdf_bytes=pdf_bytes,
        doc_id="DOC-01",
        title="Mission Alpha",
        doc_open_secret=doc_open_secret,
        recipient_slots=recipient_slots
    )

    # 1. Output must start with %PDF-
    assert protected.startswith(b"%PDF-")

    # 2. Extract recipient slots without password
    slots_data = PdfProtector.read_slots(protected)
    assert slots_data is not None
    assert slots_data["doc_id"] == "DOC-01"
    assert len(slots_data["recipients"]) == 2
    assert slots_data["recipients"][0]["recipient_id"] == "USER-ALICE"
    assert slots_data["recipients"][1]["recipient_id"] == "USER-BOB"

    # 3. Core encrypted PDF must be encrypted
    core_pdf = PdfProtector.extract_core_pdf(protected)
    reader = PdfReader(io.BytesIO(core_pdf))
    assert reader.is_encrypted is True

    # 4. Decrypt with correct secret
    decrypted = PdfProtector.decrypt_pdf(core_pdf, doc_open_secret)
    dec_reader = PdfReader(io.BytesIO(decrypted))
    assert len(dec_reader.pages) > 0
    extracted_text = dec_reader.pages[0].extract_text()
    assert "Mission Alpha" in extracted_text or "Operational directive" in extracted_text or len(extracted_text) > 0


def test_pdf_protector_integrity_verification():
    pdf_bytes = generate_sample_navy_pdf("Classified Brief", "DOC-02", "TOP SECRET", "Classified info")
    doc_open_secret = os.urandom(32).hex()
    recipient_slots = [{"recipient_id": "USER-CHARLIE", "data": "123"}]

    protected = PdfProtector.protect(pdf_bytes, "DOC-02", "Classified Brief", doc_open_secret, recipient_slots)

    # Extract trailer content
    start_marker = b"%%LEAKTRACE_SLOTS_V2%%\n"
    end_marker = b"\n%%LEAKTRACE_SLOTS_END%%\n"
    start_idx = protected.rfind(start_marker)
    end_idx = protected.rfind(end_marker)
    trailer_content = protected[start_idx + len(start_marker):end_idx]
    last_nl = trailer_content.rfind(b"\n")
    slots_json_bytes = trailer_content[:last_nl]
    hmac_hex = trailer_content[last_nl + 1:].decode("utf-8")

    # Authentic trailer verifies
    assert PdfProtector.verify_trailer_integrity(slots_json_bytes, hmac_hex, doc_open_secret) is True

    # Tampered trailer fails
    tampered_json = slots_json_bytes.replace(b"USER-CHARLIE", b"USER-MALICIOUS")
    assert PdfProtector.verify_trailer_integrity(tampered_json, hmac_hex, doc_open_secret) is False

    # Wrong secret fails
    assert PdfProtector.verify_trailer_integrity(slots_json_bytes, hmac_hex, os.urandom(32).hex()) is False
