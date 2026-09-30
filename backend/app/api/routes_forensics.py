"""
Forensic Attribution & Leak Investigation API Routes.
Provides endpoints for analyzing suspected leaked documents (text and visual artifacts),
extracting hidden steganographic watermarks, and identifying leakers with mathematical proof.
"""
from typing import Optional
import io
import base64
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from PIL import Image

from app.core.types import ForensicAttributionResult, WatermarkPayload
from app.forensics.attribution_engine import forensic_engine
from app.watermarking.dct_qim import DCTQIMWatermarker

router = APIRouter(prefix="/api/forensics", tags=["Forensic Investigation"])

dct_watermarker = DCTQIMWatermarker()


class TextLeakRequest(BaseModel):
    leaked_text: str = Field(..., description="Suspected leaked text snippet, memo, or excerpt")


class ImageWatermarkRequest(BaseModel):
    doc_id: str
    recipient_id: str
    image_base64: str


@router.post("/analyze-text", response_model=ForensicAttributionResult)
def analyze_text_leak(req: TextLeakRequest):
    """
    Scans a leaked text excerpt for hidden zero-width steganographic Unicode markers,
    extracts the attribution payload, verifies HMAC, and matches with the blockchain ledger.
    """
    if not req.leaked_text.strip():
        raise HTTPException(status_code=400, detail="Leaked text snippet cannot be empty.")

    result = forensic_engine.investigate_text_leak(req.leaked_text)
    return result


@router.post("/analyze-pdf", response_model=ForensicAttributionResult)
async def analyze_pdf_leak(file: UploadFile = File(...)):
    """
    Extracts forensic watermark embedded in an uploaded leaked PDF file,
    validates cryptographic integrity, and traces leaker via the blockchain ledger.
    """
    from app.watermarking.pdf_stego import pdf_watermarker
    try:
        pdf_bytes = await file.read()
        payload = pdf_watermarker.extract_from_pdf_bytes(pdf_bytes)
        if not payload:
            return ForensicAttributionResult(
                is_attributed=False,
                confidence_score=0.0,
                evidence_type="NONE",
                forensic_summary="No valid NISHAN-PQ cryptographic forensic watermark detected in the uploaded PDF file."
            )
        return forensic_engine._attribute_payload(payload, evidence_type="PDF_STRUCTURAL_CARRIER")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF forensic analysis failed: {str(e)}")


@router.post("/analyze-image", response_model=ForensicAttributionResult)
async def analyze_image_leak(file: UploadFile = File(...)):
    """
    Scans an uploaded image, screenshot, or scan for frequency-domain DCT-QIM watermarks,
    extracts attribution payload, and proves officer identity via Merkle blockchain.
    """
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        result = forensic_engine.investigate_image_leak(image)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image forensic processing failed: {str(e)}")


@router.post("/analyze-image-base64", response_model=ForensicAttributionResult)
def analyze_image_leak_base64(payload: dict):
    """
    Scans base64 image data for frequency-domain DCT-QIM watermarks.
    """
    b64_data = payload.get("image_base64")
    if not b64_data:
        raise HTTPException(status_code=400, detail="Missing image_base64 field.")

    try:
        # Strip data URL prefix if present
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        raw_bytes = base64.b64decode(b64_data)
        image = Image.open(io.BytesIO(raw_bytes))
        result = forensic_engine.investigate_image_leak(image)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Base64 image forensic analysis failed: {str(e)}")


@router.post("/watermark-image")
def watermark_image_endpoint(req: ImageWatermarkRequest):
    """
    Utility endpoint to embed a DCT-QIM watermark into an image for testing screenshot/crop attacks.
    Returns watermarked image in base64.
    """
    try:
        b64_data = req.image_base64
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        raw_bytes = base64.b64decode(b64_data)
        image = Image.open(io.BytesIO(raw_bytes))

        watermarked_img, wm_payload = dct_watermarker.embed(
            doc_id=req.doc_id,
            recipient_id=req.recipient_id,
            image=image
        )

        buf = io.BytesIO()
        watermarked_img.save(buf, format="PNG")
        encoded_result = base64.b64encode(buf.getvalue()).decode("utf-8")

        return {
            "status": "success",
            "watermarked_image_base64": f"data:image/png;base64,{encoded_result}",
            "watermark_payload": wm_payload
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to watermark image: {str(e)}")
