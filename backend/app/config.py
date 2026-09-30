"""
System Configuration for SIH26237.
Ministry of Defence (Indian Navy - WESEE) Defence Grade Security Profile.
"""
from pydantic import BaseModel
import os


class SystemConfig(BaseModel):
    # System Metadata
    SYSTEM_NAME: str = "TraceProvenance-PQC"
    PS_ID: str = "SIH26237"
    ORGANIZATION: str = "Ministry of Defence (Indian Navy - WESEE)"
    CLASSIFICATION_LEVEL: str = "RESTRICTED // NAVAL DEFENCE"
    
    # Cryptographic Configuration
    PQC_KEM_ALGORITHM: str = "ML-KEM-768 + X25519 Hybrid"
    SIGNATURE_SCHEME: str = "ML-DSA-65 / Ed25519"
    SYMMETRIC_CIPHER: str = "AES-256-GCM"
    
    # Steganography & Watermarking Configuration
    DCT_QIM_DELTA: float = 38.0  # Quantization step (tuned for screenshot & crop survival)
    TEXT_STEGO_DELIMITER: str = "\u200D"
    
    # Master HMAC Key for Forensic Nonce Signing
    MASTER_AUDIT_SECRET: str = os.getenv("DEFENCE_MASTER_KEY", "WESEE-NAVY-DEFENCE-SECRET-KEY-99824")
    
    # Server Configuration
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    API_HOST: str = os.getenv("HOST", "127.0.0.1")
    API_PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"


config = SystemConfig()
settings = config
