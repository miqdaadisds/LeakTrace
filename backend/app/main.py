"""
Indian Navy WESEE Cryptographic Attribution & Decryption Provenance System
Smart India Hackathon (SIH) 2026 - Problem Statement No. 237 (ID: 26237).

Main FastAPI Application Entrypoint.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes_documents import router as documents_router
from app.api.routes_decryption import router as decryption_router
from app.api.routes_forensics import router as forensics_router
from app.api.routes_ledger import router as ledger_router
from app.core.state import system_state
from app.provenance.ledger import provenance_ledger

app = FastAPI(
    title="WESEE Cryptographic Attribution & Provenance System",
    description=(
        "Production-grade reference implementation for SIH 2026 Problem Statement #26237 "
        "(Ministry of Defence - Indian Navy WESEE). Features hybrid Post-Quantum ML-KEM-768 "
        "envelope distribution, decryption-time steganographic watermarking (Text Zero-Width & "
        "Visual 2D DCT-QIM), and an immutable Merkle blockchain ledger for forensic leak non-repudiation."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration for seamless frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register decoupled modular routers
app.include_router(documents_router)
app.include_router(decryption_router)
app.include_router(forensics_router)
app.include_router(ledger_router)


@app.get("/")
def root():
    return {
        "system": "Indian Navy WESEE Cryptographic Attribution & Provenance System",
        "sih_problem_statement": "SIH 2026 PS No. 237 (ID: 26237)",
        "organization": "Ministry of Defence / Weapons & Electronics Systems Engineering Establishment (WESEE)",
        "theme": "Blockchain & Cybersecurity",
        "status": "OPERATIONAL // GREEN",
        "pqc_standards": ["NIST FIPS 203 ML-KEM-768", "X25519 Hybrid", "AES-256-GCM"],
        "steganography": ["Text Zero-Width Unicode Stego", "Visual 2D DCT-QIM"],
        "ledger": "SHA-256 Merkle-Chained Provenance Blockchain",
        "docs_url": "/docs"
    }


@app.get("/api/system/status")
def system_status():
    blocks = provenance_ledger.get_blocks()
    officers = system_state.get_all_profiles()
    docs = list(system_state.documents.values())

    return {
        "status": "ONLINE",
        "pqc_kem_algorithm": "ML-KEM-768 + X25519 (Hybrid)",
        "symmetric_cipher": "AES-256-GCM",
        "signature_scheme": "Ed25519 / ML-DSA",
        "officers_enrolled": len(officers),
        "documents_active": len(docs),
        "blockchain_blocks_count": len(blocks),
        "ledger_verified": provenance_ledger.verify_chain_integrity()[0]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
