from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any

class BaseRepository(ABC):
    """
    Abstract Base Repository interface defining persistence operations
    for both Connected Mode (PostgreSQL / Supabase) and Offline Mode (SQLite).
    """

    @abstractmethod
    def initialize(self) -> None:
        pass

    @abstractmethod
    def seed_defaults(self) -> None:
        pass

    @abstractmethod
    def is_setup_complete(self) -> bool:
        pass

    @abstractmethod
    def get_config(self, key: str) -> Optional[str]:
        pass

    @abstractmethod
    def set_config(self, key: str, value: str) -> None:
        pass

    # Identity Management
    @abstractmethod
    def get_identity(self, recipient_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def list_identities(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def list_identities_by_role(self, role: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def insert_identity(
        self,
        recipient_id: str,
        name: str,
        unit: str,
        role: str,
        encrypted_vault: bytes,
        public_key_kem: bytes,
        public_key_sig: bytes,
        recovery_key_hash: str,
        fingerprint: str,
        created_at: float,
        is_revoked: int = 0
    ) -> None:
        pass

    @abstractmethod
    def update_identity_role(self, recipient_id: str, role: str) -> None:
        pass

    @abstractmethod
    def revoke_identity(self, recipient_id: str) -> None:
        pass

    @abstractmethod
    def unrevoke_identity(self, recipient_id: str) -> None:
        pass

    @abstractmethod
    def is_identity_revoked(self, recipient_id: str) -> bool:
        pass

    # Identity Key History & Versioning
    @abstractmethod
    def record_identity_key_history(
        self,
        recipient_id: str,
        key_version: int,
        public_key_kem: bytes,
        public_key_sig: bytes,
        fingerprint: str,
        created_at: float
    ) -> None:
        pass

    @abstractmethod
    def get_identity_key_history(self, recipient_id: str) -> List[Dict[str, Any]]:
        pass

    # Session Management
    @abstractmethod
    def insert_session(self, token: str, user_id: str, created_at: float, expires_at: float) -> None:
        pass

    @abstractmethod
    def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def delete_session(self, token: str) -> None:
        pass

    @abstractmethod
    def cleanup_expired_sessions(self) -> None:
        pass

    # Cryptographic Challenge-Response Nonce Storage
    @abstractmethod
    def create_auth_challenge(
        self,
        challenge_id: str,
        recipient_id: str,
        nonce: str,
        created_at: float,
        expires_at: float
    ) -> None:
        pass

    @abstractmethod
    def get_auth_challenge(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def delete_auth_challenge(self, challenge_id: str) -> None:
        pass

    # Ledger Blocks
    @abstractmethod
    def insert_block(
        self,
        block_index: int,
        block_hash: str,
        prev_hash: str,
        merkle_root: str,
        timestamp_utc: float,
        receipts_json: str,
        endorsements_json: str
    ) -> None:
        pass

    @abstractmethod
    def get_latest_block(self) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_block(self, block_index: int) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_all_blocks(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def block_count(self) -> int:
        pass

    # Watermark Index
    @abstractmethod
    def insert_watermark_index(
        self,
        watermark_id: str,
        block_index: int,
        recipient_id: str,
        doc_id: str,
        session_id: str
    ) -> None:
        pass

    @abstractmethod
    def find_by_watermark(self, watermark_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_receipts_by_doc(self, doc_id: str) -> List[Dict[str, Any]]:
        pass

    # Protected Documents
    @abstractmethod
    def store_protected_document(
        self,
        doc_id: str,
        title: str,
        sender_id: str,
        recipient_ids_json: str,
        doc_hash: str,
        protected_pdf: bytes,
        created_at: float,
        storage_ref: Optional[str] = None
    ) -> None:
        pass

    @abstractmethod
    def get_protected_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def list_protected_documents(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def list_documents_by_sender(self, sender_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def list_documents_for_recipient(self, recipient_id: str) -> List[Dict[str, Any]]:
        pass
