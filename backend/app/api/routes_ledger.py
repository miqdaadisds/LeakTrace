"""
Immutable Provenance Ledger & Merkle Blockchain API Routes.
Provides inspection of confirmed blockchain blocks, Merkle inclusion verification,
and real-time cryptographic audit of the tamper-evident chain.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from app.core.types import ProvenanceBlock, DecryptionProvenanceReceipt
from app.provenance.ledger import provenance_ledger

router = APIRouter(prefix="/api/ledger", tags=["Provenance Ledger"])


@router.get("/blocks", response_model=List[ProvenanceBlock])
def get_blocks(limit: int = 50):
    """Returns the latest confirmed blockchain blocks in chronological order."""
    return provenance_ledger.get_blocks(limit=limit)


@router.get("/verify")
def verify_blockchain_integrity():
    """
    Executes a complete cryptographic integrity audit across all blocks in the ledger:
    - Validates SHA-256 block hash chaining
    - Recomputes and verifies Merkle tree root hashes for every block's receipts
    - Detects any unauthorized modification or tampering
    """
    is_valid, message = provenance_ledger.verify_chain_integrity()
    blocks = provenance_ledger.get_blocks()
    total_receipts = sum(len(b.receipts) for b in blocks)

    return {
        "is_valid": is_valid,
        "message": message,
        "total_blocks": len(blocks),
        "total_receipts": total_receipts,
        "genesis_hash": blocks[0].block_hash if blocks else None,
        "latest_block_hash": blocks[-1].block_hash if blocks else None
    }


@router.get("/doc/{doc_id}/receipts", response_model=List[DecryptionProvenanceReceipt])
def get_receipts_for_document(doc_id: str):
    """Retrieves all decryption provenance receipts committed for a specific classified document."""
    return provenance_ledger.get_receipts_for_doc(doc_id)
