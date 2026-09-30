"""
Unit tests for Immutable Provenance Ledger and Merkle Tree:
- Merkle Root & Inclusion Proofs
- Block mining and cryptographic chaining
- Tamper detection audit
"""
import json
import time
from app.provenance.merkle_tree import MerkleTree
from app.provenance.ledger import ProvenanceLedger
from app.core.types import DecryptionProvenanceReceipt


def test_merkle_tree_proof_verification():
    leaves = [
        MerkleTree.hash_leaf(b"receipt-0"),
        MerkleTree.hash_leaf(b"receipt-1"),
        MerkleTree.hash_leaf(b"receipt-2"),
        MerkleTree.hash_leaf(b"receipt-3")
    ]
    root = MerkleTree.compute_root(leaves)
    assert len(root) == 64

    # Generate and verify proof for leaf 2
    proof = MerkleTree.generate_proof(leaves, 2)
    assert MerkleTree.verify_proof(leaves[2], proof, root) is True

    # Tampered leaf must fail verification
    tampered_leaf = MerkleTree.hash_leaf(b"receipt-tampered")
    assert MerkleTree.verify_proof(tampered_leaf, proof, root) is False


def test_provenance_ledger_lifecycle():
    ledger = ProvenanceLedger()
    assert len(ledger.get_blocks()) == 1  # Genesis block

    receipt1 = DecryptionProvenanceReceipt(
        receipt_id="RCPT-001",
        doc_id="DOC-NAVY-01",
        recipient_id="DEF-NAVY-0842",
        timestamp=time.time(),
        watermark_hash="wm_hash_12345",
        device_fingerprint="NAVY-NODE-01",
        recipient_signature_b64="SIG-1"
    )

    block_idx, block_hash = ledger.commit_receipt(receipt1)
    assert block_idx == 1
    assert len(ledger.get_blocks()) == 2

    # Lookup by watermark hash
    found = ledger.lookup_by_watermark_hash("wm_hash_12345")
    assert found is not None
    assert found[0] == 1
    assert found[1].receipt_id == "RCPT-001"

    # Verify blockchain cryptographic integrity
    is_valid, msg = ledger.verify_chain_integrity()
    assert is_valid is True
    assert "100% verified" in msg
