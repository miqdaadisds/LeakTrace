"""
In-memory Application State & Pre-seeded Cryptographic Directory.
Maintains enrolled officer/user identities (Alice, Bob, Charlie), hybrid keypairs,
encrypted document storage, and real binary PDF document caches.
"""
from typing import Dict, List, Optional
import base64
import time
from app.crypto.pqc_kem import HybridPQCKEM
from app.crypto.pqc_sig import DigitalSignatureManager
from app.crypto.envelope import MultiRecipientEnvelope
from app.core.types import RecipientProfile, EncryptedDocumentPackage
from app.forensics.attribution_engine import forensic_engine
from app.provenance.ledger import provenance_ledger
from app.core.pdf_generator import generate_sample_navy_pdf


class OfficerRecord:
    def __init__(
        self,
        recipient_id: str,
        name: str,
        unit: str,
        clearance: str,
        priv_x25519: bytes,
        pub_x25519: bytes,
        priv_pqc: bytes,
        pub_pqc: bytes,
        priv_sig: bytes,
        pub_sig: bytes
    ):
        self.recipient_id = recipient_id
        self.name = name
        self.unit = unit
        self.clearance = clearance
        self.priv_x25519_b64 = base64.b64encode(priv_x25519).decode("utf-8")
        self.pub_x25519_b64 = base64.b64encode(pub_x25519).decode("utf-8")
        self.priv_pqc_b64 = base64.b64encode(priv_pqc).decode("utf-8")
        self.pub_pqc_b64 = base64.b64encode(pub_pqc).decode("utf-8")
        self.priv_sig_b64 = base64.b64encode(priv_sig).decode("utf-8")
        self.pub_sig_b64 = base64.b64encode(pub_sig).decode("utf-8")

    def to_profile(self) -> RecipientProfile:
        return RecipientProfile(
            recipient_id=self.recipient_id,
            name=self.name,
            unit=self.unit,
            public_key_x25519_b64=self.pub_x25519_b64,
            public_key_pqc_b64=self.pub_pqc_b64,
            public_key_sig_b64=self.pub_sig_b64
        )


class SystemState:
    def __init__(self):
        self.officers: Dict[str, OfficerRecord] = {}
        self.documents: Dict[str, EncryptedDocumentPackage] = {}
        self.raw_documents_cache: Dict[str, str] = {}
        self.pdf_cache: Dict[str, bytes] = {}
        self._initialize_officers()
        self._initialize_seed_documents()

    def _initialize_officers(self):
        recipient_specs = [
            (
                "USER-BOB",
                "Bob",
                "Product Operations & Strategy",
                "CONFIDENTIAL // RESTRICTED"
            ),
            (
                "USER-ALICE",
                "Alice",
                "Engineering Architecture Lead",
                "CONFIDENTIAL // RESTRICTED"
            ),
            (
                "USER-CHARLIE",
                "Charlie",
                "Cryptographic Security Specialist",
                "CONFIDENTIAL // RESTRICTED"
            ),
            (
                "DEF-NAVY-0842",
                "Cdr. Rajesh Sharma",
                "Western Naval Command - INS Vikrant Ops",
                "TOP SECRET // OPERATIONAL"
            ),
        ]

        for r_id, name, unit, clearance in recipient_specs:
            priv_x, pub_x, priv_pqc, pub_pqc = HybridPQCKEM.generate_keypair()
            priv_sig, pub_sig = DigitalSignatureManager.generate_keypair()
            
            record = OfficerRecord(
                recipient_id=r_id,
                name=name,
                unit=unit,
                clearance=clearance,
                priv_x25519=priv_x,
                pub_x25519=pub_x,
                priv_pqc=priv_pqc,
                pub_pqc=pub_pqc,
                priv_sig=priv_sig,
                pub_sig=pub_sig
            )
            self.officers[r_id] = record
            forensic_engine.register_officer(r_id, name, unit, clearance)

    def _initialize_seed_documents(self):
        profiles = [o.to_profile() for o in self.officers.values()]

        doc1_id = "DOC-2026-STRATEGY-ROADMAP"
        doc1_title = "Confidential Q4 Strategic Product Roadmap & Architecture"
        doc1_class = "CONFIDENTIAL // RESTRICTED ACCESS"
        doc1_content = (
            "CONFIDENTIAL INTERNAL DIRECTIVE // DO NOT DISTRIBUTE OUTSIDE\n"
            "TO: Alice (Engineering), Bob (Product), Charlie (Security)\n"
            "ISSUING AUTHORITY: EXECUTIVE PROGRAM OFFICE\n\n"
            "1. PROJECT ROADMAP & BUDGET ALLOCATION:\n"
            "   Q4 strategic budget allocation of $2.4M is approved for next-gen deployment.\n"
            "   Target release date is locked for November 15. All code freezes on October 30.\n\n"
            "2. SECURITY & COMPLIANCE MANDATE:\n"
            "   All endpoints must implement post-quantum cryptographic key encapsulation.\n"
            "   No unauthorized unencrypted copies may be stored on unmanaged devices.\n\n"
            "3. RECIPIENT ACCOUNTABILITY NOTICE:\n"
            "   This document is protected by NISHAN-PQ cryptographic attribution.\n"
            "   Opening this file embeds an invisible forensic watermark and logs a signed receipt."
        )

        pkg1 = MultiRecipientEnvelope.encrypt_document(
            doc_id=doc1_id,
            title=doc1_title,
            plaintext=doc1_content,
            classification=doc1_class,
            publisher_id="HQ-CENTRAL-COMMAND",
            recipients=profiles
        )
        self.documents[doc1_id] = pkg1
        self.raw_documents_cache[doc1_id] = doc1_content
        self.pdf_cache[doc1_id] = generate_sample_navy_pdf(doc1_title, doc1_id, doc1_class, doc1_content)

    def get_all_profiles(self) -> List[RecipientProfile]:
        return [o.to_profile() for o in self.officers.values()]

    def get_officer(self, recipient_id: str) -> Optional[OfficerRecord]:
        return self.officers.get(recipient_id)


system_state = SystemState()
