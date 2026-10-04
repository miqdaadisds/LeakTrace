"""
Local Recipient Client Decryption Engine.
Executes client-side on the recipient's computer (cross-device, air-gapped capable).
Performs local Argon2id vault unlock, ML-KEM-768 decapsulation, AES-256-GCM Document Open
Secret recovery, genuine PDF decryption, session forensic watermarking, and NIST ML-DSA-65
digital signature generation.
Guarantees that password, private keys, and plaintext documents NEVER leave the recipient's device.
"""
from typing import Dict, Any
import time
import uuid
import json
import base64
import hashlib
from app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.pdf_protector import PdfProtector
from app.watermarking.pdf_stego import pdf_watermarker
from app.core.types import DecryptionProvenanceReceipt


class LocalDecryptionResult:
    def __init__(
        self,
        watermarked_pdf_bytes: bytes,
        receipt: DecryptionProvenanceReceipt,
        watermark_metadata: Dict[str, Any],
        doc_info: Dict[str, Any],
        recipient_info: Dict[str, Any]
    ):
        self.watermarked_pdf_bytes = watermarked_pdf_bytes
        self.receipt = receipt
        self.watermark_metadata = watermark_metadata
        self.doc_info = doc_info
        self.recipient_info = recipient_info

    def to_dict(self) -> Dict[str, Any]:
        return {
            "receipt": self.receipt.model_dump(),
            "watermark_metadata": self.watermark_metadata,
            "doc_info": self.doc_info,
            "recipient_info": self.recipient_info,
            "pdf_byte_size": len(self.watermarked_pdf_bytes)
        }


