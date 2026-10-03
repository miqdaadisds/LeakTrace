import os
from typing import Optional, List, Dict, Any
from app.db.base_repo import BaseRepository
from app.db.sqlite_repo import SQLiteRepository

class Database(BaseRepository):
    """
    Unified Database abstraction for LeakTrace.
    Provides complete backward compatibility with existing tests and modules.
    Automatically routes to PostgresRepository when DATABASE_URL is set,
    or SQLiteRepository for offline / test fixtures.
    """
    def __init__(self, db_path=None, database_url=None):
        self.db_path = db_path
        self.database_url = database_url or os.environ.get("DATABASE_URL")
        
        # If an explicit SQLite path is passed (e.g. In pytest tmp_path), always use SQLite
        if db_path is not None:
            self._impl = SQLiteRepository(db_path=db_path)
        elif self.database_url:
            from app.db.postgres_repo import PostgresRepository
            self._impl = PostgresRepository(database_url=self.database_url)
        else:
            self._impl = SQLiteRepository(db_path=os.environ.get('LEAKTRACE_DB', 'leaktrace.db'))

    def _get_connection(self):
        return self._impl._get_connection()

    def initialize(self) -> None:
        return self._impl.initialize()

    def seed_defaults(self) -> None:
        return self._impl.seed_defaults()

    def is_setup_complete(self) -> bool:
        return self._impl.is_setup_complete()

    def get_config(self, key: str) -> Optional[str]:
        return self._impl.get_config(key)

    def set_config(self, key: str, value: str) -> None:
        return self._impl.set_config(key, value)

    def get_identity(self, recipient_id: str) -> Optional[Dict[str, Any]]:
        return self._impl.get_identity(recipient_id)

    def list_identities(self) -> List[Dict[str, Any]]:
        return self._impl.list_identities()

    def list_identities_by_role(self, role: str) -> List[Dict[str, Any]]:
        return self._impl.list_identities_by_role(role)

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
        return self._impl.insert_identity(
            recipient_id, name, unit, role, encrypted_vault,
            public_key_kem, public_key_sig, recovery_key_hash,
            fingerprint, created_at, is_revoked
        )

    def update_identity_role(self, recipient_id: str, role: str) -> None:
        return self._impl.update_identity_role(recipient_id, role)

    def revoke_identity(self, recipient_id: str) -> None:
        return self._impl.revoke_identity(recipient_id)

    def unrevoke_identity(self, recipient_id: str) -> None:
        return self._impl.unrevoke_identity(recipient_id)

    def is_identity_revoked(self, recipient_id: str) -> bool:
        return self._impl.is_identity_revoked(recipient_id)

    def record_identity_key_history(
        self,
        recipient_id: str,
        key_version: int,
        public_key_kem: bytes,
        public_key_sig: bytes,
        fingerprint: str,
        created_at: float
    ) -> None:
        return self._impl.record_identity_key_history(
            recipient_id, key_version, public_key_kem, public_key_sig, fingerprint, created_at
        )

    def get_identity_key_history(self, recipient_id: str) -> List[Dict[str, Any]]:
        return self._impl.get_identity_key_history(recipient_id)

    def insert_session(self, token: str, user_id: str, created_at: float, expires_at: float) -> None:
        return self._impl.insert_session(token, user_id, created_at, expires_at)

    def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        return self._impl.get_session(token)

    def delete_session(self, token: str) -> None:
        return self._impl.delete_session(token)

    def cleanup_expired_sessions(self) -> None:
        return self._impl.cleanup_expired_sessions()

    def create_auth_challenge(
        self,
        challenge_id: str,
        recipient_id: str,
        nonce: str,
        created_at: float,
        expires_at: float
    ) -> None:
        return self._impl.create_auth_challenge(challenge_id, recipient_id, nonce, created_at, expires_at)

    def get_auth_challenge(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        return self._impl.get_auth_challenge(challenge_id)

    def delete_auth_challenge(self, challenge_id: str) -> None:
        return self._impl.delete_auth_challenge(challenge_id)

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
        return self._impl.insert_block(
            block_index, block_hash, prev_hash, merkle_root, timestamp_utc, receipts_json, endorsements_json
        )

    def get_latest_block(self) -> Optional[Dict[str, Any]]:
        return self._impl.get_latest_block()

    def get_block(self, block_index: int) -> Optional[Dict[str, Any]]:
        return self._impl.get_block(block_index)

    def get_all_blocks(self) -> List[Dict[str, Any]]:
        return self._impl.get_all_blocks()

    def block_count(self) -> int:
        return self._impl.block_count()

    def insert_watermark_index(
        self,
        watermark_id: str,
        block_index: int,
        recipient_id: str,
        doc_id: str,
        session_id: str
    ) -> None:
        return self._impl.insert_watermark_index(watermark_id, block_index, recipient_id, doc_id, session_id)

    def find_by_watermark(self, watermark_id: str) -> Optional[Dict[str, Any]]:
        return self._impl.find_by_watermark(watermark_id)

    def find_receipts_by_doc(self, doc_id: str) -> List[Dict[str, Any]]:
        return self._impl.find_receipts_by_doc(doc_id)

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
        return self._impl.store_protected_document(
            doc_id, title, sender_id, recipient_ids_json, doc_hash, protected_pdf, created_at, storage_ref
        )

    def get_protected_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return self._impl.get_protected_document(doc_id)

    def list_protected_documents(self) -> List[Dict[str, Any]]:
        return self._impl.list_protected_documents()

    def list_documents_by_sender(self, sender_id: str) -> List[Dict[str, Any]]:
        return self._impl.list_documents_by_sender(sender_id)

    def list_documents_for_recipient(self, recipient_id: str) -> List[Dict[str, Any]]:
        return self._impl.list_documents_for_recipient(recipient_id)
