"""
Immutable Decryption Provenance Ledger.
Append-only, tamper-evident cryptographic blockchain securing decryption receipts
with SHA-256 block-chaining and Merkle root anchoring.
"""
from typing import List, Optional, Tuple, Dict
import hashlib
import json
import time
from app.core.types import DecryptionProvenanceReceipt, ProvenanceBlock
from app.provenance.merkle_tree import MerkleTree


class ProvenanceLedger:
    def __init__(self):
        self._chain: List[ProvenanceBlock] = []
        self._pending_receipts: List[DecryptionProvenanceReceipt] = []
        # Fast lookup indexes
        self._receipt_index: Dict[str, Tuple[int, DecryptionProvenanceReceipt]] = {} # watermark_hash -> (block_idx, receipt)
        self._doc_receipts: Dict[str, List[DecryptionProvenanceReceipt]] = {}
        
        # Initialize Genesis Block
        self._create_genesis_block()

    def _create_genesis_block(self):
        genesis_receipt = DecryptionProvenanceReceipt(
            receipt_id="GENESIS-RECEIPT-0000",
            doc_id="SYSTEM-GENESIS",
            recipient_id="SYSTEM-ROOT",
            timestamp=1727712000.0,
            watermark_hash="0" * 64,
            device_fingerprint="DEFENCE-SECURE-GENESIS-NODE",
            recipient_signature_b64="GENESIS-SIGNATURE"
        )
        leaf_hash = MerkleTree.hash_leaf(json.dumps(genesis_receipt.model_dump(), sort_keys=True).encode("utf-8"))
        merkle_root = MerkleTree.compute_root([leaf_hash])
        
        block_hash = self._calculate_block_hash(0, "0" * 64, merkle_root, genesis_receipt.timestamp)
        genesis_block = ProvenanceBlock(
            block_index=0,
            timestamp=genesis_receipt.timestamp,
            previous_hash="0" * 64,
            merkle_root=merkle_root,
            receipts=[genesis_receipt],
            block_hash=block_hash
        )
        self._chain.append(genesis_block)
        self._receipt_index[genesis_receipt.watermark_hash] = (0, genesis_receipt)

    @staticmethod
    def _calculate_block_hash(index: int, prev_hash: str, merkle_root: str, timestamp: float) -> str:
        payload = f"{index}|{prev_hash}|{merkle_root}|{timestamp}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def commit_receipt(self, receipt: DecryptionProvenanceReceipt) -> Tuple[int, str]:
        """
        Commits a signed decryption receipt into the blockchain ledger.
        Returns: (block_index, block_hash)
        """
        self._pending_receipts.append(receipt)
        
        # Index immediately
        if receipt.doc_id not in self._doc_receipts:
            self._doc_receipts[receipt.doc_id] = []
        self._doc_receipts[receipt.doc_id].append(receipt)

        # For defense audit immediacy, each decryption event mints a confirmed block
        prev_block = self._chain[-1]
        new_index = prev_block.block_index + 1
        now = time.time()

        # Compute Merkle Root for receipts in block
        leaf_hashes = [
            MerkleTree.hash_leaf(json.dumps(r.model_dump(), sort_keys=True).encode("utf-8"))
            for r in self._pending_receipts
        ]
        merkle_root = MerkleTree.compute_root(leaf_hashes)
        block_hash = self._calculate_block_hash(new_index, prev_block.block_hash, merkle_root, now)

        new_block = ProvenanceBlock(
            block_index=new_index,
            timestamp=now,
            previous_hash=prev_block.block_hash,
            merkle_root=merkle_root,
            receipts=list(self._pending_receipts),
            block_hash=block_hash
        )
        self._chain.append(new_block)

        # Index watermarks
        for r in self._pending_receipts:
            self._receipt_index[r.watermark_hash] = (new_index, r)

        self._pending_receipts = []
        return new_index, block_hash

    def lookup_by_watermark_hash(self, wm_hash: str) -> Optional[Tuple[int, DecryptionProvenanceReceipt]]:
        """Finds the corresponding block and receipt for a forensic watermark hash."""
        return self._receipt_index.get(wm_hash)

    def get_blocks(self, limit: int = 50) -> List[ProvenanceBlock]:
        """Returns the latest confirmed blocks."""
        return self._chain[-limit:]

    def get_receipts_for_doc(self, doc_id: str) -> List[DecryptionProvenanceReceipt]:
        return self._doc_receipts.get(doc_id, [])

    def verify_chain_integrity(self) -> Tuple[bool, str]:
        """
        Validates the entire cryptographic chain from Genesis to tip.
        """
        for i in range(1, len(self._chain)):
            current = self._chain[i]
            prev = self._chain[i - 1]

            # Check previous hash link
            if current.previous_hash != prev.block_hash:
                return False, f"Broken link at block #{current.block_index}: previous_hash mismatch."

            # Verify Merkle Root
            leaf_hashes = [
                MerkleTree.hash_leaf(json.dumps(r.model_dump(), sort_keys=True).encode("utf-8"))
                for r in current.receipts
            ]
            expected_root = MerkleTree.compute_root(leaf_hashes)
            if current.merkle_root != expected_root:
                return False, f"Tampered Merkle root at block #{current.block_index}."

            # Verify Block Hash
            expected_hash = self._calculate_block_hash(
                current.block_index, current.previous_hash, current.merkle_root, current.timestamp
            )
            if current.block_hash != expected_hash:
                return False, f"Invalid block hash at block #{current.block_index}."

        return True, "Blockchain cryptographic integrity 100% verified back to Genesis."


provenance_ledger = ProvenanceLedger()
