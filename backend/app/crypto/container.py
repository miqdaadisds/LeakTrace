"""
Secure Document Container (.secure) Subsystem.
Implements the portable, self-contained single-file container for recipient distribution.
Contains the single-ciphertext AES-256-GCM encrypted document, the recipient-specific
ML-KEM wrapped CEK, the Argon2id-encrypted private credential vault, and document metadata.
Requires ONLY this file and the recipient's password to decrypt locally.
"""
from typing import Dict, Any
import json
import base64
import hashlib
import hmac


class SecureContainerFormat:
    MAGIC_HEADER = "NISHAN-SECURE-PKG-v1"
    VERSION = "1.0.0"

    @classmethod
    def pack(
        cls,
        doc_id: str,
        title: str,
        original_filename: str,
        classification: str,
        doc_hash_sha256: str,
        recipient_id: str,
        recipient_name: str,
        recipient_public_kem_b64: str,
        recipient_public_sig_b64: str,
        encrypted_vault: Dict[str, Any],
        wrapped_cek: Dict[str, Any],
        encrypted_payload: Dict[str, Any],
        created_at: float = None
    ) -> Dict[str, Any]:
        """
        Packs document envelope into the recipient-specific portable container structure.
        """
        import time
        created_ts = created_at if created_at is not None else time.time()

        package = {
            "magic": cls.MAGIC_HEADER,
            "version": cls.VERSION,
            "created_at": created_ts,
            "document": {
                "doc_id": doc_id,
                "title": title,
                "original_filename": original_filename,
                "classification": classification,
                "doc_hash_sha256": doc_hash_sha256,
            },
            "recipient": {
                "recipient_id": recipient_id,
                "name": recipient_name,
                "public_key_pqc_b64": recipient_public_kem_b64,
                "public_key_sig_b64": recipient_public_sig_b64,
            },
            "vault": encrypted_vault,
            "key_exchange": wrapped_cek,
            "payload": encrypted_payload
        }

        # Calculate container integrity digest
        canonical_bytes = json.dumps(package, sort_keys=True).encode("utf-8")
        package["integrity_sha256"] = hashlib.sha256(canonical_bytes).hexdigest()

        return package

    @classmethod
    def serialize_to_bytes(cls, package: Dict[str, Any]) -> bytes:
        """Serializes package dict to UTF-8 encoded formatted JSON bytes."""
        return json.dumps(package, indent=2, sort_keys=True).encode("utf-8")

    @classmethod
    def deserialize_from_bytes(cls, package_bytes: bytes) -> Dict[str, Any]:
        """
        Deserializes package bytes and validates container structure and integrity.
        """
        try:
            package = json.loads(package_bytes.decode("utf-8"))
        except Exception as e:
            raise ValueError("Invalid .secure file format: not valid JSON.") from e

        if package.get("magic") != cls.MAGIC_HEADER:
            raise ValueError(f"Invalid package header: {package.get('magic')} (expected {cls.MAGIC_HEADER})")

        # Verify integrity
        recorded_hash = package.get("integrity_sha256")
        if recorded_hash:
            package_copy = dict(package)
            del package_copy["integrity_sha256"]
            canonical_bytes = json.dumps(package_copy, sort_keys=True).encode("utf-8")
            expected_hash = hashlib.sha256(canonical_bytes).hexdigest()
            if not hmac.compare_digest(recorded_hash, expected_hash):
                raise ValueError("Container integrity check failed: file has been modified or corrupted.")

        return package
