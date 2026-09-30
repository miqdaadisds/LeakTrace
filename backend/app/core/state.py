"""
In-memory Application State & Pre-seeded Military Cryptographic Directory.
Maintains enrolled officer identities, hybrid keypairs, and encrypted document storage.
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
        self.raw_documents_cache: Dict[str, str] = {} # For publisher view comparison
        self._initialize_officers()
        self._initialize_seed_documents()

    def _initialize_officers(self):
        officer_specs = [
            (
                "DEF-NAVY-0842",
                "Cdr. Rajesh Sharma",
                "Western Naval Command (WNC) - INS Vikrant Ops",
                "TOP SECRET // OPERATIONAL"
            ),
            (
                "DEF-NAVY-1109",
                "Lt. Cdr. Priya Menon",
                "Directorate of Naval Intelligence (DNI)",
                "TOP SECRET // CRYPTO"
            ),
            (
                "DEF-NAVY-0318",
                "Capt. Vikram Sengupta",
                "Eastern Fleet Headquarters (Visakhapatnam)",
                "SECRET // MARITIME COMMAND"
            ),
            (
                "DEF-NAVY-0771",
                "Cdr. Arunava Roy",
                "Weapons and Electronics Systems Engineering Establishment (WESEE)",
                "TOP SECRET // R&D"
            ),
        ]

        for r_id, name, unit, clearance in officer_specs:
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

        doc1_id = "DOC-NAVY-2026-OP-TRISHUL"
        doc1_title = "OP TRISHUL: Western Seaboard Carrier Strike Group Patrol Grid & Intercept Coordinates"
        doc1_class = "TOP SECRET // MARITIME STRIKE"
        doc1_content = (
            "NAVAL OPERATIONAL ORDER: OP TRISHUL (OCT 2026)\n"
            "CLASSIFICATION: TOP SECRET // OPERATIONAL STRICT EXCLUSIVE\n"
            "ORIGINATING AUTHORITY: NAVAL HEADQUARTERS (WESEE / NHQ COMSEC)\n"
            "TARGET FLEET: INS VIKRANT CARRIER BATTLE GROUP (CBG-01)\n\n"
            "1. GRID DEPLOYMENT COORDINATES:\n"
            "   Primary Patrol Box: Lat 18.9220 N, Long 72.8346 E to Lat 15.4989 N, Long 73.8278 E.\n"
            "   Depth Vector: Sonar Active Pinging Band 3 (Acoustic Stealth Protocol P-75).\n\n"
            "2. MARITIME INTERCEPTION PROTOCOLS:\n"
            "   All unidentified surface vessels penetrating within 40 nautical miles of Sector Alpha\n"
            "   are designated for visual reconnaissance by MiG-29K squadrons.\n"
            "   Electronic Warfare Countermeasures: Maintain EMCON Level Alpha until zero-hour.\n\n"
            "3. SECURE FREQUENCY HOPPING ASSIGNMENTS:\n"
            "   Tactical Link: UHF Channel 9B, Key-Rotation Hash SHA3-512 interval 300 seconds.\n"
            "   Failure to authenticate via cryptographic receipt will trigger automated quarantine."
        )

        pkg1 = MultiRecipientEnvelope.encrypt_document(
            doc_id=doc1_id,
            title=doc1_title,
            plaintext=doc1_content,
            classification=doc1_class,
            publisher_id="WESEE-DIRECTORATE-DELHI",
            recipients=profiles
        )
        self.documents[doc1_id] = pkg1
        self.raw_documents_cache[doc1_id] = doc1_content

        doc2_id = "DOC-NAVY-2026-EW-CIPHER"
        doc2_title = "PROJECT 75I: Indigenous AIP Submarine Cryptographic Firmware Sign-off"
        doc2_class = "TOP SECRET // SCI-CRYPT"
        doc2_content = (
            "DEFENCE RESEARCH MEMORANDUM // WESEE TECHNICAL SPECIFICATION\n"
            "PROJECT: INDIGENOUS AIP SUBMARINE CRYPTOGRAPHIC FIRMWARE V4.2\n"
            "DISTRIBUTION: CHIEF OF NAVAL STAFF, WESEE, NHQ DNI\n\n"
            "1. AIR-INDEPENDENT PROPULSION (AIP) ACOUSTIC TELEMETRY:\n"
            "   The firmware utilizes dual-redundant post-quantum Kyber lattice key encapsulations\n"
            "   for extremely low frequency (ELF) underwater communications.\n\n"
            "2. CRYPTOGRAPHIC SIGN-OFF APPROVAL:\n"
            "   All operational keys must undergo automated zero-knowledge attestation before\n"
            "   dockside deployment at Mazagon Dock Shipbuilders Limited (MDL).\n"
            "   This document is cryptographically guarded under SIH PS 26237 standards."
        )

        pkg2 = MultiRecipientEnvelope.encrypt_document(
            doc_id=doc2_id,
            title=doc2_title,
            plaintext=doc2_content,
            classification=doc2_class,
            publisher_id="WESEE-DIRECTORATE-DELHI",
            recipients=profiles
        )
        self.documents[doc2_id] = pkg2
        self.raw_documents_cache[doc2_id] = doc2_content

    def get_all_profiles(self) -> List[RecipientProfile]:
        return [o.to_profile() for o in self.officers.values()]

    def get_officer(self, recipient_id: str) -> Optional[OfficerRecord]:
        return self.officers.get(recipient_id)


system_state = SystemState()
