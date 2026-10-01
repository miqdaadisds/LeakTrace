"""
Digital Signature Subsystem (NIST FIPS 204 ML-DSA-65 & Ed25519).
Provides non-repudiation for Decryption Provenance Receipts using genuine
post-quantum lattice digital signatures (Dilithium-3 / ML-DSA-65).
"""
from typing import Tuple
from pqcrypto.sign import ml_dsa_65
from cryptography.hazmat.primitives.asymmetric import ed25519


class DigitalSignatureManager:
    ALGORITHM = "ML-DSA-65 (NIST FIPS 204)"

    @staticmethod
    def generate_keypair() -> Tuple[bytes, bytes]:
        """
        Generates genuine NIST FIPS 204 ML-DSA-65 (private_key_bytes, public_key_bytes).
        - Private Key (ssk): 4032 bytes
        - Public Key (spk): 1952 bytes
        """
        spk, ssk = ml_dsa_65.keygen()
        return bytes(ssk), bytes(spk)

    @staticmethod
    def sign(message_bytes: bytes, private_key_bytes: bytes) -> bytes:
        """
        Signs message bytes using recipient's ML-DSA-65 private key.
        Produces a 3309-byte post-quantum digital signature.
        """
        sig = ml_dsa_65.sign(private_key_bytes, message_bytes)
        return bytes(sig)

    @staticmethod
    def verify(message_bytes: bytes, signature_bytes: bytes, public_key_bytes: bytes) -> bool:
        """
        Verifies ML-DSA-65 digital signature against public key.
        Returns True if mathematically valid, False otherwise.
        """
        try:
            ml_dsa_65.verify(public_key_bytes, message_bytes, signature_bytes)
            return True
        except Exception:
            return False


class ClassicalEd25519Manager:
    """Retained for backward compatibility with classical receipt verification."""
    @staticmethod
    def generate_keypair() -> Tuple[bytes, bytes]:
        sk = ed25519.Ed25519PrivateKey.generate()
        pk = sk.public_key()
        return sk.private_bytes_raw(), pk.public_bytes_raw()

    @staticmethod
    def sign(message_bytes: bytes, private_key_bytes: bytes) -> bytes:
        sk = ed25519.Ed25519PrivateKey.from_private_bytes(private_key_bytes)
        return sk.sign(message_bytes)

    @staticmethod
    def verify(message_bytes: bytes, signature_bytes: bytes, public_key_bytes: bytes) -> bool:
        try:
            pk = ed25519.Ed25519PublicKey.from_public_bytes(public_key_bytes)
            pk.verify(signature_bytes, message_bytes)
            return True
        except Exception:
            return False
