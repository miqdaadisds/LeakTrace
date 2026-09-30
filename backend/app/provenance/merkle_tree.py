"""
Cryptographic Merkle Tree Subsystem.
Computes immutable Merkle roots and generates inclusion proofs for decryption provenance receipts.
"""
from typing import List, Tuple
import hashlib
import json


class MerkleTree:
    @staticmethod
    def hash_leaf(data_bytes: bytes) -> str:
        """Computes leaf hash prefixed with 0x00 for second-preimage attack resistance."""
        return hashlib.sha256(b"\x00" + data_bytes).hexdigest()

    @staticmethod
    def hash_nodes(left_hash: str, right_hash: str) -> str:
        """Computes internal node hash prefixed with 0x01."""
        combined = b"\x01" + left_hash.encode("utf-8") + right_hash.encode("utf-8")
        return hashlib.sha256(combined).hexdigest()

    @classmethod
    def compute_root(cls, leaf_hashes: List[str]) -> str:
        """
        Computes the cryptographic Merkle Root from an array of leaf hashes.
        """
        if not leaf_hashes:
            return "0" * 64
        if len(leaf_hashes) == 1:
            return leaf_hashes[0]

        current_level = list(leaf_hashes)
        while len(current_level) > 1:
            next_level = []
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                if i + 1 < len(current_level):
                    right = current_level[i + 1]
                else:
                    right = left  # Duplicate last element if odd number
                next_level.append(cls.hash_nodes(left, right))
            current_level = next_level

        return current_level[0]

    @classmethod
    def generate_proof(cls, leaf_hashes: List[str], target_index: int) -> List[Tuple[str, str]]:
        """
        Generates Merkle audit proof [(sibling_hash, 'L'|'R')] for a given leaf index.
        """
        proof = []
        if target_index < 0 or target_index >= len(leaf_hashes):
            return proof

        current_level = list(leaf_hashes)
        idx = target_index

        while len(current_level) > 1:
            next_level = []
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                right = current_level[i + 1] if i + 1 < len(current_level) else left

                if i == idx:
                    proof.append((right, 'R'))
                elif i + 1 == idx:
                    proof.append((left, 'L'))

                next_level.append(cls.hash_nodes(left, right))

            idx = idx // 2
            current_level = next_level

        return proof

    @classmethod
    def verify_proof(cls, target_leaf_hash: str, proof: List[Tuple[str, str]], expected_root: str) -> bool:
        """
        Validates whether target leaf hash belongs to Merkle Root via audit path.
        """
        current = target_leaf_hash
        for sibling_hash, direction in proof:
            if direction == 'R':
                current = cls.hash_nodes(current, sibling_hash)
            else:
                current = cls.hash_nodes(sibling_hash, current)
        return current == expected_root
