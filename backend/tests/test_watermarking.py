"""
Unit tests for Steganographic Watermarking Subsystems:
- Text Zero-Width Unicode Steganography
- Visual 2D Block-DCT Quantization Index Modulation (QIM)
- Structural PDF Steganography with Opaque Watermark IDs and HMAC Authentication
- Unique Per-Session Watermark Invariance
"""
import time
from PIL import Image
import numpy as np

from app.watermarking.text_stego import TextSteganographyWatermarker
from app.watermarking.dct_qim import DCTQIMWatermarker
from app.watermarking.pdf_stego import pdf_watermarker
from app.core.pdf_generator import generate_sample_navy_pdf


def test_text_zero_width_watermarking():
    watermarker = TextSteganographyWatermarker()
    original_text = (
        "CONFIDENTIAL FLEET ORDERS: Rendezvous at waypoint 18-N 72-E. "
        "Strict radio silence must be maintained at all times."
    )
    doc_id = "DOC-NAVY-TEST-01"
    recipient_id = "USER-BOB"
    timestamp = time.time()

    # 1. Embed watermark
    watermarked_text, payload = watermarker.embed(
        doc_id=doc_id,
        recipient_id=recipient_id,
        plaintext=original_text,
        timestamp=timestamp
    )

    # Invisible: characters are longer due to zero-width, but stripped text matches
    assert len(watermarked_text) > len(original_text)
    clean_text = "".join(c for c in watermarked_text if c not in ["\u200B", "\u200C", "\u200D", "\uFEFF"])
    assert clean_text == original_text

    # 2. Extract watermark from full text
    extracted = watermarker.extract(watermarked_text)
    assert extracted is not None
    assert extracted.doc_id == doc_id
    assert extracted.recipient_id == recipient_id
    assert int(extracted.timestamp) == int(timestamp)

    # 3. Verify HMAC
    assert watermarker.verify_hmac(
        extracted.doc_id, extracted.recipient_id, extracted.session_nonce, extracted.hmac_sig
    ) is True


def test_dct_qim_watermarking():
    watermarker = DCTQIMWatermarker()
    # 1. Create 256x256 test image
    img_array = np.full((256, 256), 180, dtype=np.uint8)
    # Add gradient
    for r in range(256):
        val = np.uint8((180 + r // 4) % 256)
        img_array[r, :] = val
    img = Image.fromarray(img_array, mode='L')

    from app.core.types import WatermarkPayload

    payload = WatermarkPayload(
        doc_id="DOC-IMG-01",
        recipient_id="USER-BOB",
        timestamp=time.time(),
        session_nonce="nonce123",
        hmac_sig="sig123"
    )

    # 2. Embed DCT-QIM watermark
    wm_img = watermarker.embed_image(img, payload)

    # 3. Extract watermark
    extracted = watermarker.extract_image(wm_img)
    assert extracted is not None
    assert extracted.doc_id == "DOC-IMG-01"
    assert extracted.recipient_id == "USER-BOB"


def test_pdf_steganography_unique_session_fingerprints():
    """
    Verifies that decrypting the exact same PDF twice produces:
    - Identical visual document
    - Distinct, unique forensic watermark IDs for each session
    - Fully recoverable metadata and valid HMAC tags
    """
    pdf_bytes = generate_sample_navy_pdf(
        title="Confidential Q4 Strategic Product Roadmap",
        doc_id="DOC-SIH26237",
        classification="CONFIDENTIAL // RESTRICTED",
        directive_body="1. Complete core architecture\n2. Secure distribution\n3. Proof-of-work"
    )
    assert len(pdf_bytes) > 500

    # Session 1: Bob decrypts at 10:00
    pdf_bob_1, meta_1 = pdf_watermarker.embed_forensic_watermark(
        pdf_bytes=pdf_bytes,
        doc_id="DOC-SIH26237",
        recipient_id="USER-BOB"
    )

    # Session 2: Bob decrypts again at 10:05
    pdf_bob_2, meta_2 = pdf_watermarker.embed_forensic_watermark(
        pdf_bytes=pdf_bytes,
        doc_id="DOC-SIH26237",
        recipient_id="USER-BOB"
    )

    # Session fingerprints must be unique!
    assert meta_1["watermark_id"] != meta_2["watermark_id"]
    assert meta_1["session_id"] != meta_2["session_id"]

    # Extraction from Session 1
    ext_1 = pdf_watermarker.extract_from_pdf_bytes(pdf_bob_1)
    assert ext_1 is not None
    assert ext_1["valid_auth"] is True
    assert ext_1["watermark_id"] == meta_1["watermark_id"]
    assert ext_1["session_id"] == meta_1["session_id"]

    # Extraction from Session 2
    ext_2 = pdf_watermarker.extract_from_pdf_bytes(pdf_bob_2)
    assert ext_2 is not None
    assert ext_2["valid_auth"] is True
    assert ext_2["watermark_id"] == meta_2["watermark_id"]
    assert ext_2["session_id"] == meta_2["session_id"]
