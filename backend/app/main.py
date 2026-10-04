"""
TraceLeak: Cryptographic Attribution & Immutable Decryption Provenance for Multi-Recipient Encrypted Document Distribution
Smart India Hackathon (SIH) 2026 - Problem Statement No. 237 (ID: 26237).
Organization: Ministry of Defence (WESEE).

Main FastAPI Application Entrypoint.
"""
from pathlib import Path
import time
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.events import event_broker

try:
    from app.db.database import Database
    from app.auth import middleware
    from app.api.routes_auth import router as auth_router
except ImportError:
    from backend.app.db.database import Database
    from backend.app.auth import middleware
    from backend.app.api.routes_auth import router as auth_router

from app.api.routes_identity import router as identity_router
from app.api.routes_distribution import router as distribution_router
from app.api.routes_recipient import router as recipient_router
from app.api.routes_forensics import router as forensics_router
from app.api.routes_ledger import router as ledger_router
from app.api.routes_security import router as security_router
from app.core.state import system_state
from app.provenance.ledger import provenance_ledger

# Initialize SQLite database
database = Database()
database.initialize()
middleware.db = database
provenance_ledger.db = database
system_state.sync_from_db(database)

app = FastAPI(
    title="TraceLeak: Cryptographic Attribution & Provenance System",
    description=(
        "Production-grade implementation for SIH 2026 Problem Statement #26237 "
        "(Ministry of Defence - WESEE). Features NIST FIPS 203 ML-KEM-768 hybrid envelope "
        "distribution, Argon2id protected credential vaults, local recipient decryption, "
        "dynamic forensic watermarking, NIST FIPS 204 ML-DSA-65 non-repudiation signing, "
        "and multi-validator permissioned DLT for immutable leak attribution."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register modular API routes
app.include_router(auth_router)
app.include_router(identity_router)
app.include_router(distribution_router)
app.include_router(recipient_router)
app.include_router(forensics_router)
app.include_router(ledger_router)
app.include_router(security_router)


@app.get("/api/system/info")
def system_info():
    return {
        "system": "TraceLeak Cryptographic Attribution & Provenance Enclave",
        "sih_problem_statement": "SIH 2026 PS No. 237 (ID: 26237)",
        "organization": "Ministry of Defence / WESEE",
        "theme": "Blockchain & Post-Quantum Cybersecurity",
        "status": "OPERATIONAL // ZERO-LEAK ASSURANCE",
        "pqc_standards": {
            "key_encapsulation": "NIST FIPS 203 ML-KEM-768 + X25519",
            "digital_signatures": "NIST FIPS 204 ML-DSA-65",
            "symmetric_cipher": "AES-256-GCM (O(1) single ciphertext)",
            "credential_vault_kdf": "Argon2id (Memory-Hard Password Protection)"
        },
        "provenance_dlt": "Permissioned Multi-Validator Notary Consensus (4 Logical Validators NODE-01..04, 3-of-4 Quorum)",
        "watermarking": "Dynamic Recipient-Session Structural PDF & Zero-Width Content Injection",
        "docs_url": "/docs"
    }


@app.get("/api/system/status")
def system_status():
    is_valid, msg, _ = provenance_ledger.verify_chain_integrity()
    return {
        "system": "TraceLeak",
        "status": "ONLINE",
        "pqc_kem_algorithm": "NIST FIPS 203 ML-KEM-768",
        "pqc_sig_algorithm": "NIST FIPS 204 ML-DSA-65",
        "symmetric_cipher": "AES-256-GCM",
        "kdf": "Argon2id",
        "recipients_enrolled": len(system_state.identities),
        "documents_active": len(system_state.document_metadata),
        "blockchain_blocks_count": len(provenance_ledger.get_chain()),
        "ledger_verified": is_valid,
        "notary_quorum_status": "3-of-4 Quorum Active (4 Logical Validators NODE-01..04)"
    }


@app.get("/health")
def health_check():
    """Lightweight Render cold-start and health check endpoint."""
    return {
        "status": "healthy",
        "service": "TraceLeak Enclave",
        "mode": "connected" if getattr(database, "database_url", None) else "offline",
        "timestamp": time.time()
    }


@app.get("/api/version")
def api_version():
    """Version and standard metadata."""
    return {
        "version": "2.0.0",
        "pqc_kem": "NIST FIPS 203 ML-KEM-768",
        "pqc_sig": "NIST FIPS 204 ML-DSA-65",
        "deployment": "Render + Supabase Multi-Client Enclave",
        "mode": "connected" if getattr(database, "database_url", None) else "offline"
    }


@app.get("/api/events")
async def root_events_sse():
    """Server-Sent Events endpoint for real-time dashboard subscriptions."""
    return StreamingResponse(
        event_broker.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/events/poll")
def root_events_poll(since: float = 0.0):
    """Polling fallback for event stream."""
    return {"events": event_broker.get_recent_events(since=since)}


@app.get("/")
def enclave_root():
    return {
        "status": "online",
        "service": "TraceLeak Cryptographic Attribution & Provenance Enclave",
        "version": "2.0.0",
        "health": "/health",
        "system_status": "/api/system/status",
        "docs": "/docs"
    }


# Mount built frontend production assets for seamless single-port hosting if available
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/app", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

