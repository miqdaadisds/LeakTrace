"""
Post-Quantum Key Encapsulation Mechanism (PQC KEM).
Implements NIST FIPS 203 ML-KEM-768 (Kyber-768) and Hybrid ML-KEM-768 + X25519.
Uses real lattice-based cryptography via pqcrypto.kem.ml_kem_768.
Guarantees quantum-resistance against 'Harvest Now, Decrypt Later' adversaries.
"""
from typing import Tuple
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from pqcrypto.kem import ml_kem_768


class HybridPQCKEM:
    """
    NIST FIPS 203 ML-KEM-768 + Classical X25519 Hybrid Key Encapsulation Mechanism.
    Combines lattice-based PQC with Diffie-Hellman to guarantee security even if
    one of the underlying mathematical primitives is compromised.
    """
    ALGORITHM = "ML-KEM-768 + X25519 (Hybrid FIPS 203)"
    PQC_ALGORITHM = "ML-KEM-768"

    @staticmethod
    def generate_keypair() -> Tuple[bytes, bytes, bytes, bytes]:
        """
        Generates (priv_x25519, pub_x25519, priv_pqc, pub_pqc) keys.
        - X25519: 32 bytes priv, 32 bytes pub
        - ML-KEM-768: 2400 bytes priv, 1184 bytes pub
        """
        # 1. Classical X25519
        x25519_sk = x25519.X25519PrivateKey.generate()
        x25519_pk = x25519_sk.public_key()
        
        # 2. Genuine NIST FIPS 203 ML-KEM-768
        pqc_pk, pqc_sk = ml_kem_768.keygen()

        return (
            x25519_sk.private_bytes_raw(),
            x25519_pk.public_bytes_raw(),
            bytes(pqc_sk),
            bytes(pqc_pk)
        )

    @staticmethod
    def encapsulate(pub_x25519_bytes: bytes, pub_pqc_bytes: bytes) -> Tuple[bytes, bytes]:
        """
        Encapsulates a hybrid 256-bit symmetric shared secret to recipient's public keys.
        Returns: (shared_secret_32bytes, kem_ciphertext_bytes)
        kem_ciphertext = Ephemeral X25519 PK (32b) + ML-KEM-768 CT (1088b) = 1120 bytes.
        """
        # 1. Classical ephemeral X25519 ECDH
        ephemeral_sk = x25519.X25519PrivateKey.generate()
        ephemeral_pk = ephemeral_sk.public_key().public_bytes_raw()
        
        recipient_x25519_pk = x25519.X25519PublicKey.from_public_bytes(pub_x25519_bytes)
        classical_secret = ephemeral_sk.exchange(recipient_x25519_pk)

        # 2. Genuine ML-KEM-768 Encapsulation
        pqc_ciphertext, pqc_secret = ml_kem_768.encaps(pub_pqc_bytes)

        # 3. Hybrid Key Derivation Function (HKDF-SHA256)
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"SIH26237-NIST-ML-KEM-768-HYBRID-SALT",
            info=b"ML-KEM-768+X25519-DERIVATION-v1"
        )
        combined_secret = hkdf.derive(classical_secret + bytes(pqc_secret))

        # KEM Ciphertext = Ephemeral X25519 PK (32b) + ML-KEM-768 Ciphertext (1088b)
        kem_ciphertext = ephemeral_pk + bytes(pqc_ciphertext)

        return combined_secret, kem_ciphertext

    @staticmethod
    def decapsulate(priv_x25519_bytes: bytes, priv_pqc_bytes: bytes, kem_ciphertext: bytes) -> bytes:
        """
        Decapsulates hybrid shared secret using recipient's private keys.
        """
        if len(kem_ciphertext) < 32 + 1088:
            raise ValueError(f"Invalid KEM ciphertext length: {len(kem_ciphertext)} (expected >= 1120)")

        ephemeral_pk_bytes = kem_ciphertext[:32]
        pqc_ciphertext = kem_ciphertext[32:32 + 1088]

        # 1. Classical ECDH recovery
        sk = x25519.X25519PrivateKey.from_private_bytes(priv_x25519_bytes)
        ephemeral_pk = x25519.X25519PublicKey.from_public_bytes(ephemeral_pk_bytes)
        classical_secret = sk.exchange(ephemeral_pk)

        # 2. Genuine ML-KEM-768 Decapsulation
        pqc_secret = ml_kem_768.decaps(priv_pqc_bytes, pqc_ciphertext)

        # 3. Hybrid derivation
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"SIH26237-NIST-ML-KEM-768-HYBRID-SALT",
            info=b"ML-KEM-768+X25519-DERIVATION-v1"
        )
        return hkdf.derive(classical_secret + bytes(pqc_secret))
