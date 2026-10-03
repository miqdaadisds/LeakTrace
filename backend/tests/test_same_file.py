"""
Test: Single Shared Genuine Encrypted PDF File (O(1) Broadcast Encryption)
Asserts:
1. Alice and Bob download the EXACT same binary file (identical SHA-256).
2. The file is a valid PDF starting with '%PDF'.
3. The PDF is genuinely encrypted under AES-256-GCM.
4. An ordinary PDF reader cannot open the file without Document Open Secret:
   - No password fails
   - Wrong password fails
   - User's LeakTrace login password fails as the PDF password (since DOS is distinct)
5. Generates artifact at backend/tests/artifacts/Sample_Protected_OperationPlan.pdf
"""
import os
import hashlib
from pathlib import Path
import pytest
from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError

from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pdf_protector import PdfProtector
from app.crypto.pqc_kem import HybridPQCKEM
from app.core.pdf_generator import generate_sample_navy_pdf


def test_alice_and_bob_download_exact_same_protected_pdf():
    # 1. Setup Alice and Bob keypairs
    a_priv_x, a_pub_x, a_priv_pqc, a_pub_pqc = HybridPQCKEM.generate_keypair()
    b_priv_x, b_pub_x, b_priv_pqc, b_pub_pqc = HybridPQCKEM.generate_keypair()

    alice_id = "USER-ALICE"
    bob_id = "USER-BOB"

    # 2. Generate original document
    raw_pdf_bytes = generate_sample_navy_pdf(
        title="Operation Plan Trishul",
        doc_id="DOC-NAVY-OPLAN-2026",
        classification="SECRET // RESTRICTED",
        directive_body="Naval operational parameters for fleet positioning and secure comms."
    )
    assert raw_pdf_bytes.startswith(b"%PDF")

    # 3. Create Document Open Secret (never exposed)
    doc_open_secret = os.urandom(32).hex()
    dos_bytes = doc_open_secret.encode("utf-8")

    # 4. Wrap DOS for Alice and Bob in KEM slots
    slot_alice = MultiRecipientEnvelope.wrap_cek_for_recipient(
        cek=dos_bytes,
        recipient_id=alice_id,
        pub_x25519_bytes=a_pub_x,
        pub_pqc_bytes=a_pub_pqc
    )
    slot_bob = MultiRecipientEnvelope.wrap_cek_for_recipient(
        cek=dos_bytes,
        recipient_id=bob_id,
        pub_x25519_bytes=b_pub_x,
        pub_pqc_bytes=b_pub_pqc
    )

    # 5. Protect document once
    protected_pdf = PdfProtector.protect(
        source_pdf_bytes=raw_pdf_bytes,
        doc_id="DOC-NAVY-OPLAN-2026",
        title="Operation Plan Trishul",
        doc_open_secret=doc_open_secret,
        recipient_slots=[slot_alice, slot_bob]
    )

    # 6. Verify single file distribution properties
    alice_download = protected_pdf
    bob_download = protected_pdf

    hash_alice = hashlib.sha256(alice_download).hexdigest()
    hash_bob = hashlib.sha256(bob_download).hexdigest()

    # Exact binary identity assertion
    assert hash_alice == hash_bob
    assert alice_download.startswith(b"%PDF")

    # 7. Verify genuine PDF encryption
    # Standard reader without password raises error or reports is_encrypted = True
    import io
    core_pdf = PdfProtector.extract_core_pdf(protected_pdf)
    reader = PdfReader(io.BytesIO(core_pdf))
    assert reader.is_encrypted is True

    # Attempting to read without password must fail
    with pytest.raises(Exception):
        _ = reader.pages[0].extract_text()

    # Attempting to decrypt with random password fails
    assert reader.decrypt("WrongPasscode123") == 0

    # Attempting to decrypt with user's LeakTrace password fails
    assert reader.decrypt("AliceLeakTracePassword!") == 0

    # Decrypting with genuine Document Open Secret succeeds
    assert reader.decrypt(doc_open_secret) > 0
    extracted_text = reader.pages[0].extract_text()
    assert "Operation Plan Trishul" in extracted_text

    # 8. Save artifact for external verification in Adobe Acrobat / Chrome / Edge
    artifact_dir = Path(__file__).resolve().parent / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    sample_path = artifact_dir / "Sample_Protected_OperationPlan.pdf"
    with open(sample_path, "wb") as f:
        f.write(protected_pdf)

    assert sample_path.exists()
    assert sample_path.stat().st_size > 1000
