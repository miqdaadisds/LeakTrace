"""
Unit tests for Immutable Provenance Ledger and Multi-Validator DLT:
- Merkle Root & Inclusion Proofs
- Multi-Validator Notary Consensus & Quorum Endorsements
- Block mining and cryptographic chaining
- Tamper detection audit (single administrator / rogue actor modification failure)
"""
import time
from app.provenance.merkle_tree import MerkleTree
from app.provenance.ledger import ProvenanceLedger
from app.provenance.validator import validator_network
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


def test_provenance_ledger_and_validator_quorum():
    ledger = ProvenanceLedger()
    assert len(ledger.get_chain()) == 1  # Genesis block

    receipt1 = DecryptionProvenanceReceipt(
        receipt_id="RCPT-001",
        doc_id="DOC-SIH26237",
        recipient_id="USER-BOB",
        session_id="SESS-001",
        watermark_id="WM-TEST-12345678",
        ciphertext_hash="cipher_hash_val",
        timestamp=time.time(),
        device_fingerprint="WORKSTATION-BOB-NODE-01",
        recipient_signature_b64="SIG-ML-DSA-65",
        recipient_public_key_sig_b64="PUB-ML-DSA-65",
        event_digest="event_digest_val"
    )

    block_idx, block_hash = ledger.commit_receipt(receipt1)
    assert block_idx == 1
    assert len(ledger.get_chain()) == 2

    # Verify multi-validator endorsements
    block = ledger.get_chain()[1]
    assert len(block.validator_signatures) >= validator_network.quorum_threshold

    # Verify blockchain cryptographic integrity
    is_valid, msg, _ = ledger.verify_chain_integrity()
    assert is_valid is True

    # Verify Merkle inclusion proof
    proof_info = ledger.get_merkle_proof_for_receipt("WM-TEST-12345678")
    assert proof_info is not None
    assert proof_info["proof_valid"] is True


def test_ledger_tampering_detection():
    """
    Demonstrates PS Requirement:
    Prevents a single administrator or compromised account from silently modifying or deleting historical audit records.
    Modifying any historical record MUST cause verification failure!
    """
    ledger = ProvenanceLedger()

    receipt = DecryptionProvenanceReceipt(
        receipt_id="RCPT-TAMPER-TEST",
        doc_id="DOC-999",
        recipient_id="USER-BOB",
        session_id="SESS-TAMPER",
        watermark_id="WM-TAMPER-999",
        ciphertext_hash="hash_999",
        timestamp=time.time(),
        device_fingerprint="NODE-01",
        recipient_signature_b64="SIG",
        recipient_public_key_sig_b64="PUB",
        event_digest="DIGEST"
    )
    ledger.commit_receipt(receipt)

    # Valid before tampering
    valid_before, _, _ = ledger.verify_chain_integrity()
    assert valid_before is True

    # Malicious admin tampers block #1
    ledger.tamper_historical_record(1, fake_recipient_id="COMPROMISED-ATTACKER")

    # Verification MUST fail immediately
    valid_after, error_msg, _ = ledger.verify_chain_integrity()
    assert valid_after is False
    assert "Tampered" in error_msg or "mismatch" in error_msg
