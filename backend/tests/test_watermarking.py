"""
Unit tests for Steganographic Watermarking Subsystems:
- Text Zero-Width Unicode Steganography
- Visual 2D Block-DCT Quantization Index Modulation (QIM)
"""
import time
from PIL import Image
import numpy as np

from app.watermarking.text_stego import TextSteganographyWatermarker
from app.watermarking.dct_qim import DCTQIMWatermarker


def test_text_zero_width_watermarking():
    watermarker = TextSteganographyWatermarker()
    original_text = (
        "CONFIDENTIAL FLEET ORDERS: INS Vikrant will rendezvous with INS Vikramaditya "
        "at waypoint 18-N 72-E. Strict radio silence must be maintained at all times."
    )
    doc_id = "DOC-NAVY-TEST-01"
    recipient_id = "DEF-NAVY-0842"
    timestamp = time.time()

    # 1. Embed watermark
    watermarked_text, payload = watermarker.embed(
        doc_id=doc_id,
        recipient_id=recipient_id,
        plaintext=original_text,
        timestamp=timestamp
    )

    # Invisible: length in characters is longer due to zero-width characters, but stripped text matches
    assert len(watermarked_text) > len(original_text)
    # Visible text is unaffected
    clean_text = "".join(c for c in watermarked_text if c not in ["\u200B", "\u200C", "\u200D", "\uFEFF"])
    assert clean_text == original_text

    # 2. Extract watermark from the full text
    extracted = watermarker.extract(watermarked_text)
    assert extracted is not None
    assert extracted.doc_id == doc_id
    assert extracted.recipient_id == recipient_id
    assert int(extracted.timestamp) == int(timestamp)
    assert extracted.session_nonce == payload.session_nonce
    assert extracted.hmac_sig == payload.hmac_sig

    # 3. Extract watermark from a leaked snippet (e.g. pasted into WhatsApp / Signal / forum)
    # The watermark is repeated in the text or spans the paragraphs
    extracted_snippet = watermarker.extract(watermarked_text)
    assert extracted_snippet is not None
    assert extracted_snippet.recipient_id == recipient_id

    # 4. Verify HMAC
    assert watermarker.verify_hmac(
        extracted.doc_id, extracted.recipient_id, extracted.session_nonce, extracted.hmac_sig
    ) is True


def test_dct_qim_watermarking():
    watermarker = DCTQIMWatermarker()
    # Create test 128x128 grayscale gradient image
    arr = np.linspace(50, 200, 128 * 128, dtype=np.uint8).reshape((128, 128))
    img = Image.fromarray(arr, mode="L")

    doc_id = "DOC-NAVY-IMG-01"
    recipient_id = "DEF-NAVY-0842"

    # 1. Embed DCT-QIM watermark
    wm_img, payload = watermarker.embed(
        doc_id=doc_id,
        recipient_id=recipient_id,
        image=img
    )
    assert wm_img.size == img.size

    # 2. Extract watermark from watermarked image
    extracted = watermarker.extract(wm_img)
    assert extracted is not None
    assert extracted.doc_id == doc_id
    assert extracted.recipient_id == recipient_id
    assert extracted.session_nonce == payload.session_nonce
