"""
Digital Signature Subsystem (Ed25519 & ML-DSA-65 interface).
Provides non-repudiation for Decryption Provenance Receipts.
"""
from typing import Tuple
from cryptography.hazmat.primitives.asymmetric import ed25519
import hashlib


class DigitalSignatureManager:
    @staticmethod
    def generate_keypair() -> Tuple[bytes, bytes]:
        """Generates (private_key_bytes, public_key_bytes)."""
        sk = ed25519.Ed25519PrivateKey.generate()
        pk = sk.public_key()
        return sk.private_bytes_raw(), pk.public_bytes_raw()

    @staticmethod
    def sign(message_bytes: bytes, private_key_bytes: bytes) -> bytes:
        """Signs a message using the recipient's private key."""
        sk = ed25519.Ed25519PrivateKey.from_private_bytes(private_key_bytes)
        return sk.sign(message_bytes)

    @staticmethod
    def verify(message_bytes: bytes, signature_bytes: bytes, public_key_bytes: bytes) -> bool:
        """Verifies a digital signature against the public key."""
        try:
            pk = ed25519.Ed25519PublicKey.from_public_bytes(public_key_bytes)
            pk.verify(signature_bytes, message_bytes)
            return True
        except Exception:
            return False
