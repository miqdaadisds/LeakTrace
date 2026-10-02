try:
    from backend.app.db.database import Database
except ImportError:
    pass

db = None
"""
Application State & Cryptographic Identity Directory for NISHAN-PQ (SIH26237).
Maintains registered recipient public profiles (Alice, Bob, Charlie), their Argon2id encrypted
credential vaults, active document packages, and cached .secure files.
Plaintext private keys and user passphrases are NEVER stored in the system state.
"""
from typing import Dict, List, Optional, Any
import base64
import hashlib
from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.vault import EncryptedCredentialVault
from app.crypto.envelope import MultiRecipientEnvelope
from app.core.types import RecipientProfile
from app.core.pdf_generator import generate_sample_navy_pdf
from app.forensics.attribution_engine import forensic_engine
from app.provenance.ledger import provenance_ledger


class RegisteredIdentity:
    def __init__(
        self,
        recipient_id: str,
        name: str,
        unit: str,
        pub_x25519: bytes,
        pub_pqc: bytes,
        pub_sig: bytes,
        encrypted_vault: Dict[str, Any],
        role: str = 'recipient',
        recovery_key_hash: str = None
    ):
        self.recipient_id = recipient_id
        self.name = name
        self.unit = unit
        self.pub_x25519_bytes = pub_x25519
        self.pub_pqc_bytes = pub_pqc
        self.pub_sig_bytes = pub_sig
        self.pub_x25519_b64 = base64.b64encode(pub_x25519).decode("utf-8")
        self.pub_pqc_b64 = base64.b64encode(pub_pqc).decode("utf-8")
        self.pub_sig_b64 = base64.b64encode(pub_sig).decode("utf-8")
        self.encrypted_vault = encrypted_vault
        self.role = role
        self.recovery_key_hash = recovery_key_hash

        # Compute public key SHA-256 fingerprint
        combined_pub = pub_x25519 + pub_pqc + pub_sig
        self.fingerprint = hashlib.sha256(combined_pub).hexdigest()[:16].upper()

    def to_profile(self) -> RecipientProfile:
        return RecipientProfile(
            recipient_id=self.recipient_id,
            name=self.name,
            unit=self.unit,
            public_key_x25519_b64=self.pub_x25519_b64,
            public_key_pqc_b64=self.pub_pqc_b64,
            public_key_sig_b64=self.pub_sig_b64,
            fingerprint=self.fingerprint,
            role=self.role,
            approved=(self.role != 'pending'),
            recovery_key_hash=self.recovery_key_hash
        )


