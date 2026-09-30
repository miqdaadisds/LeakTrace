"""
Base Watermarking Abstract Interface.
Enforces decoupled steganographic embedding and forensic extraction contracts.
"""
from abc import ABC, abstractmethod
from typing import Optional, Any
from app.core.types import WatermarkPayload


class BaseWatermarker(ABC):
    @abstractmethod
    def embed(self, content: Any, *args, **kwargs) -> Any:
        """Embeds invisible cryptographic watermark into document content."""
        pass

    @abstractmethod
    def extract(self, leaked_content: Any) -> Optional[WatermarkPayload]:
        """Extracts and parses embedded cryptographic watermark from leaked artifact."""
        pass
