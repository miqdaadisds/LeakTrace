"""
Argon2id Password-Protected Encrypted Credential Vault.
Derives a 256-bit key from the recipient's password using memory-hard Argon2id,
and encrypts the recipient's private keys (Classical X25519, NIST ML-KEM-768, and NIST ML-DSA-65)
at rest using authenticated AES-256-GCM.
The password and plaintext private keys are never transmitted to the backend or sender.
"""
from typing import Dict, Any, Tuple
import os
import json
import base64
from argon2.low_level import hash_secret_raw, Type
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class InvalidCredentialsError(Exception):
    """Raised when password verification fails or ciphertext is tampered."""
    pass


class EncryptedCredentialVault:
    TIME_COST = 2
    MEMORY_COST = 65536  # 64 MB
    PARALLELISM = 4
    HASH_LEN = 32        # 256-bit key for AES-GCM
    SALT_LEN = 16

    @classmethod
    def derive_key(cls, password: str, salt: bytes) -> bytes:
        """Derives a 256-bit symmetric key from password via Argon2id."""
        return hash_secret_raw(
            secret=password.encode("utf-8"),
            salt=salt,
            time_cost=cls.TIME_COST,
            memory_cost=cls.MEMORY_COST,
            parallelism=cls.PARALLELISM,
            hash_len=cls.HASH_LEN,
            type=Type.ID
        )

    @classmethod
    def create_vault(
        cls,
        password: str,
        priv_kem_classical: bytes,
        priv_kem_pqc: bytes,
        priv_sig: bytes,
        extra_metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Encrypts private keys into a portable vault dict using password-derived Argon2id key.
        """
        salt = os.urandom(cls.SALT_LEN)
        derived_key = cls.derive_key(password, salt)
        nonce = os.urandom(12)

        vault_payload = {
            "priv_kem_classical_b64": base64.b64encode(priv_kem_classical).decode("utf-8"),
            "priv_kem_pqc_b64": base64.b64encode(priv_kem_pqc).decode("utf-8"),
            "priv_sig_b64": base64.b64encode(priv_sig).decode("utf-8"),
            "metadata": extra_metadata or {}
        }
        plaintext_bytes = json.dumps(vault_payload).encode("utf-8")

        aesgcm = AESGCM(derived_key)
        aad = b"NISHAN-PQ-VAULT-v1"
        ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, aad)

        return {
            "format": "NISHAN-PQ-VAULT-v1",
            "kdf": "Argon2id",
            "time_cost": cls.TIME_COST,
            "memory_cost": cls.MEMORY_COST,
            "parallelism": cls.PARALLELISM,
            "salt_b64": base64.b64encode(salt).decode("utf-8"),
            "nonce_b64": base64.b64encode(nonce).decode("utf-8"),
            "ciphertext_b64": base64.b64encode(ciphertext).decode("utf-8")
        }

    @classmethod
    def unlock_vault(cls, password: str, vault_dict: Dict[str, Any]) -> Tuple[bytes, bytes, bytes, Dict[str, Any]]:
        """
        Unlocks the vault with password.
        Returns: (priv_kem_classical, priv_kem_pqc, priv_sig, metadata)
        Raises: InvalidCredentialsError if password is wrong or vault is corrupted.
        """
        try:
            salt = base64.b64decode(vault_dict["salt_b64"])
            nonce = base64.b64decode(vault_dict["nonce_b64"])
            ciphertext = base64.b64decode(vault_dict["ciphertext_b64"])

            derived_key = cls.derive_key(password, salt)
            aesgcm = AESGCM(derived_key)
            aad = b"NISHAN-PQ-VAULT-v1"

            decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, aad)
            payload = json.loads(decrypted_bytes.decode("utf-8"))

            priv_classical = base64.b64decode(payload["priv_kem_classical_b64"])
            priv_pqc = base64.b64decode(payload["priv_kem_pqc_b64"])
            priv_sig = base64.b64decode(payload["priv_sig_b64"])
            metadata = payload.get("metadata", {})

            return priv_classical, priv_pqc, priv_sig, metadata
        except Exception as e:
            raise InvalidCredentialsError("Decryption Denied: Invalid password or corrupted credential vault.") from e
