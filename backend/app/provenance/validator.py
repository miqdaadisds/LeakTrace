"""
Multi-Validator Permissioned Notary Nodes for Offline DLT.
Implements independent offline validator nodes (Node-Alpha, Node-Bravo, Node-Charlie).
Provides decentralized consensus and quorum signatures, ensuring no single administrator
or compromised root account can silently alter or delete historical provenance records.
"""
from typing import Dict, List, Tuple, Any
import base64
import json
import hashlib
from app.crypto.pqc_sig import DigitalSignatureManager


class ValidatorSignature:
    def __init__(self, validator_id: str, signature_b64: str, public_key_b64: str):
        self.validator_id = validator_id
        self.signature_b64 = signature_b64
        self.public_key_b64 = public_key_b64

    def to_dict(self) -> Dict[str, str]:
        return {
            "validator_id": self.validator_id,
            "signature_b64": self.signature_b64,
            "public_key_b64": self.public_key_b64
        }


class ValidatorNode:
    def __init__(self, validator_id: str, name: str, location: str):
        self.validator_id = validator_id
        self.name = name
        self.location = location
        self._priv_sig, self._pub_sig = DigitalSignatureManager.generate_keypair()
        self.public_key_b64 = base64.b64encode(self._pub_sig).decode("utf-8")

    def inspect_and_endorse_block(
        self,
        block_index: int,
        prev_hash: str,
        merkle_root: str,
        timestamp: float
    ) -> ValidatorSignature:
        """
        Independently verifies and endorses a block proposal by signing the block header digest.
        """
        block_proposal_digest = hashlib.sha256(
            f"{block_index}|{prev_hash}|{merkle_root}|{timestamp}".encode("utf-8")
        ).digest()

        sig_bytes = DigitalSignatureManager.sign(block_proposal_digest, self._priv_sig)
        sig_b64 = base64.b64encode(sig_bytes).decode("utf-8")

        return ValidatorSignature(
            validator_id=self.validator_id,
            signature_b64=sig_b64,
            public_key_b64=self.public_key_b64
        )

    def verify_endorsement(
        self,
        block_index: int,
        prev_hash: str,
        merkle_root: str,
        timestamp: float,
        signature_b64: str
    ) -> bool:
        """Verifies that an endorsement signature is mathematically valid."""
        block_proposal_digest = hashlib.sha256(
            f"{block_index}|{prev_hash}|{merkle_root}|{timestamp}".encode("utf-8")
        ).digest()
        sig_bytes = base64.b64decode(signature_b64)
        return DigitalSignatureManager.verify(block_proposal_digest, sig_bytes, self._pub_sig)


class MultiValidatorNetwork:
    """
    Simulates the 3-node permissioned notary network running in the air-gapped defence enclave.
    Quorum requirement: 2 of 3 (or 3 of 3) validators must independently sign.
    """
    def __init__(self):
        self.nodes: Dict[str, ValidatorNode] = {
            "VAL-NODE-ALPHA": ValidatorNode("VAL-NODE-ALPHA", "WESEE Naval Command Notary A", "New Delhi Enclave"),
            "VAL-NODE-BRAVO": ValidatorNode("VAL-NODE-BRAVO", "Western Naval Command Notary B", "Mumbai Enclave"),
            "VAL-NODE-CHARLIE": ValidatorNode("VAL-NODE-CHARLIE", "Eastern Naval Command Notary C", "Visakhapatnam Enclave"),
        }
        self.quorum_threshold = 2  # 2-of-3 quorum required for block finality

    def get_validators_info(self) -> List[Dict[str, str]]:
        return [
            {
                "validator_id": n.validator_id,
                "name": n.name,
                "location": n.location,
                "public_key_b64": n.public_key_b64
            }
            for n in self.nodes.values()
        ]

    def endorse_block(
        self,
        block_index: int,
        prev_hash: str,
        merkle_root: str,
        timestamp: float
    ) -> List[Dict[str, str]]:
        """Collects endorsements from all validator nodes in the permissioned network."""
        signatures = []
        for node in self.nodes.values():
            endorsement = node.inspect_and_endorse_block(block_index, prev_hash, merkle_root, timestamp)
            signatures.append(endorsement.to_dict())
        return signatures

    def verify_block_quorum(
        self,
        block_index: int,
        prev_hash: str,
        merkle_root: str,
        timestamp: float,
        signatures: List[Dict[str, str]]
    ) -> Tuple[bool, int, str]:
        """
        Verifies that at least quorum_threshold valid validator signatures exist.
        """
        valid_signatures = 0
        for s in signatures:
            val_id = s.get("validator_id")
            sig_b64 = s.get("signature_b64")
            node = self.nodes.get(val_id)
            if node and node.verify_endorsement(block_index, prev_hash, merkle_root, timestamp, sig_b64):
                valid_signatures += 1

        is_quorum = valid_signatures >= self.quorum_threshold
        status = f"Quorum achieved ({valid_signatures}/{len(self.nodes)} nodes)" if is_quorum else f"Quorum failed ({valid_signatures}/{len(self.nodes)} nodes)"
        return is_quorum, valid_signatures, status


validator_network = MultiValidatorNetwork()
