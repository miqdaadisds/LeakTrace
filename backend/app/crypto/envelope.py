"""
Multi-Recipient Envelope Encryption Subsystem.
Encrypts document binary payload ONCE using AES-256-GCM, and encapsulates the Content
Encryption Key (CEK) independently for each recipient using NIST FIPS 203 ML-KEM-768 Hybrid KEM.
Guarantees O(1) document storage overhead and independent post-quantum recipient decapsulation.
"""
from typing import Dict, Any, List, Tuple
import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.crypto.pqc_kem import HybridPQCKEM


class MultiRecipientEnvelope:
    @staticmethod
    def encrypt_document_bytes(
        document_bytes: bytes,
        doc_id: str,
        title: str,
        classification: str,
        publisher_id: str
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Encrypts document bytes ONCE using AES-256-GCM.
        Returns: (cek_bytes, encrypted_payload_dict)
        """
        cek = AESGCM.generate_key(bit_length=256)
        nonce = os.urandom(12)
        doc_hash = hashlib.sha256(document_bytes).hexdigest()

        aad = f"DOC:{doc_id}|HASH:{doc_hash}|CLASS:{classification}|PUB:{publisher_id}".encode("utf-8")

        aesgcm = AESGCM(cek)
        ciphertext_with_tag = aesgcm.encrypt(nonce, document_bytes, aad)

        ciphertext = ciphertext_with_tag[:-16]
        tag = ciphertext_with_tag[-16:]

        payload_dict = {
            "ciphertext_b64": base64.b64encode(ciphertext).decode("utf-8"),
            "nonce_b64": base64.b64encode(nonce).decode("utf-8"),
            "tag_b64": base64.b64encode(tag).decode("utf-8"),
            "aad": aad.decode("utf-8"),
            "doc_hash_sha256": doc_hash,
            "byte_size": len(document_bytes)
        }

        return cek, payload_dict

    @staticmethod
    def wrap_cek_for_recipient(
        cek: bytes,
        recipient_id: str,
        pub_x25519_bytes: bytes,
        pub_pqc_bytes: bytes
    ) -> Dict[str, Any]:
        """
        Wraps the CEK for a specific recipient using their ML-KEM-768 + X25519 public keys.
        """
        shared_secret, kem_ciphertext = HybridPQCKEM.encapsulate(pub_x25519_bytes, pub_pqc_bytes)

        wrap_nonce = os.urandom(12)
        wrap_aesgcm = AESGCM(shared_secret)
        wrap_aad = f"WRAP-CEK:{recipient_id}".encode("utf-8")
        wrapped_cek_with_tag = wrap_aesgcm.encrypt(wrap_nonce, cek, wrap_aad)

        wrapped_cek = wrapped_cek_with_tag[:-16]
        tag = wrapped_cek_with_tag[-16:]

        return {
            "recipient_id": recipient_id,
            "kem_ciphertext_b64": base64.b64encode(kem_ciphertext).decode("utf-8"),
            "wrapped_cek_b64": base64.b64encode(wrapped_cek).decode("utf-8"),
            "wrap_nonce_b64": base64.b64encode(wrap_nonce).decode("utf-8"),
            "tag_b64": base64.b64encode(tag).decode("utf-8")
        }

    @staticmethod
    def unwrap_cek(
        wrap_dict: Dict[str, Any],
        priv_x25519_bytes: bytes,
        priv_pqc_bytes: bytes
    ) -> bytes:
        """
        Decapsulates ML-KEM-768 shared secret and unwraps the AES-256 CEK.
        """
        kem_ciphertext = base64.b64decode(wrap_dict["kem_ciphertext_b64"])
        wrapped_cek = base64.b64decode(wrap_dict["wrapped_cek_b64"])
        wrap_nonce = base64.b64decode(wrap_dict["wrap_nonce_b64"])
        tag = base64.b64decode(wrap_dict["tag_b64"])
        recipient_id = wrap_dict["recipient_id"]

        # 1. Recover shared secret via ML-KEM-768 hybrid decapsulation
        shared_secret = HybridPQCKEM.decapsulate(priv_x25519_bytes, priv_pqc_bytes, kem_ciphertext)

        # 2. Decrypt wrapped CEK
        wrap_aesgcm = AESGCM(shared_secret)
        wrap_aad = f"WRAP-CEK:{recipient_id}".encode("utf-8")
        cek = wrap_aesgcm.decrypt(wrap_nonce, wrapped_cek + tag, wrap_aad)

        return cek

    @staticmethod
    def decrypt_document_bytes(
        encrypted_payload: Dict[str, Any],
        cek: bytes
    ) -> bytes:
        """
        Decrypts the single AES-256-GCM encrypted document bytes using the unwrapped CEK.
        """
        ciphertext = base64.b64decode(encrypted_payload["ciphertext_b64"])
        nonce = base64.b64decode(encrypted_payload["nonce_b64"])
        tag = base64.b64decode(encrypted_payload["tag_b64"])
        aad = encrypted_payload["aad"].encode("utf-8")

        aesgcm = AESGCM(cek)
        return aesgcm.decrypt(nonce, ciphertext + tag, aad)