class SystemState:
    def __init__(self):
        self.identities: Dict[str, RegisteredIdentity] = {}
        # doc_id -> raw PDF bytes
        self.original_pdfs: Dict[str, bytes] = {}
        # doc_id -> metadata
        self.document_metadata: Dict[str, Dict[str, Any]] = {}
        # doc_id -> protected PDF bytes
        self.protected_pdfs: Dict[str, bytes] = {}
        self.secure_packages: Dict[str, bytes] = {}
        # Revocation registry for access control and certificate revocation
        self.revoked_identities: Dict[str, Dict[str, Any]] = {}
        self.revoked_documents: Dict[str, Dict[str, Any]] = {}
        # Air-gapped offline provenance receipt queue
        self.offline_receipt_store: Dict[str, DecryptionProvenanceReceipt] = {} # receipt_id -> receipt
        # Pre-seed identities and sample document
        self._initialize_seed_identities()
        self._initialize_seed_distribution()

    def revoke_identity(self, recipient_id: str, reason: str = "Key compromise or clearance revoked") -> Dict[str, Any]:
        info = {
            "recipient_id": recipient_id,
            "revoked_at": 1727712000.0,
            "reason": reason
        }
        self.revoked_identities[recipient_id] = info
        return info

    def unrevoke_identity(self, recipient_id: str) -> bool:
        if recipient_id in self.revoked_identities:
            del self.revoked_identities[recipient_id]
            return True
        return False

    def revoke_document(self, doc_id: str, reason: str = "Distribution retracted") -> Dict[str, Any]:
        info = {
            "doc_id": doc_id,
            "revoked_at": 1727712000.0,
            "reason": reason
        }
        self.revoked_documents[doc_id] = info
        return info

    def is_identity_revoked(self, recipient_id: str) -> bool:
        return recipient_id in self.revoked_identities

    def is_document_revoked(self, doc_id: str) -> bool:
        return doc_id in self.revoked_documents

    def _initialize_seed_identities(self):
        """
        Pre-seeds registered identities for Alice, Bob, and Charlie.
        Each recipient has genuine ML-KEM-768 and ML-DSA-65 key pairs.
        Their private keys are encrypted into Argon2id vaults with strong passwords.
        """
        specs = [
            (
                "USER-ALICE",
                "Alice",
                "Engineering Architecture Lead",
                "AliceSecure2026!"
            ),
            (
                "USER-BOB",
                "Bob",
                "Product Operations & Strategy",
                "BobSecure2026!"
            ),
            (
                "USER-CHARLIE",
                "Charlie",
                "Cryptographic Security Specialist",
                "CharlieSecure2026!"
            ),
        ]

        for r_id, name, unit, password in specs:
            priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
            priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()

            # Encrypt private keys locally into vault
            vault = EncryptedCredentialVault.create_vault(
                password=password,
                priv_kem_classical=priv_x,
                priv_kem_pqc=priv_pqc,
                priv_sig=priv_sig,
                extra_metadata={"recipient_id": r_id, "name": name}
            )

            identity = RegisteredIdentity(
                recipient_id=r_id,
                name=name,
                unit=unit,
                role='recipient',
                pub_x25519=pub_x,
                pub_pqc=pub_pqc,
                pub_sig=pub_sig,
                encrypted_vault=vault
            )
            self.identities[r_id] = identity

            # Register public key with forensic engine
            forensic_engine.register_recipient_identity(
                recipient_id=r_id,
                name=name,
                unit=unit,
                public_key_sig_b64=identity.pub_sig_b64
            )

    def _initialize_seed_distribution(self):
        """
        Synthesizes the reference document 'Confidential Q4 Strategic Product Roadmap',
        protects it with genuine AES-256 PDF encryption and ML-KEM recipient access slots,
        and makes the single protected PDF available for Alice, Bob, and Charlie.
        """
        import os
        from app.crypto.pdf_protector import PdfProtector

        doc_id = "DOC-7F3A29B1"
        title = "Confidential Q4 Strategic Product Roadmap"
        classification = "CONFIDENTIAL // RESTRICTED"
        original_filename = "DefencePlan-Q4-Roadmap.pdf"

        body = (
            "1. OPERATIONAL MANDATE: Full air-gapped cryptographic document distribution.\n"
            "2. POST-QUANTUM ASSURANCE: NIST FIPS 203 ML-KEM-768 key encapsulation.\n"
            "3. NON-REPUDIATION: NIST FIPS 204 ML-DSA-65 hardware-level digital signing.\n"
            "4. FORENSIC ATTRIBUTION: Dynamic zero-width and structural watermarking.\n"
            "5. DECENTRALIZED AUDIT: Multi-validator permissioned notary DLT quorum.\n"
            "WARNING: All decryption sessions are cryptographically fingerprinted. Unlawful leaks are traceable."
        )

        pdf_bytes = generate_sample_navy_pdf(title, doc_id, classification, body)
        self.original_pdfs[doc_id] = pdf_bytes
        # Generate Document Open Secret and wrap for all enrolled recipients
        doc_open_secret = os.urandom(32).hex()
        dos_bytes = doc_open_secret.encode("utf-8")
        recipient_slots = []
        all_rcpt_ids = list(self.identities.keys()) if self.identities else ["USER-ALICE", "USER-BOB", "USER-CHARLIE"]
        for r_id in all_rcpt_ids:
            if r_id in self.identities:
                identity = self.identities[r_id]
                wrap = MultiRecipientEnvelope.wrap_cek_for_recipient(
                    cek=dos_bytes,
                    recipient_id=r_id,
                    pub_x25519_bytes=identity.pub_x25519_bytes,
                    pub_pqc_bytes=identity.pub_pqc_bytes
                )
                recipient_slots.append(wrap)

        self.document_metadata[doc_id] = {
            "doc_id": doc_id,
            "title": title,
            "classification": classification,
            "original_filename": original_filename,
            "doc_hash_sha256": hashlib.sha256(pdf_bytes).hexdigest(),
            "authorized_recipients": all_rcpt_ids
        }

        protected_pdf = PdfProtector.protect(
            source_pdf_bytes=pdf_bytes,
            doc_id=doc_id,
            title=title,
            doc_open_secret=doc_open_secret,
            recipient_slots=recipient_slots
        )
        self.protected_pdfs[doc_id] = protected_pdf
        self.secure_packages[f"{doc_id}:ALL"] = protected_pdf

    def _register_db_row(self, row):
        """Converts an SQLite identity row into a RegisteredIdentity."""
        try:
            import json
            raw_vault_data = row["encrypted_vault"]
            if isinstance(raw_vault_data, (bytes, bytearray)):
                raw_vault_data = raw_vault_data.decode("utf-8")
            raw_vault = json.loads(raw_vault_data) if isinstance(raw_vault_data, str) else raw_vault_data
            vault = raw_vault.get("primary", raw_vault)
            pub_kem = row["public_key_kem"]
            pub_x = pub_kem[:32]
            pub_pqc = pub_kem[32:]
            pub_sig = row["public_key_sig"]

            ident = RegisteredIdentity(
                recipient_id=row["recipient_id"],
                name=row["name"],
                unit=row["unit"],
                pub_x25519=pub_x,
                pub_pqc=pub_pqc,
                pub_sig=pub_sig,
                encrypted_vault=vault,
                role=row["role"] if "role" in row.keys() else "recipient",
                recovery_key_hash=row["recovery_key_hash"] if "recovery_key_hash" in row.keys() else None
            )
            self.identities[row["recipient_id"]] = ident
            forensic_engine.register_recipient_identity(
                recipient_id=row["recipient_id"],
                name=row["name"],
                unit=row["unit"],
                public_key_sig_b64=ident.pub_sig_b64
            )
            return ident
        except Exception as e:
            return None

    def sync_from_db(self, db_instance):
        """Synchronizes identities and protected documents from SQLite database into system state."""
        if not db_instance:
            return
        rows = db_instance.list_identities()
        for row in rows:
            self._register_db_row(row)
        # Refresh seed distribution so newly synced identities have access slots
        self._initialize_seed_distribution()

    def register_new_identity(self, recipient_id: str, name: str, unit: str, password: str) -> RegisteredIdentity:
        """Enrolls a brand new recipient with generated ML-KEM + ML-DSA keys and Argon2id vault."""
        priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
        priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()

        vault = EncryptedCredentialVault.create_vault(
            password=password,
            priv_kem_classical=priv_x,
            priv_kem_pqc=priv_pqc,
            priv_sig=priv_sig,
            extra_metadata={"recipient_id": recipient_id, "name": name}
        )

        identity = RegisteredIdentity(
            recipient_id=recipient_id,
            name=name,
            unit=unit,
                role='recipient',
            pub_x25519=pub_x,
            pub_pqc=pub_pqc,
            pub_sig=pub_sig,
            encrypted_vault=vault
        )
        self.identities[recipient_id] = identity

        forensic_engine.register_recipient_identity(
            recipient_id=recipient_id,
            name=name,
            unit=unit,
                public_key_sig_b64=identity.pub_sig_b64
        )
        return identity


system_state = SystemState()
