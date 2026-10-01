"""
Text-Domain Steganography Subsystem.
Embeds invisible, non-printable zero-width Unicode sequences into plain text
documents during client-side decryption. Survives copy-paste, text exports,
and clipboard scraping.
"""
from typing import Optional, Tuple
import os
import time
import uuid
import hmac
import hashlib
from app.watermarking.base import BaseWatermarker
from app.core.types import WatermarkPayload
from app.config import config


class TextSteganographyWatermarker(BaseWatermarker):
    # Unicode Zero-Width character mapping
    ZERO_BIT = "\u200B"  # Zero Width Space -> 0
    ONE_BIT  = "\u200C"  # Zero Width Non-Joiner -> 1
    DELIM    = "\u200D"  # Zero Width Joiner -> Delimiter
    MARKER   = "\uFEFF"  # Zero Width No-Break Space -> Envelope boundary

    @classmethod
    def generate_hmac(cls, doc_id: str, recipient_id: str, nonce: str) -> str:
        """Generates master HMAC tag binding the document and recipient."""
        secret = config.MASTER_AUDIT_SECRET.encode("utf-8")
        msg = f"{doc_id}|{recipient_id}|{nonce}".encode("utf-8")
        return hmac.new(secret, msg, hashlib.sha256).hexdigest()[:16]

    @classmethod
    def verify_hmac(cls, doc_id: str, recipient_id: str, nonce: str, provided_hmac: str) -> bool:
        """Validates HMAC integrity."""
        expected = cls.generate_hmac(doc_id, recipient_id, nonce)
        return hmac.compare_digest(expected, provided_hmac)

    @classmethod
    def encode_to_zerowidth(cls, raw_str: str) -> str:
        """Encodes an arbitrary string into an invisible zero-width Unicode sequence bounded by MARKER."""
        msg_bytes = raw_str.encode("utf-8")
        bits = "".join(f"{byte:08b}" for byte in msg_bytes)
        return cls.MARKER + "".join(cls.ONE_BIT if b == "1" else cls.ZERO_BIT for b in bits) + cls.MARKER

    @classmethod
    def decode_from_zerowidth(cls, text: str) -> Optional[str]:
        """Recovers an arbitrary string from embedded zero-width Unicode characters."""
        if cls.MARKER not in text:
            return None
        try:
            start = text.find(cls.MARKER)
            end = text.find(cls.MARKER, start + 1)
            if start == -1 or end == -1 or end <= start:
                return None

            zw_substr = text[start + 1 : end]
            bits = []
            for ch in zw_substr:
                if ch == cls.ONE_BIT:
                    bits.append("1")
                elif ch == cls.ZERO_BIT:
                    bits.append("0")

            bit_str = "".join(bits)
            if len(bit_str) % 8 != 0 or len(bit_str) == 0:
                return None

            byte_arr = bytearray()
            for i in range(0, len(bit_str), 8):
                byte_val = int(bit_str[i : i + 8], 2)
                byte_arr.append(byte_val)

            return byte_arr.decode("utf-8", errors="ignore")
        except Exception:
            return None

    def embed(
        self,
        plaintext: str,
        payload: Optional[WatermarkPayload] = None,
        doc_id: Optional[str] = None,
        recipient_id: Optional[str] = None,
        timestamp: Optional[float] = None
    ) -> Tuple[str, WatermarkPayload]:
        """
        Embeds the watermark payload invisibly into the document text.
        Returns: (watermarked_text, WatermarkPayload)
        """
        if payload is None:
            if not doc_id or not recipient_id:
                raise ValueError("Must provide either a WatermarkPayload or doc_id and recipient_id.")
            ts = timestamp if timestamp is not None else time.time()
            nonce = uuid.uuid4().hex[:8]
            sig = self.generate_hmac(doc_id, recipient_id, nonce)
            payload = WatermarkPayload(
                doc_id=doc_id,
                recipient_id=recipient_id,
                timestamp=ts,
                session_nonce=nonce,
                hmac_sig=sig
            )

        raw_msg = f"SIH26237:{payload.doc_id}:{payload.recipient_id}:{int(payload.timestamp)}:{payload.session_nonce}:{payload.hmac_sig}"
        zw_stream = self.encode_to_zerowidth(raw_msg)

        # Interleave into natural word boundaries
        words = plaintext.split(" ")
        if len(words) < 2:
            return plaintext + zw_stream, payload

        insert_idx = min(5, len(words) - 1)
        words[insert_idx] = words[insert_idx] + zw_stream
        return " ".join(words), payload

    def extract(self, leaked_text: str) -> Optional[WatermarkPayload]:
        """
        Extracts zero-width steganographic payload from leaked text snippet.
        """
        decoded_msg = self.decode_from_zerowidth(leaked_text)
        if not decoded_msg:
            return None

        try:
            parts = decoded_msg.split(":")
            if len(parts) != 6 or parts[0] != "SIH26237":
                return None

            _, doc_id, recipient_id, ts_str, nonce, sig = parts
            return WatermarkPayload(
                doc_id=doc_id,
                recipient_id=recipient_id,
                timestamp=float(ts_str),
                session_nonce=nonce,
                hmac_sig=sig
            )
        except Exception:
            return None
