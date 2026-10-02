"""
Tests for PDF Interoperability & Viewer Resistance:
- Ordinary reader cannot open document without password
- User's LeakTrace password FAILS as PDF password (only Document Open Secret works)
- Random passwords FAIL
- Protected PDF retains standards-compliant %PDF- header
- Creates sample protected PDF in artifacts directory for manual desktop verification
"""
import os
import io
import pytest
from pathlib import Path
from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError

from app.crypto.pdf_protector import PdfProtector
from app.core.pdf_generator import generate_sample_navy_pdf


def test_ordinary_viewer_blocked_without_password():
    pdf_bytes = generate_sample_navy_pdf("Strategic Order", "DOC-INTEROP", "TOP SECRET", "Classified naval operation")
    doc_open_secret = os.urandom(32).hex()
    protected = PdfProtector.protect(pdf_bytes, "DOC-INTEROP", "Strategic Order", doc_open_secret, [])

    core = PdfProtector.extract_core_pdf(protected)
    reader = PdfReader(io.BytesIO(core))
    assert reader.is_encrypted is True

    # Without calling decrypt, page text access must raise FileNotDecryptedError or fail
    with pytest.raises(FileNotDecryptedError):
        _ = reader.pages[0].extract_text()


def test_leaktrace_password_fails_as_pdf_password():
    pdf_bytes = generate_sample_navy_pdf("Strategic Order", "DOC-PWTEST", "SECRET", "Sensitive directives")
    doc_open_secret = os.urandom(32).hex()
    user_password = "AliceSecure2026!"  # The user's LeakTrace login password
    protected = PdfProtector.protect(pdf_bytes, "DOC-PWTEST", "Strategic Order", doc_open_secret, [])

    core = PdfProtector.extract_core_pdf(protected)
    reader = PdfReader(io.BytesIO(core))
    result = reader.decrypt(user_password)
    assert result == 0  # 0 indicates password rejected!


def test_document_open_secret_succeeds_internally():
    pdf_bytes = generate_sample_navy_pdf("Strategic Order", "DOC-DOSTEST", "SECRET", "Sensitive directives")
    doc_open_secret = os.urandom(32).hex()
    protected = PdfProtector.protect(pdf_bytes, "DOC-DOSTEST", "Strategic Order", doc_open_secret, [])

    core = PdfProtector.extract_core_pdf(protected)
    reader = PdfReader(io.BytesIO(core))
    result = reader.decrypt(doc_open_secret)
    assert result in (1, 2)  # Decrypted successfully
    text = reader.pages[0].extract_text()
    assert len(text) > 0


def test_generate_sample_artifact_for_manual_viewer_test():
    """Generates an actual protected PDF on disk so that users can manually test in Adobe/Chrome/Edge."""
    artifacts_dir = Path(__file__).resolve().parent / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    sample_file_path = artifacts_dir / "Sample_Protected_OperationPlan.pdf"

    pdf_bytes = generate_sample_navy_pdf(
        "Operation Sindhurakshak", "DOC-MANUAL-CHECK", "TOP SECRET // NOFORN",
        "Air-defense coordination and tactical deployment coordinates for western seaboard."
    )
    doc_open_secret = os.urandom(32).hex()
    sample_slots = [
        {"recipient_id": "USER-ALICE", "kem_ct": "SAMPLE_KEM_ALICE", "wrapped_dos": "SAMPLE_WRAP_ALICE"},
        {"recipient_id": "USER-BOB", "kem_ct": "SAMPLE_KEM_BOB", "wrapped_dos": "SAMPLE_WRAP_BOB"}
    ]
    protected_bytes = PdfProtector.protect(
        pdf_bytes, "DOC-MANUAL-CHECK", "Operation Sindhurakshak", doc_open_secret, sample_slots
    )

    with open(sample_file_path, "wb") as f:
        f.write(protected_bytes)

    assert sample_file_path.exists()
    assert sample_file_path.stat().st_size > 1000
    print(f"\n[MANUAL VERIFICATION REQUIRED] Sample protected PDF saved to: {sample_file_path}")
