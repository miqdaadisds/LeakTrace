"""
Multi-Recipient Envelope Encryption Subsystem.
Encrypts document payload ONCE using AES-256-GCM, and encapsulates the Content
Encryption Key (CEK) independently for N authorized recipients using Hybrid PQC KEM.
"""
from typing import List, Tuple
import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.crypto.pqc_kem import HybridPQCKEM
from app.core.types import EncryptedKeyWrap, EncryptedDocumentPackage, RecipientProfile


class MultiRecipientEnvelope:
    @staticmethod
    def encrypt_document(
        doc_id: str,
        title: str,
        plaintext: str,
        classification: str,
        publisher_id: str,
        recipients: List[RecipientProfile]
    ) -> EncryptedDocumentPackage:
        """
        Encrypts document once with AES-256-GCM and wraps CEK for all N recipients.
        """
        # 1. Generate 256-bit CEK and 96-bit nonce
        cek = AESGCM.generate_key(bit_length=256)
        nonce = os.urandom(12)
        
        aad = f"DOC:{doc_id}|PUB:{publisher_id}|CLASS:{classification}".encode("utf-8")
        plaintext_bytes = plaintext.encode("utf-8")

        # 2. Encrypt payload
        aesgcm = AESGCM(cek)
        ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, aad)

        doc_hash = hashlib.sha256(plaintext_bytes).hexdigest()

        # 3. Encapsulate CEK for each recipient
        recipient_wraps: List[EncryptedKeyWrap] = []
        for r in recipients:
            pub_x25519 = base64.b64decode(r.public_key_x25519_b64)
            pub_pqc = base64.b64decode(r.public_key_pqc_b64)

            # Hybrid KEM encapsulation
            shared_secret, kem_ciphertext = HybridPQCKEM.encapsulate(pub_x25519, pub_pqc)

            # Wrap CEK with AES-GCM using shared secret
            wrap_nonce = os.urandom(12)
            wrap_aesgcm = AESGCM(shared_secret)
            wrapped_cek_with_tag = wrap_aesgcm.encrypt(wrap_nonce, cek, f"WRAP:{r.recipient_id}".encode("utf-8"))
            
            wrapped_cek = wrapped_cek_with_tag[:-16]
            tag = wrapped_cek_with_tag[-16:]

            recipient_wraps.append(EncryptedKeyWrap(
                recipient_id=r.recipient_id,
                encapsulated_key_b64=base64.b64encode(wrap_nonce + kem_ciphertext).decode("utf-8"),
                wrapped_cek_b64=base64.b64encode(wrapped_cek).decode("utf-8"),
                tag_b64=base64.b64encode(tag).decode("utf-8")
            ))

        return EncryptedDocumentPackage(
            doc_id=doc_id,
            title=title,
            classification=classification,
            publisher_id=publisher_id,
            ciphertext_b64=base64.b64encode(ciphertext).decode("utf-8"),
            nonce_b64=base64.b64encode(nonce).decode("utf-8"),
            aad=aad.decode("utf-8"),
            recipient_wraps=recipient_wraps,
            doc_hash_sha256=doc_hash
        )

    @staticmethod
    def decrypt_document(
        package: EncryptedDocumentPackage,
        recipient_id: str,
        priv_x25519_bytes: bytes,
        priv_pqc_bytes: bytes
    ) -> str:
        """
        Decapsulates CEK for recipient and decrypts AES-256-GCM document payload.
        """
        # Find recipient wrap
        wrap = next((w for w in package.recipient_wraps if w.recipient_id == recipient_id), None)
        if not wrap:
            raise PermissionError(f"Recipient {recipient_id} not authorized in document envelope.")

        # Unpack KEM ciphertext and wrap nonce
        encap_blob = base64.b64decode(wrap.encapsulated_key_b64)
        wrap_nonce = encap_blob[:12]
        kem_ciphertext = encap_blob[12:]

        # 1. Decapsulate Hybrid shared secret
        shared_secret = HybridPQCKEM.decapsulate(priv_x25519_bytes, priv_pqc_bytes, kem_ciphertext)

        # 2. Unwrap CEK
        wrapped_cek = base64.b64decode(wrap.wrapped_cek_b64)
        tag = base64.b64decode(wrap.tag_b64)
        
        wrap_aesgcm = AESGCM(shared_secret)
        cek = wrap_aesgcm.decrypt(wrap_nonce, wrapped_cek + tag, f"WRAP:{recipient_id}".encode("utf-8"))

        # 3. Decrypt document payload
        nonce = base64.b64decode(package.nonce_b64)
        ciphertext = base64.b64decode(package.ciphertext_b64)
        aad = package.aad.encode("utf-8")

        payload_aesgcm = AESGCM(cek)
        plaintext_bytes = payload_aesgcm.decrypt(nonce, ciphertext, aad)

        return plaintext_bytes.decode("utf-8")
