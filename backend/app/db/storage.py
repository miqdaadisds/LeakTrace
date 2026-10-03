import os
import logging
from typing import Optional
import httpx

logger = logging.getLogger("leaktrace.storage")

class ProtectedDocumentStorage:
    """
    Storage adapter for protected PDF files.
    Prefers Supabase Private Authenticated Object Storage when credentials are provided.
    Seamlessly falls back to PostgreSQL BYTEA / SQLite BLOB for self-contained / test deployments.
    """
    def __init__(self):
        self.supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")
        self.bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "protected-documents")

    @property
    def is_supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    async def upload_protected_pdf(self, doc_id: str, pdf_bytes: bytes) -> Optional[str]:
        """
        Uploads protected PDF blob to private Supabase Storage bucket.
        Returns storage reference path (e.g., 'supabase://protected-documents/DOC-123.pdf').
        """
        if not self.is_supabase_enabled:
            return None

        file_path = f"{doc_id}.pdf"
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{file_path}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apikey": self.supabase_key,
            "Content-Type": "application/pdf"
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, content=pdf_bytes, headers=headers)
                if res.status_code in (200, 201):
                    logger.info(f"[Storage] Uploaded {doc_id} to Supabase bucket '{self.bucket}'.")
                    return f"supabase://{self.bucket}/{file_path}"
                else:
                    logger.warning(f"[Storage] Supabase upload failed ({res.status_code}): {res.text}. Using DB storage.")
                    return None
        except Exception as e:
            logger.error(f"[Storage] Supabase storage exception: {e}. Falling back to DB.")
            return None

    async def download_protected_pdf(self, storage_ref: str) -> Optional[bytes]:
        """
        Downloads protected PDF blob from private Supabase Storage bucket.
        """
        if not storage_ref.startswith("supabase://") or not self.is_supabase_enabled:
            return None

        # Format: supabase://{bucket}/{file_path}
        parts = storage_ref[len("supabase://"):].split("/", 1)
        if len(parts) != 2:
            return None
        bucket, file_path = parts

        url = f"{self.supabase_url}/storage/v1/object/authenticated/{bucket}/{file_path}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apikey": self.supabase_key
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.content
                # Fallback to direct object URL
                url_direct = f"{self.supabase_url}/storage/v1/object/{bucket}/{file_path}"
                res2 = await client.get(url_direct, headers=headers)
                if res2.status_code == 200:
                    return res2.content
        except Exception as e:
            logger.error(f"[Storage] Supabase download error: {e}")
        return None

document_storage = ProtectedDocumentStorage()
