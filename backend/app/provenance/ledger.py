"""
Immutable Decryption Provenance Ledger (Permissioned DLT).
Append-only, tamper-evident cryptographic blockchain securing decryption receipts
with SHA-256 block-chaining, Merkle root anchoring, and multi-validator notary quorum.
Demonstrates that no single administrator or compromised node can modify historical records.
"""
from typing import List, Optional, Tuple, Dict, Any
import hashlib
import json
import time
from app.core.types import DecryptionProvenanceReceipt, ProvenanceBlock
from app.provenance.merkle_tree import MerkleTree
from app.provenance.validator import validator_network


class ProvenanceLedger:
    def __init__(self):
        self._chain: List[ProvenanceBlock] = []
        self._pending_receipts: List[DecryptionProvenanceReceipt] = []
        # Fast lookup indexes
        self._receipt_by_watermark_id: Dict[str, Tuple[int, DecryptionProvenanceReceipt]] = {} # watermark_id -> (block_idx, receipt)
        self._doc_receipts: Dict[str, List[DecryptionProvenanceReceipt]] = {}
        
        # Initialize Genesis Block
        self._create_genesis_block()

    def _create_genesis_block(self):
        genesis_receipt = DecryptionProvenanceReceipt(
            receipt_id="GENESIS-RECEIPT-0000",
            doc_id="SYSTEM-GENESIS",
            recipient_id="SYSTEM-ROOT",
            session_id="SESS-GENESIS",
            watermark_id="WM-GENESIS-00000000",
            ciphertext_hash="0" * 64,
            timestamp=1727712000.0,
            device_fingerprint="DEFENCE-SECURE-GENESIS-NODE",
            recipient_signature_b64="GENESIS-ML-DSA-SIGNATURE",
            recipient_public_key_sig_b64="GENESIS-PUBLIC-KEY",
            event_digest="0" * 64
        )
        leaf_hash = MerkleTree.hash_leaf(json.dumps(genesis_receipt.model_dump(), sort_keys=True).encode("utf-8"))
        merkle_root = MerkleTree.compute_root([leaf_hash])
        
        # Multi-validator signatures on Genesis block
        validator_sigs = validator_network.endorse_block(
            block_index=0,
            prev_hash="0" * 64,
            merkle_root=merkle_root,
            timestamp=genesis_receipt.timestamp
        )

        block_hash = self._calculate_block_hash(0, "0" * 64, merkle_root, genesis_receipt.timestamp, validator_sigs)
        genesis_block = ProvenanceBlock(
            block_index=0,
            timestamp=genesis_receipt.timestamp,
            previous_hash="0" * 64,
            merkle_root=merkle_root,
            receipts=[genesis_receipt],
            validator_signatures=validator_sigs,
            block_hash=block_hash
        )
        self._chain.append(genesis_block)
        self._receipt_by_watermark_id[genesis_receipt.watermark_id] = (0, genesis_receipt)

    @staticmethod
    def _calculate_block_hash(
        index: int,
        prev_hash: str,
        merkle_root: str,
        timestamp: float,
        validator_signatures: List[Dict[str, str]]
    ) -> str:
        sig_summary = ",".join(sorted(s.get("signature_b64", "")[:16] for s in validator_signatures))
        payload = f"{index}|{prev_hash}|{merkle_root}|{timestamp}|{sig_summary}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def commit_receipt(self, receipt: DecryptionProvenanceReceipt) -> Tuple[int, str]:
        """
        Commits a signed decryption receipt into the blockchain ledger.
        Collects multi-validator endorsements and mints a verified block.
        Returns: (block_index, block_hash)
        """
        self._pending_receipts.append(receipt)
        
        if receipt.doc_id not in self._doc_receipts:
            self._doc_receipts[receipt.doc_id] = []
        self._doc_receipts[receipt.doc_id].append(receipt)

        prev_block = self._chain[-1]
        new_index = prev_block.block_index + 1
        now = time.time()

        # Compute Merkle Root for receipts in block
        leaf_hashes = [
            MerkleTree.hash_leaf(json.dumps(r.model_dump(), sort_keys=True).encode("utf-8"))
            for r in self._pending_receipts
        ]
        merkle_root = MerkleTree.compute_root(leaf_hashes)

        # Collect multi-node notary endorsements
        validator_sigs = validator_network.endorse_block(
            block_index=new_index,
            prev_hash=prev_block.block_hash,
            merkle_root=merkle_root,
            timestamp=now
        )

        block_hash = self._calculate_block_hash(new_index, prev_block.block_hash, merkle_root, now, validator_sigs)

        new_block = ProvenanceBlock(
            block_index=new_index,
            timestamp=now,
            previous_hash=prev_block.block_hash,
            merkle_root=merkle_root,
            receipts=list(self._pending_receipts),
            validator_signatures=validator_sigs,
            block_hash=block_hash
        )
        self._chain.append(new_block)

        # Index by opaque watermark_id for rapid deterministic forensic lookup
        for r in self._pending_receipts:
            self._receipt_by_watermark_id[r.watermark_id] = (new_index, r)

        self._pending_receipts = []
        return new_index, block_hash

    def lookup_by_watermark_id(self, wm_id: str) -> Optional[Tuple[int, DecryptionProvenanceReceipt]]:
        """Finds the corresponding block index and receipt for an opaque forensic watermark_id."""
        return self._receipt_by_watermark_id.get(wm_id)

    def get_merkle_proof_for_receipt(self, watermark_id: str) -> Optional[Dict[str, Any]]:
        """Generates Merkle tree inclusion proof for a receipt in its block."""
        entry = self.lookup_by_watermark_id(wm_id=watermark_id)
        if not entry:
            return None
        block_idx, receipt = entry
        block = self._chain[block_idx]

        leaf_hashes = [
            MerkleTree.hash_leaf(json.dumps(r.model_dump(), sort_keys=True).encode("utf-8"))
            for r in block.receipts
        ]
        target_bytes = json.dumps(receipt.model_dump(), sort_keys=True).encode("utf-8")
        target_leaf = MerkleTree.hash_leaf(target_bytes)

        try:
            target_idx = leaf_hashes.index(target_leaf)
        except ValueError:
            target_idx = 0

        proof_path = MerkleTree.generate_proof(leaf_hashes, target_idx)
        is_valid = MerkleTree.verify_proof(target_leaf, proof_path, block.merkle_root)

        return {
            "block_index": block_idx,
            "block_hash": block.block_hash,
            "merkle_root": block.merkle_root,
            "proof_valid": is_valid,
            "proof_path": proof_path
        }

    def verify_chain_integrity(self) -> Tuple[bool, str, List[Dict[str, Any]]]:
        """
        Runs comprehensive cryptographic verification on the entire blockchain ledger:
        1. Validates previous_hash chaining between consecutive blocks.
        2. Recomputes Merkle root for all receipts in each block.
        3. Recomputes block_hash.
        4. Validates multi-validator quorum signatures.
        """
        audit_trail = []
        for i, block in enumerate(self._chain):
            step_info = {
                "block_index": block.block_index,
                "receipts_count": len(block.receipts),
                "hash": block.block_hash,
                "status": "VALID"
            }

            # 1. Chain continuity
            if i > 0:
                prev_block = self._chain[i - 1]
                if block.previous_hash != prev_block.block_hash:
                    step_info["status"] = "BROKEN_LINK"
                    return False, f"Broken chain link at block {i}: previous_hash mismatch.", audit_trail

            # 2. Merkle Root integrity
            leaf_hashes = [
                MerkleTree.hash_leaf(json.dumps(r.model_dump(), sort_keys=True).encode("utf-8"))
                for r in block.receipts
            ]
            expected_merkle = MerkleTree.compute_root(leaf_hashes)
            if expected_merkle != block.merkle_root:
                step_info["status"] = "TAMPERED_MERKLE_ROOT"
                return False, f"Tampered Merkle root at block {i}: calculated {expected_merkle[:16]} != recorded {block.merkle_root[:16]}.", audit_trail

            # 3. Block hash integrity
            expected_block_hash = self._calculate_block_hash(
                block.block_index, block.previous_hash, block.merkle_root, block.timestamp, block.validator_signatures
            )
            if expected_block_hash != block.block_hash:
                step_info["status"] = "TAMPERED_BLOCK_HASH"
                return False, f"Tampered block hash at block {i}: header modified.", audit_trail

            # 4. Multi-validator quorum verification
            if block.block_index > 0:  # Skip genesis mock for validator test
                is_quorum, count, quorum_desc = validator_network.verify_block_quorum(
                    block.block_index, block.previous_hash, block.merkle_root, block.timestamp, block.validator_signatures
                )
                if not is_quorum:
                    step_info["status"] = "QUORUM_FAILURE"
                    return False, f"Quorum failure at block {i}: only {count} valid validator signatures.", audit_trail

            audit_trail.append(step_info)

        return True, "Blockchain ledger integrity 100% verified across all blocks and multi-validator notary nodes.", audit_trail

    def tamper_historical_record(self, block_index: int, fake_recipient_id: str = "COMPROMISED-ATTACKER") -> Dict[str, Any]:
        """
        Simulates an unauthorized database write / single-admin tampering attempt.
        Modifies a historical decryption receipt in place to test whether the system detects it.
        """
        if block_index < 0 or block_index >= len(self._chain):
            raise IndexError("Block index out of bounds.")

        target_block = self._chain[block_index]
        if not target_block.receipts:
            raise ValueError("Target block contains no receipts to tamper.")

        original_recipient = target_block.receipts[0].recipient_id
        # Silently mutate the record
        target_block.receipts[0].recipient_id = fake_recipient_id

        return {
            "tampered_block_index": block_index,
            "original_recipient_id": original_recipient,
            "tampered_recipient_id": fake_recipient_id,
            "message": "Block data modified. Run verify_chain_integrity to observe tamper detection failure."
        }

    def restore_historical_record(self, block_index: int, original_recipient_id: str) -> None:
        """Restores a historical record after running a tamper verification test."""
        if 0 <= block_index < len(self._chain):
            target_block = self._chain[block_index]
            if target_block.receipts:
                target_block.receipts[0].recipient_id = original_recipient_id

    def get_chain(self) -> List[ProvenanceBlock]:
        return self._chain


provenance_ledger = ProvenanceLedger()
