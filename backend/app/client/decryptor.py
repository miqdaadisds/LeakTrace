"""
Local Recipient Client Decryption Engine.
Executes client-side on the recipient's computer (cross-device, air-gapped capable).
Performs local Argon2id vault unlock, ML-KEM-768 decapsulation, AES-256-GCM decryption,
session forensic watermarking, and NIST ML-DSA-65 digital signature generation.
Guarantees that password, private keys, CEK, and plaintext documents NEVER leave the recipient's device.
"""
from typing import Dict, Any, Tuple, Optional
import time
import uuid
import json
import base64
import hashlib
from app.crypto.container import SecureContainerFormat
from app.crypto.vault import EncryptedCredentialVault, InvalidCredentialsError
from app.crypto.envelope import MultiRecipientEnvelope
from app.crypto.pqc_sig import DigitalSignatureManager
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
    def decrypt_secure_package(
        cls,
        package_input: Any, # Dict or bytes
        password: str,
        device_fingerprint: str = None
    ) -> LocalDecryptionResult:
        """
        Locally opens and decrypts a .secure package file.
        Step 1: Unlocks Argon2id credential vault with password.
        Step 2: Recovers recipient's ML-KEM and ML-DSA private keys.
        Step 3: Decapsulates ML-KEM shared secret and unwraps AES-256 CEK.
        Step 4: Decrypts AES-256-GCM document bytes.
        Step 5: Injects dynamic invisible forensic watermark (tied to recipient + session).
        Step 6: Digitally signs the provenance receipt with recipient's ML-DSA-65 private key.
        """
        # Parse container if serialized
        if isinstance(package_input, bytes):
            package = SecureContainerFormat.deserialize_from_bytes(package_input)
        elif isinstance(package_input, dict):
            package = package_input
        else:
            raise ValueError("package_input must be bytes or dict.")

        doc_info = package.get("document", {})
        recipient_info = package.get("recipient", {})
        recipient_id = recipient_info.get("recipient_id", "UNKNOWN")
        doc_id = doc_info.get("doc_id", "UNKNOWN")
        dev_fp = device_fingerprint or f"WORKSTATION-{recipient_id}-SECURE-ENCLAVE"

        # 1. Unlock Vault with recipient's password (raises InvalidCredentialsError if wrong)
        vault_dict = package.get("vault", {})
        priv_classical, priv_pqc, priv_sig, _ = EncryptedCredentialVault.unlock_vault(password, vault_dict)

        # 2. Unwrap CEK via ML-KEM-768 decapsulation
        key_exchange_dict = package.get("key_exchange", {})
        cek = MultiRecipientEnvelope.unwrap_cek(key_exchange_dict, priv_classical, priv_pqc)

        # 3. Decrypt single AES-256-GCM ciphertext
        payload_dict = package.get("payload", {})
        raw_pdf_bytes = MultiRecipientEnvelope.decrypt_document_bytes(payload_dict, cek)

        # 4. Generate dynamic session fingerprint
        now = time.time()
        session_id = f"SESS-{uuid.uuid4().hex[:12].upper()}"
        watermark_id = f"WM-{uuid.uuid4().hex[:16].upper()}"

        # 5. Embed dynamic invisible forensic watermark into PDF
        watermarked_pdf_bytes, wm_meta = pdf_watermarker.embed_forensic_watermark(
            pdf_bytes=raw_pdf_bytes,
            doc_id=doc_id,
            recipient_id=recipient_id,
            session_id=session_id,
            watermark_id=watermark_id,
            timestamp=now
        )

        # 6. Construct deterministic provenance event without signature
        receipt_id = f"RCPT-{uuid.uuid4().hex[:12].upper()}"
        canonical_event_data = {
            "receipt_id": receipt_id,
            "doc_id": doc_id,
            "recipient_id": recipient_id,
            "session_id": session_id,
            "watermark_id": watermark_id,
            "ciphertext_hash": payload_dict.get("doc_hash_sha256", ""),
            "timestamp": now,
            "device_fingerprint": dev_fp,
            "recipient_public_key_sig_b64": recipient_info.get("public_key_sig_b64", "")
        }
        canonical_event_bytes = json.dumps(canonical_event_data, sort_keys=True).encode("utf-8")
        event_digest = hashlib.sha256(canonical_event_bytes).hexdigest()

        # 7. Sign event digest with recipient's ML-DSA-65 private key
        sig_bytes = DigitalSignatureManager.sign(event_digest.encode("utf-8"), priv_sig)
        recipient_sig_b64 = base64.b64encode(sig_bytes).decode("utf-8")

        # 8. Assemble completed receipt
        receipt = DecryptionProvenanceReceipt(
            receipt_id=receipt_id,
            doc_id=doc_id,
            recipient_id=recipient_id,
            session_id=session_id,
            watermark_id=watermark_id,
            ciphertext_hash=payload_dict.get("doc_hash_sha256", ""),
            timestamp=now,
            device_fingerprint=dev_fp,
            recipient_signature_b64=recipient_sig_b64,
            recipient_public_key_sig_b64=recipient_info.get("public_key_sig_b64", ""),
            event_digest=event_digest
        )

        return LocalDecryptionResult(
            watermarked_pdf_bytes=watermarked_pdf_bytes,
            receipt=receipt,
            watermark_metadata=wm_meta,
            doc_info=doc_info,
            recipient_info=recipient_info
        )
