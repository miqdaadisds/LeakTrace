-- =========================================================================
-- LeakTrace: Central PostgreSQL / Supabase Schema Definition
-- Ministry of Defence (WESEE) - Post-Quantum Cryptographic Provenance System
-- SIH 2026 Problem Statement No. 237 (ID: 26237)
-- =========================================================================

-- 1. IDENTITIES TABLE
-- Stores public key material and authorization profiles.
-- ZERO PRIVATE KEYS OR PLAINTEXT PASSWORDS EVER STORED HERE.
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

-- 2. IDENTITY KEY HISTORY & VERSIONING TABLE
-- Preserves previous public keys for immutable historical signature verification
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

-- 3. SESSIONS TABLE
-- Centralized opaque session tokens with explicit expiration
CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES identities(recipient_id) ON DELETE CASCADE,
    created_at DOUBLE PRECISION NOT NULL,
    expires_at DOUBLE PRECISION NOT NULL
);

-- 4. CRYPTOGRAPHIC AUTH CHALLENGES TABLE
-- Ephemeral nonces for Zero-Password Challenge-Response Login
CREATE TABLE IF NOT EXISTS auth_challenges (
    challenge_id VARCHAR(255) PRIMARY KEY,
    recipient_id VARCHAR(255) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    created_at DOUBLE PRECISION NOT NULL,
    expires_at DOUBLE PRECISION NOT NULL
);

-- 5. PERMISSIONED DLT LEDGER BLOCKS TABLE
-- Append-only provenance ledger with 3-of-4 logical validator consensus
CREATE TABLE IF NOT EXISTS ledger_blocks (
    block_index INTEGER PRIMARY KEY,
    block_hash VARCHAR(255) NOT NULL,
    prev_hash VARCHAR(255) NOT NULL,
    merkle_root VARCHAR(255) NOT NULL,
    timestamp_utc DOUBLE PRECISION NOT NULL,
    receipts_json TEXT NOT NULL,
    endorsements_json TEXT NOT NULL
);

-- 6. WATERMARK INDEX TABLE
-- Fast reverse-lookup mapping from forensic watermark IDs to ledger blocks & recipients
CREATE TABLE IF NOT EXISTS watermark_index (
    watermark_id VARCHAR(255) PRIMARY KEY,
    block_index INTEGER NOT NULL REFERENCES ledger_blocks(block_index),
    recipient_id VARCHAR(255) NOT NULL,
    doc_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL
);

-- 7. PROTECTED DOCUMENTS TABLE
-- Metadata and references for genuine AES-256 encrypted PDFs with ML-KEM recipient slots
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

-- 8. SYSTEM CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS app_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
);

-- 9. PERFORMANCE & QUERY OPTIMIZATION INDEXES
CREATE INDEX IF NOT EXISTS idx_identities_role ON identities(role);
CREATE INDEX IF NOT EXISTS idx_watermark_doc ON watermark_index(doc_id);
CREATE INDEX IF NOT EXISTS idx_watermark_recipient ON watermark_index(recipient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON auth_challenges(expires_at);
