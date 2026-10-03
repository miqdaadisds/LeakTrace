import os
import json
import time
from typing import Optional, List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from app.db.base_repo import BaseRepository

class PostgresRepository(BaseRepository):
    """
    PostgreSQL implementation of BaseRepository for Central Cloud Deployment (Render + Supabase).
    Connects to central PostgreSQL database via DATABASE_URL with SSL support.
    """
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or os.environ.get("DATABASE_URL", "")
        # Adjust postgres:// to postgresql:// if needed for psycopg2
        if self.database_url.startswith("postgres://"):
            self.database_url = "postgresql://" + self.database_url[len("postgres://"):]

    def _get_connection(self):
        # Default to sslmode=prefer or require for cloud databases
        conn = psycopg2.connect(self.database_url)
        return conn

    def _dict_row(self, row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        d = dict(row)
        # Convert any memoryviews from BYTEA columns to bytes
        for k, v in d.items():
            if isinstance(v, memoryview):
                d[k] = bytes(v)
        return d

    def initialize(self) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS identities (
                        recipient_id VARCHAR(255) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        unit VARCHAR(255) DEFAULT '',
                        role VARCHAR(50) NOT NULL DEFAULT 'pending',
                        encrypted_vault BYTEA,
                        public_key_kem BYTEA NOT NULL,
                        public_key_sig BYTEA NOT NULL,
                        recovery_key_hash VARCHAR(255) DEFAULT '',
                        fingerprint VARCHAR(255) DEFAULT '',
                        created_at DOUBLE PRECISION NOT NULL,
                        is_revoked INTEGER DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS identity_keys_history (
                        id SERIAL PRIMARY KEY,
                        recipient_id VARCHAR(255) NOT NULL,
                        key_version INTEGER NOT NULL,
                        public_key_kem BYTEA NOT NULL,
                        public_key_sig BYTEA NOT NULL,
                        fingerprint VARCHAR(255) DEFAULT '',
                        created_at DOUBLE PRECISION NOT NULL,
                        UNIQUE(recipient_id, key_version)
                    );

                    CREATE TABLE IF NOT EXISTS sessions (
                        token VARCHAR(255) PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL REFERENCES identities(recipient_id),
                        created_at DOUBLE PRECISION NOT NULL,
                        expires_at DOUBLE PRECISION NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS auth_challenges (
                        challenge_id VARCHAR(255) PRIMARY KEY,
                        recipient_id VARCHAR(255) NOT NULL,
                        nonce VARCHAR(255) NOT NULL,
                        created_at DOUBLE PRECISION NOT NULL,
                        expires_at DOUBLE PRECISION NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS ledger_blocks (
                        block_index INTEGER PRIMARY KEY,
                        block_hash VARCHAR(255) NOT NULL,
                        prev_hash VARCHAR(255) NOT NULL,
                        merkle_root VARCHAR(255) NOT NULL,
                        timestamp_utc DOUBLE PRECISION NOT NULL,
                        receipts_json TEXT NOT NULL,
                        endorsements_json TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS watermark_index (
                        watermark_id VARCHAR(255) PRIMARY KEY,
                        block_index INTEGER NOT NULL REFERENCES ledger_blocks(block_index),
                        recipient_id VARCHAR(255) NOT NULL,
                        doc_id VARCHAR(255) NOT NULL,
                        session_id VARCHAR(255) NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS protected_documents (
                        doc_id VARCHAR(255) PRIMARY KEY,
                        title VARCHAR(500) NOT NULL,
                        sender_id VARCHAR(255) NOT NULL,
                        recipient_ids_json TEXT NOT NULL,
                        doc_hash VARCHAR(255) NOT NULL,
                        protected_pdf BYTEA NOT NULL,
                        created_at DOUBLE PRECISION NOT NULL,
                        storage_ref VARCHAR(1000)
                    );

                    CREATE TABLE IF NOT EXISTS app_config (
                        key VARCHAR(255) PRIMARY KEY,
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

    def seed_defaults(self) -> None:
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
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """SELECT * FROM identities 
                       WHERE recipient_id = %s 
                          OR recipient_id = %s 
                          OR LOWER(recipient_id) = LOWER(%s) 
                          OR LOWER(name) = LOWER(%s)
                          OR (LOWER(%s) = 'admin' AND role = 'admin')
                       LIMIT 1""",
                    (trimmed, normalized_uid, trimmed, trimmed, trimmed)
                )
                row = cur.fetchone()
                return self._dict_row(row)
        finally:
            conn.close()

    def list_identities(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM identities ORDER BY created_at DESC")
                return [self._dict_row(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def list_identities_by_role(self, role: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM identities WHERE role = %s ORDER BY created_at DESC", (role,))
                return [self._dict_row(r) for r in cur.fetchall()]
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
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO identities (
                        recipient_id, name, unit, role, encrypted_vault, public_key_kem, public_key_sig,
                        recovery_key_hash, fingerprint, created_at, is_revoked
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (recipient_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        unit = EXCLUDED.unit,
                        role = EXCLUDED.role,
                        encrypted_vault = EXCLUDED.encrypted_vault,
                        public_key_kem = EXCLUDED.public_key_kem,
                        public_key_sig = EXCLUDED.public_key_sig,
                        recovery_key_hash = EXCLUDED.recovery_key_hash,
                        fingerprint = EXCLUDED.fingerprint,
                        is_revoked = EXCLUDED.is_revoked
                """, (
                    recipient_id, name, unit, role,
                    psycopg2.Binary(encrypted_vault),
                    psycopg2.Binary(public_key_kem),
                    psycopg2.Binary(public_key_sig),
                    recovery_key_hash, fingerprint, created_at, is_revoked
                ))
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
            with conn.cursor() as cur:
                cur.execute("UPDATE identities SET role = %s WHERE recipient_id = %s", (role, recipient_id))
            conn.commit()
        finally:
            conn.close()

    def revoke_identity(self, recipient_id: str) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE identities SET is_revoked = 1 WHERE recipient_id = %s", (recipient_id,))
            conn.commit()
        finally:
            conn.close()

    def unrevoke_identity(self, recipient_id: str) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE identities SET is_revoked = 0 WHERE recipient_id = %s", (recipient_id,))
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
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO identity_keys_history (
                        recipient_id, key_version, public_key_kem, public_key_sig, fingerprint, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (recipient_id, key_version) DO UPDATE SET
                        public_key_kem = EXCLUDED.public_key_kem,
                        public_key_sig = EXCLUDED.public_key_sig,
                        fingerprint = EXCLUDED.fingerprint,
                        created_at = EXCLUDED.created_at
                """, (
                    recipient_id, key_version,
                    psycopg2.Binary(public_key_kem),
                    psycopg2.Binary(public_key_sig),
                    fingerprint, created_at
                ))
            conn.commit()
        finally:
            conn.close()

    def get_identity_key_history(self, recipient_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM identity_keys_history WHERE recipient_id = %s ORDER BY key_version ASC",
                    (recipient_id,)
                )
                return [self._dict_row(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def insert_session(self, token: str, user_id: str, created_at: float, expires_at: float) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (%s, %s, %s, %s)",
                    (token, user_id, created_at, expires_at)
                )
            conn.commit()
        finally:
            conn.close()

    def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM sessions WHERE token = %s", (token,))
                row = cur.fetchone()
                return self._dict_row(row)
        finally:
            conn.close()

    def delete_session(self, token: str) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE token = %s", (token,))
            conn.commit()
        finally:
            conn.close()

    def cleanup_expired_sessions(self) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE expires_at < %s", (time.time(),))
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
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO auth_challenges (challenge_id, recipient_id, nonce, created_at, expires_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, (challenge_id, recipient_id, nonce, created_at, expires_at))
            conn.commit()
        finally:
            conn.close()

    def get_auth_challenge(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM auth_challenges WHERE challenge_id = %s", (challenge_id,))
                row = cur.fetchone()
                return self._dict_row(row)
        finally:
            conn.close()

    def delete_auth_challenge(self, challenge_id: str) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM auth_challenges WHERE challenge_id = %s", (challenge_id,))
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
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO ledger_blocks (
                        block_index, block_hash, prev_hash, merkle_root, timestamp_utc, receipts_json, endorsements_json
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (block_index) DO UPDATE SET
                        block_hash = EXCLUDED.block_hash,
                        prev_hash = EXCLUDED.prev_hash,
                        merkle_root = EXCLUDED.merkle_root,
                        timestamp_utc = EXCLUDED.timestamp_utc,
                        receipts_json = EXCLUDED.receipts_json,
                        endorsements_json = EXCLUDED.endorsements_json
                """, (block_index, block_hash, prev_hash, merkle_root, timestamp_utc, receipts_json, endorsements_json))
            conn.commit()
        finally:
            conn.close()

    def get_latest_block(self) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM ledger_blocks ORDER BY block_index DESC LIMIT 1")
                row = cur.fetchone()
                return self._dict_row(row)
        finally:
            conn.close()

    def get_block(self, block_index: int) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM ledger_blocks WHERE block_index = %s", (block_index,))
                row = cur.fetchone()
                return self._dict_row(row)
        finally:
            conn.close()

    def get_all_blocks(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM ledger_blocks ORDER BY block_index ASC")
                return [self._dict_row(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def block_count(self) -> int:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM ledger_blocks")
                row = cur.fetchone()
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
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO watermark_index (
                        watermark_id, block_index, recipient_id, doc_id, session_id
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (watermark_id) DO UPDATE SET
                        block_index = EXCLUDED.block_index,
                        recipient_id = EXCLUDED.recipient_id,
                        doc_id = EXCLUDED.doc_id,
                        session_id = EXCLUDED.session_id
                """, (watermark_id, block_index, recipient_id, doc_id, session_id))
            conn.commit()
        finally:
            conn.close()

    def find_by_watermark(self, watermark_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM watermark_index WHERE watermark_id = %s", (watermark_id,))
                row = cur.fetchone()
                return self._dict_row(row)
        finally:
            conn.close()

    def find_receipts_by_doc(self, doc_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM watermark_index WHERE doc_id = %s", (doc_id,))
                return [self._dict_row(r) for r in cur.fetchall()]
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
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO protected_documents (
                        doc_id, title, sender_id, recipient_ids_json, doc_hash, protected_pdf, created_at, storage_ref
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (doc_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        sender_id = EXCLUDED.sender_id,
                        recipient_ids_json = EXCLUDED.recipient_ids_json,
                        doc_hash = EXCLUDED.doc_hash,
                        protected_pdf = EXCLUDED.protected_pdf,
                        created_at = EXCLUDED.created_at,
                        storage_ref = EXCLUDED.storage_ref
                """, (
                    doc_id, title, sender_id, recipient_ids_json, doc_hash,
                    psycopg2.Binary(protected_pdf), created_at, storage_ref
                ))
            conn.commit()
        finally:
            conn.close()

    def get_protected_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM protected_documents WHERE doc_id = %s", (doc_id,))
                row = cur.fetchone()
                return self._dict_row(row)
        finally:
            conn.close()

    def list_protected_documents(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM protected_documents ORDER BY created_at DESC")
                return [self._dict_row(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def list_documents_by_sender(self, sender_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM protected_documents WHERE sender_id = %s ORDER BY created_at DESC", (sender_id,))
                return [self._dict_row(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def list_documents_for_recipient(self, recipient_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM protected_documents ORDER BY created_at DESC")
                matching = []
                target = recipient_id.strip().upper()
                for r in cur.fetchall():
                    try:
                        rcpt_ids = json.loads(r["recipient_ids_json"]) if isinstance(r["recipient_ids_json"], str) else []
                        rcpt_upper = [str(x).strip().upper() for x in rcpt_ids]
                        if target in rcpt_upper or target.replace("USER-", "") in rcpt_upper or f"USER-{target}" in rcpt_upper:
                            matching.append(self._dict_row(r))
                    except Exception:
                        continue
                return matching
        finally:
            conn.close()

    def get_config(self, key: str) -> Optional[str]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT value FROM app_config WHERE key = %s", (key,))
                row = cur.fetchone()
                return row['value'] if row else None
        finally:
            conn.close()

    def set_config(self, key: str, value: str) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO app_config (key, value) VALUES (%s, %s)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """, (key, value))
            conn.commit()
        finally:
            conn.close()

    def is_setup_complete(self) -> bool:
        return self.get_config('setup_complete') == 'true'
