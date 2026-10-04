import sqlite3
import os
import json
import time
from typing import Optional, List, Dict, Any
from app.db.base_repo import BaseRepository

class SQLiteRepository(BaseRepository):
    """
    SQLite implementation of BaseRepository for local offline and air-gapped workstations.
    """
    def __init__(self, db_path=None):
        if db_path is None:
            self.db_path = os.environ.get('LEAKTRACE_DB', 'leaktrace.db')
        else:
            self.db_path = db_path

    def _get_connection(self):
        if os.path.exists(self.db_path):
            try:
                import stat
                os.chmod(self.db_path, stat.S_IWRITE | stat.S_IREAD)
            except Exception:
                pass
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        return conn

    def initialize(self):
        conn = self._get_connection()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS identities (
                    recipient_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    unit TEXT DEFAULT '',
                    role TEXT NOT NULL DEFAULT 'pending',
                    encrypted_vault BLOB NOT NULL,
                    public_key_kem BLOB NOT NULL,
                    public_key_sig BLOB NOT NULL,
                    recovery_key_hash TEXT NOT NULL,
                    fingerprint TEXT DEFAULT '',
                    created_at REAL NOT NULL,
                    is_revoked INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS identity_keys_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    recipient_id TEXT NOT NULL,
                    key_version INTEGER NOT NULL,
                    public_key_kem BLOB NOT NULL,
                    public_key_sig BLOB NOT NULL,
                    fingerprint TEXT DEFAULT '',
                    created_at REAL NOT NULL,
                    UNIQUE(recipient_id, key_version)
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES identities(recipient_id),
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS auth_challenges (
                    challenge_id TEXT PRIMARY KEY,
                    recipient_id TEXT NOT NULL,
                    nonce TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ledger_blocks (
                    block_index INTEGER PRIMARY KEY,
                    block_hash TEXT NOT NULL,
                    prev_hash TEXT NOT NULL,
                    merkle_root TEXT NOT NULL,
                    timestamp_utc REAL NOT NULL,
                    receipts_json TEXT NOT NULL,
                    endorsements_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS watermark_index (
                    watermark_id TEXT PRIMARY KEY,
                    block_index INTEGER NOT NULL REFERENCES ledger_blocks(block_index),
                    recipient_id TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    session_id TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS protected_documents (
                    doc_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    sender_id TEXT NOT NULL,
                    recipient_ids_json TEXT NOT NULL,
                    doc_hash TEXT NOT NULL,
                    protected_pdf BLOB NOT NULL,
                    created_at REAL NOT NULL,
                    storage_ref TEXT
                );

                CREATE TABLE IF NOT EXISTS app_config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_identities_role ON identities(role);
                CREATE INDEX IF NOT EXISTS idx_watermark_doc ON watermark_index(doc_id);
                CREATE INDEX IF NOT EXISTS idx_watermark_recipient ON watermark_index(recipient_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_challenges_expires ON auth_challenges(expires_at);
            """)
            conn.commit()
        finally:
            conn.close()

        self.seed_defaults()

    def seed_defaults(self):
        if not os.environ.get("LEAKTRACE_SEED_DEFAULTS", "").lower() in ("1", "true"):
            return
        if self.is_setup_complete():
            return
        try:
            try:
                from app.api.routes_auth import _generate_identity_keys
            except ImportError:
                from backend.app.api.routes_auth import _generate_identity_keys
        except Exception:
            return

        try:
            # Seed primary organization administrator: Miqdaad Sayyed if not present
            if not self.get_identity("USER-MIQDAAD_SAYYED"):
                kem, sig, vault, rec_key, rec_hash = _generate_identity_keys("Admin@2026")
                self.insert_identity(
                    recipient_id="USER-MIQDAAD_SAYYED",
                    name="Miqdaad Sayyed",
                    unit="WESEE Naval Directorate",
                    role="admin",
                    encrypted_vault=json.dumps(vault).encode("utf-8"),
                    public_key_kem=kem,
                    public_key_sig=sig,
                    recovery_key_hash=rec_hash,
                    fingerprint="",
                    created_at=time.time()
                )

            # Seed standard recipient personnel for operational testing
            sample_personnel = [
                ("RECP-NAV-001", "Commander Vikrant", "WESEE Naval Directorate", "recipient"),
                ("RECP-INT-002", "Captain Arjun", "Naval Intelligence", "sender"),
                ("RECP-CYB-003", "Lt Commander Priya", "Cyber Security Command", "investigator")
            ]
            for rid, rname, runit, rrole in sample_personnel:
                if not self.get_identity(rid):
                    r_kem, r_sig, r_vault, _, r_hash = _generate_identity_keys("Password123!")
                    self.insert_identity(
                        recipient_id=rid,
                        name=rname,
                        unit=runit,
                        role=rrole,
                        encrypted_vault=json.dumps(r_vault).encode("utf-8"),
                        public_key_kem=r_kem,
                        public_key_sig=r_sig,
                        recovery_key_hash=r_hash,
                        fingerprint="",
                        created_at=time.time()
                    )

            self.set_config("setup_complete", "true")
        except Exception:
            pass

    def get_identity(self, recipient_id: str) -> Optional[Dict[str, Any]]:
        if not recipient_id:
            return None
        conn = self._get_connection()
        try:
            trimmed = str(recipient_id).strip()
            normalized_uid = f"USER-{trimmed.upper().replace(' ', '_')}"
            cursor = conn.execute(
                """SELECT * FROM identities 
                   WHERE recipient_id = ? 
                      OR recipient_id = ? 
                      OR LOWER(recipient_id) = LOWER(?) 
                      OR LOWER(name) = LOWER(?)
                      OR (LOWER(?) = 'admin' AND role = 'admin')
                   LIMIT 1""",
                (trimmed, normalized_uid, trimmed, trimmed, trimmed)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def list_identities(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM identities ORDER BY created_at DESC")
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()

    def list_identities_by_role(self, role: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM identities WHERE role = ? ORDER BY created_at DESC", (role,))
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()

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
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT INTO identities (
                    recipient_id, name, unit, role, encrypted_vault, public_key_kem, public_key_sig, recovery_key_hash, fingerprint, created_at, is_revoked
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (recipient_id, name, unit, role, encrypted_vault, public_key_kem, public_key_sig, recovery_key_hash, fingerprint, created_at, is_revoked))
            conn.commit()
        finally:
            conn.close()

        self.record_identity_key_history(
            recipient_id=recipient_id,
            key_version=1,
            public_key_kem=public_key_kem,
            public_key_sig=public_key_sig,
            fingerprint=fingerprint,
            created_at=created_at
        )

    def update_identity_role(self, recipient_id: str, role: str) -> None:
        conn = self._get_connection()
        try:
            conn.execute("UPDATE identities SET role = ? WHERE recipient_id = ?", (role, recipient_id))
            conn.commit()
        finally:
            conn.close()

    def revoke_identity(self, recipient_id: str) -> None:
        conn = self._get_connection()
        try:
            conn.execute("UPDATE identities SET is_revoked = 1 WHERE recipient_id = ?", (recipient_id,))
            conn.commit()
        finally:
            conn.close()

    def unrevoke_identity(self, recipient_id: str) -> None:
        conn = self._get_connection()
        try:
            conn.execute("UPDATE identities SET is_revoked = 0 WHERE recipient_id = ?", (recipient_id,))
            conn.commit()
        finally:
            conn.close()

    def is_identity_revoked(self, recipient_id: str) -> bool:
        row = self.get_identity(recipient_id)
        return bool(row and row['is_revoked'])

    def record_identity_key_history(
        self,
        recipient_id: str,
        key_version: int,
        public_key_kem: bytes,
        public_key_sig: bytes,
        fingerprint: str,
        created_at: float
    ) -> None:
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO identity_keys_history (
                    recipient_id, key_version, public_key_kem, public_key_sig, fingerprint, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (recipient_id, key_version, public_key_kem, public_key_sig, fingerprint, created_at))
            conn.commit()
        finally:
            conn.close()

    def get_identity_key_history(self, recipient_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM identity_keys_history WHERE recipient_id = ? ORDER BY key_version ASC",
                (recipient_id,)
            )
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()

    def insert_session(self, token: str, user_id: str, created_at: float, expires_at: float) -> None:
        conn = self._get_connection()
        try:
            conn.execute("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", (token, user_id, created_at, expires_at))
            conn.commit()
        finally:
            conn.close()

    def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM sessions WHERE token = ?", (token,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def delete_session(self, token: str) -> None:
        conn = self._get_connection()
        try:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
        finally:
            conn.close()

    def cleanup_expired_sessions(self) -> None:
        conn = self._get_connection()
        try:
            conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
            conn.commit()
        finally:
            conn.close()

    def create_auth_challenge(
        self,
        challenge_id: str,
        recipient_id: str,
        nonce: str,
        created_at: float,
        expires_at: float
    ) -> None:
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT INTO auth_challenges (challenge_id, recipient_id, nonce, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
            """, (challenge_id, recipient_id, nonce, created_at, expires_at))
            conn.commit()
        finally:
            conn.close()

    def get_auth_challenge(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM auth_challenges WHERE challenge_id = ?", (challenge_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def delete_auth_challenge(self, challenge_id: str) -> None:
        conn = self._get_connection()
        try:
            conn.execute("DELETE FROM auth_challenges WHERE challenge_id = ?", (challenge_id,))
            conn.commit()
        finally:
            conn.close()

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
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO ledger_blocks (
                    block_index, block_hash, prev_hash, merkle_root, timestamp_utc, receipts_json, endorsements_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (block_index, block_hash, prev_hash, merkle_root, timestamp_utc, receipts_json, endorsements_json))
            conn.commit()
        finally:
            conn.close()

    def get_latest_block(self) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ledger_blocks ORDER BY block_index DESC LIMIT 1")
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_block(self, block_index: int) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ledger_blocks WHERE block_index = ?", (block_index,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_all_blocks(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ledger_blocks ORDER BY block_index ASC")
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()

    def block_count(self) -> int:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT COUNT(*) FROM ledger_blocks")
            row = cursor.fetchone()
            return row[0] if row else 0
        finally:
            conn.close()

    def insert_watermark_index(
        self,
        watermark_id: str,
        block_index: int,
        recipient_id: str,
        doc_id: str,
        session_id: str
    ) -> None:
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO watermark_index (
                    watermark_id, block_index, recipient_id, doc_id, session_id
                ) VALUES (?, ?, ?, ?, ?)
            """, (watermark_id, block_index, recipient_id, doc_id, session_id))
            conn.commit()
        finally:
            conn.close()

    def find_by_watermark(self, watermark_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM watermark_index WHERE watermark_id = ?", (watermark_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def find_receipts_by_doc(self, doc_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM watermark_index WHERE doc_id = ?", (doc_id,))
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()

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
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO protected_documents (
                    doc_id, title, sender_id, recipient_ids_json, doc_hash, protected_pdf, created_at, storage_ref
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (doc_id, title, sender_id, recipient_ids_json, doc_hash, protected_pdf, created_at, storage_ref))
            conn.commit()
        finally:
            conn.close()

    def get_protected_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM protected_documents WHERE doc_id = ?", (doc_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def list_protected_documents(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM protected_documents ORDER BY created_at DESC")
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()

    def list_documents_by_sender(self, sender_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM protected_documents WHERE sender_id = ? ORDER BY created_at DESC", (sender_id,))
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()

    def list_documents_for_recipient(self, recipient_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM protected_documents ORDER BY created_at DESC")
            matching = []
            target = recipient_id.strip().upper()
            for r in cursor.fetchall():
                try:
                    rcpt_ids = json.loads(r["recipient_ids_json"]) if isinstance(r["recipient_ids_json"], str) else []
                    rcpt_upper = [str(x).strip().upper() for x in rcpt_ids]
                    if target in rcpt_upper or target.replace("USER-", "") in rcpt_upper or f"USER-{target}" in rcpt_upper:
                        matching.append(dict(r))
                except Exception:
                    continue
            return matching
        finally:
            conn.close()

    def get_config(self, key: str) -> Optional[str]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT value FROM app_config WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row['value'] if row else None
        finally:
            conn.close()

    def set_config(self, key: str, value: str) -> None:
        conn = self._get_connection()
        try:
            conn.execute("INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
            conn.commit()
        finally:
            conn.close()

    def is_setup_complete(self) -> bool:
        if self.get_config('setup_complete') != 'true':
            return False
        conn = self._get_connection()
        try:
            row = conn.execute("SELECT count(*) FROM identities WHERE role='admin'").fetchone()
            return bool(row and row[0] > 0)
        finally:
            conn.close()
