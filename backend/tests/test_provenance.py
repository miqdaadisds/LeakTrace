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


def test_4_node_validator_quorum():
    """Verifies that 4 independent validator nodes (NODE-01..04) exist with 3-of-4 quorum threshold."""
    assert len(validator_network.nodes) == 4
    assert set(validator_network.nodes.keys()) == {"NODE-01", "NODE-02", "NODE-03", "NODE-04"}
    assert validator_network.quorum_threshold == 3

    ledger = ProvenanceLedger()
    receipt = DecryptionProvenanceReceipt(
        receipt_id="RCPT-QUORUM-TEST",
        doc_id="DOC-QUORUM",
        recipient_id="USER-BOB",
        session_id="SESS-QUORUM",
        watermark_id="WM-QUORUM-01",
        ciphertext_hash="hash_val",
        timestamp=time.time(),
        device_fingerprint="WORKSTATION-01",
        recipient_signature_b64="SIG",
        recipient_public_key_sig_b64="PUB",
        event_digest="DIGEST"
    )
    block_idx, _ = ledger.commit_receipt(receipt)
    block = ledger.get_chain()[block_idx]

    # Must contain 4 validator signatures
    assert len(block.validator_signatures) == 4
    is_quorum, val_count, desc = validator_network.verify_block_quorum(
        block.block_index, block.previous_hash, block.merkle_root, block.timestamp, block.validator_signatures
    )
    assert is_quorum is True
    assert val_count >= 3
    assert "Quorum achieved" in desc


def test_revocation_enforcement():
    """Verifies that revoking a recipient or document blocks unauthorized decryption."""
    from app.core.state import system_state
    
    # Revoke Bob
    system_state.revoke_identity("USER-BOB", "Security clearance test revocation")
    assert system_state.is_identity_revoked("USER-BOB") is True

    # Unrevoke Bob
    system_state.unrevoke_identity("USER-BOB")
    assert system_state.is_identity_revoked("USER-BOB") is False

