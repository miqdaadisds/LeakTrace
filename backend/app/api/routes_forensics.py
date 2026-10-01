"""
Forensic Attribution & Leak Investigation API Routes.
Provides endpoints for uploading and analyzing suspected leaked documents (real PDF files or text),
extracting the invisible forensic watermark, matching with the blockchain ledger,
and verifying the recipient's ML-DSA-65 digital signature and Merkle inclusion proofs.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

from app.core.types import ForensicAttributionResult
from app.forensics.attribution_engine import forensic_engine

router = APIRouter(prefix="/api/forensics", tags=["Forensic Investigation"])


class TextLeakRequest(BaseModel):
    leaked_text: str = Field(..., description="Suspected leaked text snippet or excerpt")


@router.post("/analyze-pdf", response_model=ForensicAttributionResult)
async def analyze_pdf_leak(file: UploadFile = File(...)):
    """
    Primary Forensic Endpoint:
    Accepts an uploaded leaked PDF file (e.g. LEAKED_DOCUMENT.pdf).
    Extracts the opaque forensic watermark, queries the immutable blockchain ledger,
    verifies the recipient's ML-DSA-65 digital signature, and validates the Merkle block proof.
    Requires NO passwords and NO private keys.
    """
    try:
        pdf_bytes = await file.read()
        if not pdf_bytes or len(pdf_bytes) < 10:
            raise HTTPException(status_code=400, detail="Uploaded file is empty or invalid.")

        result = forensic_engine.investigate_pdf_leak(pdf_bytes)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF forensic analysis failed: {str(e)}")


@router.post("/analyze-text", response_model=ForensicAttributionResult)
def analyze_text_leak(req: TextLeakRequest):
    """
    Analyzes an excerpt of leaked text for zero-width steganographic Unicode markers.
    """
    if not req.leaked_text.strip():
        raise HTTPException(status_code=400, detail="Leaked text cannot be empty.")
    return forensic_engine.investigate_text_leak(req.leaked_text)
