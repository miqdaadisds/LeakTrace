import sqlite3
import os
import json
import time

class Database:
    def __init__(self, db_path=None):
        if db_path is None:
            self.db_path = os.environ.get('LEAKTRACE_DB', 'leaktrace.db')
        else:
            self.db_path = db_path
        # Need to ensure thread safety when using connection, 
        # so we'll open a connection per request or method, or use check_same_thread=False
        
    def _get_connection(self):
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

                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES identities(recipient_id),
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
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS app_config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            """)
            conn.commit()
        finally:
            conn.close()

        # Automatically seed default administrator and personnel if new database
        self.seed_defaults()

    def seed_defaults(self):
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
        except Exception as e:
            # Suppress or log non-fatal seed warnings
            pass

    def get_identity(self, recipient_id):
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
            return cursor.fetchone()
        finally:
            conn.close()

    def list_identities(self):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM identities")
            return cursor.fetchall()
        finally:
            conn.close()

    def list_identities_by_role(self, role):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM identities WHERE role = ?", (role,))
            return cursor.fetchall()
        finally:
            conn.close()

    def insert_identity(self, recipient_id, name, unit, role, encrypted_vault, public_key_kem, public_key_sig, recovery_key_hash, fingerprint, created_at, is_revoked=0):
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

    def update_identity_role(self, recipient_id, role):
        conn = self._get_connection()
        try:
            conn.execute("UPDATE identities SET role = ? WHERE recipient_id = ?", (role, recipient_id))
            conn.commit()
        finally:
            conn.close()

    def revoke_identity(self, recipient_id):
        conn = self._get_connection()
        try:
            conn.execute("UPDATE identities SET is_revoked = 1 WHERE recipient_id = ?", (recipient_id,))
            conn.commit()
        finally:
            conn.close()

    def is_identity_revoked(self, recipient_id):
        row = self.get_identity(recipient_id)
        return bool(row and row['is_revoked'])

    def insert_session(self, token, user_id, created_at, expires_at):
        conn = self._get_connection()
        try:
            conn.execute("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", (token, user_id, created_at, expires_at))
            conn.commit()
        finally:
            conn.close()

    def get_session(self, token):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM sessions WHERE token = ?", (token,))
            return cursor.fetchone()
        finally:
            conn.close()

    def delete_session(self, token):
        conn = self._get_connection()
        try:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
        finally:
            conn.close()

    def cleanup_expired_sessions(self):
        conn = self._get_connection()
        try:
            conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
            conn.commit()
        finally:
            conn.close()

    def insert_block(self, block_index, block_hash, prev_hash, merkle_root, timestamp_utc, receipts_json, endorsements_json):
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

    def get_latest_block(self):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ledger_blocks ORDER BY block_index DESC LIMIT 1")
            return cursor.fetchone()
        finally:
            conn.close()

    def get_block(self, block_index):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ledger_blocks WHERE block_index = ?", (block_index,))
            return cursor.fetchone()
        finally:
            conn.close()

    def get_all_blocks(self):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ledger_blocks ORDER BY block_index ASC")
            return cursor.fetchall()
        finally:
            conn.close()

    def block_count(self):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT COUNT(*) FROM ledger_blocks")
            return cursor.fetchone()[0]
        finally:
            conn.close()

    def insert_watermark_index(self, watermark_id, block_index, recipient_id, doc_id, session_id):
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

    def find_by_watermark(self, watermark_id):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM watermark_index WHERE watermark_id = ?", (watermark_id,))
            return cursor.fetchone()
        finally:
            conn.close()

    def find_receipts_by_doc(self, doc_id):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM watermark_index WHERE doc_id = ?", (doc_id,))
            return cursor.fetchall()
        finally:
            conn.close()

    def store_protected_document(self, doc_id, title, sender_id, recipient_ids_json, doc_hash, protected_pdf, created_at):
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT INTO protected_documents (
                    doc_id, title, sender_id, recipient_ids_json, doc_hash, protected_pdf, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (doc_id, title, sender_id, recipient_ids_json, doc_hash, protected_pdf, created_at))
            conn.commit()
        finally:
            conn.close()

    def get_protected_document(self, doc_id):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM protected_documents WHERE doc_id = ?", (doc_id,))
            return cursor.fetchone()
        finally:
            conn.close()

    def list_protected_documents(self):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM protected_documents")
            return cursor.fetchall()
        finally:
            conn.close()

    def list_documents_by_sender(self, sender_id):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM protected_documents WHERE sender_id = ?", (sender_id,))
            return cursor.fetchall()
        finally:
            conn.close()

    def get_config(self, key):
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT value FROM app_config WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row['value'] if row else None
        finally:
            conn.close()

    def set_config(self, key, value):
        conn = self._get_connection()
        try:
            conn.execute("INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
            conn.commit()
        finally:
            conn.close()

    def is_setup_complete(self):
        return self.get_config('setup_complete') == 'true'
