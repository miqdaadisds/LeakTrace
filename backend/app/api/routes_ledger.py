"""
Immutable Decryption Provenance Ledger & Multi-Validator DLT API Routes.
Provides endpoints for inspecting blockchain blocks, verifying cryptographic chain integrity,
validating multi-validator notary quorum, and executing tamper-detection simulations.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.types import ProvenanceBlock
from app.provenance.ledger import provenance_ledger
from app.provenance.validator import validator_network

router = APIRouter(prefix="/api/ledger", tags=["Provenance Ledger"])


class TamperTestRequest(BaseModel):
    block_index: int = Field(default=1, ge=0, description="Block index to tamper")
    fake_recipient: str = Field(default="COMPROMISED-ATTACKER", description="Forged recipient ID to inject")


@router.get("/blocks", response_model=List[ProvenanceBlock])
def get_ledger_blocks():
    """Returns the full append-only blockchain ledger with Merkle roots and validator signatures."""
    return provenance_ledger.get_chain()


@router.get("/verify")
def verify_ledger():
    """
    Runs full cryptographic integrity audit across the entire blockchain:
    1. Previous-hash linkage.
    2. Merkle root recomputation.
    3. Multi-validator notary quorum signatures.
    """
    is_valid, message, audit_trail = provenance_ledger.verify_chain_integrity()
    return {
        "is_valid": is_valid,
        "message": message,
        "blocks_count": len(provenance_ledger.get_chain()),
        "audit_trail": audit_trail
    }


@router.post("/tamper-test")
def tamper_historical_record(req: TamperTestRequest):
    """
    Simulates an unauthorized database write or rogue administrator attempt to alter history:
    1. Silently modifies a historical decryption receipt in place.
    2. Immediately triggers a chain integrity audit.
    3. Visibly demonstrates that the tampering causes verification failure!
    """
    try:
        tamper_info = provenance_ledger.tamper_historical_record(
            block_index=req.block_index,
            fake_recipient_id=req.fake_recipient
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Run verification to show the failure
    is_valid, message, audit_trail = provenance_ledger.verify_chain_integrity()

    return {
        "tamper_executed": True,
        "tamper_details": tamper_info,
        "verification_result": {
            "is_valid": is_valid,
            "message": message,
            "detected_tampering": not is_valid
        }
    }


@router.get("/validators")
def get_validators():
    """Returns the registered independent notary validator nodes and network quorum configuration."""
    return {
        "quorum_threshold": validator_network.quorum_threshold,
        "total_nodes": len(validator_network.nodes),
        "validators": validator_network.get_validators_info()
    }
