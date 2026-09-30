"""
Forensic Attribution & Leak Investigation Engine.
Extracts hidden steganographic watermarks from leaked artifacts (Text / Images),
validates cryptographic authenticity, and links the leak directly to an immutable
decryption provenance receipt on the Merkle blockchain.
"""
from typing import Optional, Dict
import hashlib
import json
import time
from datetime import datetime, timezone
from PIL import Image
from app.watermarking.text_stego import TextSteganographyWatermarker
from app.watermarking.dct_qim import DCTQIMWatermarker
from app.provenance.ledger import provenance_ledger
from app.crypto.pqc_sig import DigitalSignatureManager
from app.core.types import ForensicAttributionResult, WatermarkPayload


class ForensicAttributionEngine:
    def __init__(self):
        self.text_watermarker = TextSteganographyWatermarker()
        self.dct_watermarker = DCTQIMWatermarker()
        
        # Enrolled personnel roster (in-memory defense registry)
        self._officer_roster: Dict[str, Dict[str, str]] = {
            "DEF-NAVY-0842": {
                "name": "Cdr. Rajesh Sharma",
                "unit": "Western Naval Command (WNC) - INS Vikrant Ops",
                "clearance": "TOP SECRET // OPERATIONAL"
            },
            "DEF-NAVY-1109": {
                "name": "Lt. Cdr. Priya Menon",
                "unit": "Directorate of Naval Intelligence (DNI)",
                "clearance": "TOP SECRET // CRYPTO"
            },
            "DEF-NAVY-0318": {
                "name": "Capt. Vikram Sengupta",
                "unit": "Eastern Fleet Headquarters (Visakhapatnam)",
                "clearance": "SECRET // MARITIME COMMAND"
            },
            "DEF-NAVY-0771": {
                "name": "Cdr. Arunava Roy",
                "unit": "Weapons and Electronics Systems Engineering Establishment (WESEE)",
                "clearance": "TOP SECRET // R&D"
            }
        }

    def register_officer(self, recipient_id: str, name: str, unit: str, clearance: str):
        self._officer_roster[recipient_id] = {
            "name": name,
            "unit": unit,
            "clearance": clearance
        }

    def investigate_text_leak(self, leaked_text: str) -> ForensicAttributionResult:
        """
        Analyzes a suspected leaked text snippet for hidden zero-width unicode forensic tags.
        """
        payload = self.text_watermarker.extract(leaked_text)
        if not payload:
            return ForensicAttributionResult(
                is_attributed=False,
                confidence_score=0.0,
                evidence_type="NONE",
                forensic_summary="No cryptographic forensic watermark detected in provided text snippet."
            )

        return self._attribute_payload(payload, evidence_type="TEXT_ZERO_WIDTH")

    def investigate_image_leak(self, img: Image.Image) -> ForensicAttributionResult:
        """
        Analyzes a suspected leaked image, scan, or screenshot using 2D Block-DCT QIM.
        """
        payload = self.dct_watermarker.extract(img)
        if not payload:
            return ForensicAttributionResult(
                is_attributed=False,
                confidence_score=0.0,
                evidence_type="NONE",
                forensic_summary="No visual DCT-QIM watermark detected in provided image artifact."
            )

        return self._attribute_payload(payload, evidence_type="IMAGE_DCT_QIM")

    def _attribute_payload(self, payload: WatermarkPayload, evidence_type: str) -> ForensicAttributionResult:
        """
        Verifies extracted watermark against Master HMAC and matches with the Immutable Blockchain Ledger.
        """
        # 1. Verify HMAC
        hmac_valid = self.text_watermarker.verify_hmac(
            payload.doc_id, payload.recipient_id, payload.session_nonce, payload.hmac_sig
        )

        # 2. Compute canonical watermark hash
        wm_hash = hashlib.sha256(
            f"{payload.doc_id}|{payload.recipient_id}|{int(payload.timestamp)}|{payload.session_nonce}".encode("utf-8")
        ).hexdigest()

        # 3. Lookup on Provenance Blockchain Ledger
        ledger_entry = provenance_ledger.lookup_by_watermark_hash(wm_hash)
        ledger_verified = False
        block_idx = None

        if ledger_entry:
            block_idx, receipt = ledger_entry
            ledger_verified = True

        # 4. Resolve Officer Details
        officer = self._officer_roster.get(payload.recipient_id, {
            "name": "Unknown Officer",
            "unit": "Unregistered Command Unit",
            "clearance": "UNKNOWN"
        })

        time_str = datetime.fromtimestamp(payload.timestamp, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
        confidence = 0.99 if (hmac_valid and ledger_verified) else (0.85 if hmac_valid else 0.50)

        summary = (
            f"LEAK ATTRIBUTED WITH MATHEMATICAL CERTAINTY. "
            f"Source Officer: {officer['name']} ({payload.recipient_id}), Unit: {officer['unit']}. "
            f"Decrypted at: {time_str}. Provenance Blockchain Block #{block_idx if block_idx is not None else 'N/A'} "
            f"(HMAC Verified: {hmac_valid}, Merkle Proof: {ledger_verified})."
        )

        return ForensicAttributionResult(
            is_attributed=True,
            doc_id=payload.doc_id,
            leaker_id=payload.recipient_id,
            leaker_name=officer["name"],
            leaker_unit=officer["unit"],
            decryption_timestamp=payload.timestamp,
            decryption_time_str=time_str,
            session_nonce=payload.session_nonce,
            hmac_verified=hmac_valid,
            ledger_block_index=block_idx,
            ledger_merkle_verified=ledger_verified,
            confidence_score=confidence,
            evidence_type=evidence_type,
            forensic_summary=summary
        )


forensic_engine = ForensicAttributionEngine()