class LocalRecipientDecryptor:
    @classmethod
    def decrypt_protected_pdf(
        cls,
        protected_pdf_bytes: bytes,
        recipient_id: str,
        password: str,
        encrypted_vault: dict,
        public_key_sig_b64: str = "",
        device_fingerprint: str = None
    ) -> LocalDecryptionResult:
        """
        Full v1.1 decryption pipeline for genuine encrypted PDF.

        Pipeline:
        1. Read recipient slots from PDF trailer (raw bytes, no password)
        2. Find matching slot for this recipient
        3. Unlock local Argon2id vault with password
        4. ML-KEM decapsulate to recover shared secret
        5. AES-GCM decrypt the wrapped Document Open Secret
        6. Verify trailer integrity (HMAC derived from DOS)
        7. Extract core encrypted PDF bytes
        8. Decrypt PDF content using Document Open Secret
        9. Generate fresh session ID + watermark ID
        10. Embed invisible forensic watermark
        11. Create canonical provenance event
        12. Sign event with recipient's ML-DSA-65 private key
        13. Clear private keys from memory
        14. Return result
        """
        dev_fp = device_fingerprint or f"WORKSTATION-{recipient_id}-SECURE-ENCLAVE"

        # 1. Read trailer slots (no password needed)
        slots_data = PdfProtector.read_slots(protected_pdf_bytes)
        if slots_data is None:
            raise ValueError("Not a TraceLeak protected PDF: no recipient trailer found")

        doc_id = slots_data.get("doc_id", "UNKNOWN")
        title = slots_data.get("title", "")

        # 2. Find matching recipient slot
        recipients = slots_data.get("recipients", [])
        my_slot = None
        target_clean = str(recipient_id).strip()
        target_upper = target_clean.upper()
        target_norm = f"USER-{target_upper.replace(' ', '_')}"
        target_variants = {target_clean, target_upper, target_norm, target_upper.replace("USER-", "")}

        for slot in recipients:
            slot_id = str(slot.get("recipient_id", "")).strip()
            slot_upper = slot_id.upper()
            if slot_id in target_variants or slot_upper in target_variants:
                my_slot = slot
                break

        if my_slot is None:
            raise PermissionError(f"Recipient {recipient_id} is not authorized for this document")

        # 3. Unlock vault with password (raises InvalidCredentialsError if wrong)
        priv_classical, priv_pqc, priv_sig, _ = EncryptedCredentialVault.unlock_vault(
            password, encrypted_vault
        )

        # 4. ML-KEM decapsulate to recover shared secret, then unwrap Document Open Secret
        # The slot contains the same structure as MultiRecipientEnvelope.wrap_cek_for_recipient output
        # We reuse unwrap_cek which does ML-KEM decap + AES-GCM unwrap
        dos_bytes = MultiRecipientEnvelope.unwrap_cek(my_slot, priv_classical, priv_pqc)
        doc_open_secret = dos_bytes.decode("utf-8")

        # 5. Verify trailer integrity
        start_marker = b"%%LEAKTRACE_SLOTS_V2%%\n"
        end_marker = b"\n%%LEAKTRACE_SLOTS_END%%\n"
        start_idx = protected_pdf_bytes.rfind(start_marker)
        end_idx = protected_pdf_bytes.rfind(end_marker)
        trailer_content = protected_pdf_bytes[start_idx + len(start_marker):end_idx]
        last_newline = trailer_content.rfind(b"\n")
        slots_json_bytes = trailer_content[:last_newline]
        hmac_hex = trailer_content[last_newline + 1:].decode("utf-8")

        if not PdfProtector.verify_trailer_integrity(slots_json_bytes, hmac_hex, doc_open_secret):
            raise ValueError("Trailer integrity verification failed: possible tampering detected")

        # 6. Extract core PDF and decrypt
        core_pdf_bytes = PdfProtector.extract_core_pdf(protected_pdf_bytes)
        raw_pdf_bytes = PdfProtector.decrypt_pdf(core_pdf_bytes, doc_open_secret)

        # 7. Generate dynamic session fingerprint
        now = time.time()
        session_id = f"SESS-{uuid.uuid4().hex[:12].upper()}"
        watermark_id = f"WM-{uuid.uuid4().hex[:16].upper()}"

        # 8. Embed invisible forensic watermark into decrypted PDF
        watermarked_pdf_bytes, wm_meta = pdf_watermarker.embed_forensic_watermark(
            pdf_bytes=raw_pdf_bytes,
            doc_id=doc_id,
            recipient_id=recipient_id,
            session_id=session_id,
            watermark_id=watermark_id,
            timestamp=now
        )

        # 9. Construct deterministic provenance event
        receipt_id = f"RCPT-{uuid.uuid4().hex[:12].upper()}"
        doc_hash = hashlib.sha256(protected_pdf_bytes).hexdigest()
        canonical_event_data = {
            "receipt_id": receipt_id,
            "doc_id": doc_id,
            "recipient_id": recipient_id,
            "session_id": session_id,
            "watermark_id": watermark_id,
            "ciphertext_hash": doc_hash,
            "timestamp": now,
            "device_fingerprint": dev_fp,
            "recipient_public_key_sig_b64": public_key_sig_b64
        }
        canonical_event_bytes = json.dumps(canonical_event_data, sort_keys=True).encode("utf-8")
        event_digest = hashlib.sha256(canonical_event_bytes).hexdigest()

        # 10. Sign event digest with recipient's ML-DSA-65 private key
        sig_bytes = DigitalSignatureManager.sign(event_digest.encode("utf-8"), priv_sig)
        recipient_sig_b64 = base64.b64encode(sig_bytes).decode("utf-8")

        # 11. Clear private keys from memory as far as practical
        priv_classical = b'\x00' * len(priv_classical) if priv_classical else b''
        priv_pqc = b'\x00' * len(priv_pqc) if priv_pqc else b''
        priv_sig = b'\x00' * len(priv_sig) if priv_sig else b''

        # 12. Assemble completed receipt
        receipt = DecryptionProvenanceReceipt(
            receipt_id=receipt_id,
            doc_id=doc_id,
            recipient_id=recipient_id,
            session_id=session_id,
            watermark_id=watermark_id,
            ciphertext_hash=doc_hash,
            timestamp=now,
            device_fingerprint=dev_fp,
            recipient_signature_b64=recipient_sig_b64,
            recipient_public_key_sig_b64=public_key_sig_b64,
            event_digest=event_digest
        )

        return LocalDecryptionResult(
            watermarked_pdf_bytes=watermarked_pdf_bytes,
            receipt=receipt,
            watermark_metadata=wm_meta,
            doc_info={"doc_id": doc_id, "title": title},
            recipient_info={"recipient_id": recipient_id}
        )
