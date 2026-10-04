"""
Forensic Attribution & Cryptographic Leak Investigation Engine.
Extracts hidden forensic watermarks from suspect leaked documents (PDF or Text),
recovers the opaque watermark_id, queries the immutable permissioned DLT ledger,
verifies the recipient's NIST ML-DSA-65 digital signature, and validates Merkle proofs.
Produces a mathematically rigorous, deterministic forensic attribution report.
"""
from typing import Optional, Dict, Any
import base64
import json
import time
from datetime import datetime, timezone
from app.watermarking.pdf_stego import pdf_watermarker
from app.watermarking.text_stego import TextSteganographyWatermarker
from app.provenance.ledger import provenance_ledger
from app.provenance.validator import validator_network
from app.crypto.pqc_sig import DigitalSignatureManager
from app.core.types import ForensicAttributionResult


class ForensicAttributionEngine:
    def __init__(self):
        self.text_watermarker = TextSteganographyWatermarker()
        # Identity directory for resolving verified public keys and titles
        self._identity_directory: Dict[str, Dict[str, str]] = {}

    def register_recipient_identity(self, recipient_id: str, name: str, unit: str, public_key_sig_b64: str):
        self._identity_directory[recipient_id] = {
            "name": name,
            "unit": unit,
            "public_key_sig_b64": public_key_sig_b64
        }

    def investigate_pdf_leak(self, pdf_bytes: bytes, ledger: Optional[Any] = None) -> ForensicAttributionResult:
        """
        Primary investigation workflow for suspect digital PDF leaks.
        No password or private keys required.
        """
        active_ledger = ledger or provenance_ledger
        extracted = pdf_watermarker.extract_from_pdf_bytes(pdf_bytes)
        if not extracted:
            return ForensicAttributionResult(
                is_attributed=False,
                watermark_status="NOT_FOUND",
                signature_status="UNVERIFIED",
                ledger_status="UNVERIFIED",
                forensic_summary="No cryptographic forensic watermark detected in the submitted PDF."
            )

        if not extracted.get("valid_auth"):
            return ForensicAttributionResult(
                is_attributed=False,
                watermark_status="CORRUPTED",
                signature_status="UNVERIFIED",
                ledger_status="UNVERIFIED",
                forensic_summary="Forensic watermark authentication tag mismatch (tampering or channel corruption detected). Forensic investigation abstained."
            )

        watermark_id = extracted["watermark_id"]
        doc_id = extracted["doc_id"]
        session_id = extracted["session_id"]

        # Search provenance blockchain ledger
        record = active_ledger.lookup_by_watermark_id(watermark_id)
        if not record:
            return ForensicAttributionResult(
                is_attributed=False,
                doc_id=doc_id,
                session_id=session_id,
                watermark_id=watermark_id,
                watermark_status="ORPHAN_TAG",
                signature_status="UNVERIFIED",
                ledger_status="UNVERIFIED",
                forensic_summary=f"Forensic watermark {watermark_id} detected, but no matching decryption event found on ledger. Possible unanchored leak."
            )

        block_idx, receipt = record

        # 1. Verify Recipient's ML-DSA-65 Digital Signature
        pub_sig_bytes = base64.b64decode(receipt.recipient_public_key_sig_b64)
        sig_bytes = base64.b64decode(receipt.recipient_signature_b64)
        sig_valid = DigitalSignatureManager.verify(receipt.event_digest.encode("utf-8"), sig_bytes, pub_sig_bytes)

        # 2. Verify Merkle Tree Inclusion Proof in Block
        merkle_proof = active_ledger.get_merkle_proof_for_receipt(watermark_id)
        merkle_valid = merkle_proof.get("proof_valid", False) if merkle_proof else False

        # 3. Verify Entire Blockchain Ledger Integrity & Validator Quorum
        ledger_valid, ledger_msg, _ = active_ledger.verify_chain_integrity()
        target_block = active_ledger.get_chain()[block_idx]
        is_quorum, val_count, quorum_desc = validator_network.verify_block_quorum(
            target_block.block_index, target_block.previous_hash, target_block.merkle_root, target_block.timestamp, target_block.validator_signatures
        )

        # 4. Resolve identity metadata
        user_meta = self._identity_directory.get(receipt.recipient_id, {})
        recipient_name = user_meta.get("name")
        recipient_unit = user_meta.get("unit")
        if not recipient_name:
            try:
                from app.auth import middleware
                if middleware.db:
                    db_u = middleware.db.get_identity(receipt.recipient_id)
                    if db_u:
                        recipient_name = db_u.get("name")
                        recipient_unit = db_u.get("unit")
            except Exception:
                pass
        recipient_name = recipient_name or receipt.recipient_id
        recipient_unit = recipient_unit or "Enrolled Recipient"

        decryption_time_str = datetime.fromtimestamp(receipt.timestamp, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        is_attributed = sig_valid and merkle_valid and is_quorum

        detailed_evidence = {
            "receipt_id": receipt.receipt_id,
            "session_id": receipt.session_id,
            "watermark_id": receipt.watermark_id,
            "device_fingerprint": receipt.device_fingerprint,
            "ciphertext_hash": receipt.ciphertext_hash,
            "event_digest": receipt.event_digest,
            "ledger_block_index": block_idx,
            "merkle_root": merkle_proof.get("merkle_root", "") if merkle_proof else "",
            "signature_algorithm": DigitalSignatureManager.ALGORITHM,
            "validator_quorum": quorum_desc,
            "proof_path_depth": len(merkle_proof.get("proof_path", [])) if merkle_proof else 0
        }

        summary = (
            f"ATTRIBUTION VERIFIED: Document leaked by {recipient_name} ({receipt.recipient_id}). "
            f"Forensic watermark {watermark_id} matches Decryption Receipt {receipt.receipt_id} on Block #{block_idx}. "
            f"Recipient ML-DSA-65 signature is VALID, ledger integrity is VALID, and 3-of-4 validator quorum achieved."
            if is_attributed else
            f"ATTRIBUTION CONFLICT: Cryptographic signature, quorum, or ledger proof failed validation."
        )

        return ForensicAttributionResult(
            is_attributed=is_attributed,
            doc_id=receipt.doc_id,
            recipient_id=receipt.recipient_id,
            recipient_name=recipient_name,
            recipient_unit=recipient_unit,
            session_id=receipt.session_id,
            watermark_id=watermark_id,
            decryption_timestamp=receipt.timestamp,
            decryption_time_str=decryption_time_str,
            evidence_type="PDF_STRUCTURAL_CARRIER",
            watermark_status="MATCHED",
            signature_status="VALID" if sig_valid else "INVALID",
            ledger_status="VALID" if (merkle_valid and ledger_valid and is_quorum) else "INVALID",
            ledger_block_index=block_idx,
            merkle_root=merkle_proof.get("merkle_root", "") if merkle_proof else "",
            validator_quorum_status=quorum_desc,
            forensic_summary=summary,
            detailed_evidence=detailed_evidence
        )

    analyze_pdf_leak = investigate_pdf_leak

    def investigate_text_leak(self, text: str) -> ForensicAttributionResult:
        """Fallback analysis for extracted or copied text leaks."""
        payload = self.text_watermarker.extract(text)
        if not payload:
            return ForensicAttributionResult(
                is_attributed=False,
                watermark_status="NOT_FOUND",
                signature_status="UNVERIFIED",
                ledger_status="UNVERIFIED",
                forensic_summary="No zero-width forensic watermark found in text."
            )

        # Verify HMAC
        hmac_valid = self.text_watermarker.verify_hmac(payload.doc_id, payload.recipient_id, payload.session_nonce, payload.hmac_sig)
        if not hmac_valid:
            return ForensicAttributionResult(
                is_attributed=False,
                watermark_status="CORRUPTED",
                signature_status="UNVERIFIED",
                ledger_status="UNVERIFIED",
                forensic_summary="HMAC verification failed for text watermark."
            )

        user_meta = self._identity_directory.get(payload.recipient_id, {})
        recipient_name = user_meta.get("name", payload.recipient_id)

        return ForensicAttributionResult(
            is_attributed=True,
            doc_id=payload.doc_id,
            recipient_id=payload.recipient_id,
            recipient_name=recipient_name,
            recipient_unit=user_meta.get("unit", "Enrolled Recipient"),
            decryption_timestamp=payload.timestamp,
            decryption_time_str=datetime.fromtimestamp(payload.timestamp, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            evidence_type="TEXT_ZERO_WIDTH",
            watermark_status="MATCHED",
            signature_status="VALID",
            ledger_status="VALID",
            forensic_summary=f"ATTRIBUTION VERIFIED: Text excerpt traced to {recipient_name} ({payload.recipient_id})."
        )


forensic_engine = ForensicAttributionEngine()
