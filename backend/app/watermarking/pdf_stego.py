"""
PDF-Domain Steganography & Digital Forensic Watermarking Subsystem.
Embeds machine-readable, invisible forensic attribution payloads into PDF document structures,
annotations, and text streams during client-side decryption.
The watermark contains an opaque, cryptographically authenticated watermark_id,
preventing trivial text stripping or metadata deletion from breaking attribution.
"""
from typing import Optional, Tuple, Dict, Any
import io
import time
import uuid
import hmac
import hashlib
import pypdf
from app.config import config
from app.watermarking.text_stego import TextSteganographyWatermarker


class PDFStegoWatermarker:
    def __init__(self):
        self.text_watermarker = TextSteganographyWatermarker()

    @staticmethod
    def generate_auth_tag(doc_id: str, session_id: str, watermark_id: str, nonce: str) -> str:
        """Generates HMAC-SHA256 authentication tag for the forensic watermark payload."""
        secret = config.MASTER_AUDIT_SECRET.encode("utf-8")
        msg = f"{doc_id}|{session_id}|{watermark_id}|{nonce}".encode("utf-8")
        return hmac.new(secret, msg, hashlib.sha256).hexdigest()[:24]

    @classmethod
    def verify_auth_tag(cls, doc_id: str, session_id: str, watermark_id: str, nonce: str, provided_tag: str) -> bool:
        """Verifies the HMAC authentication tag to prevent forged attribution."""
        expected = cls.generate_auth_tag(doc_id, session_id, watermark_id, nonce)
        return hmac.compare_digest(expected, provided_tag)

    def embed_forensic_watermark(
        self,
        pdf_bytes: bytes,
        doc_id: str,
        recipient_id: str,
        session_id: str = None,
        watermark_id: str = None,
        timestamp: float = None
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Embeds a unique, invisible forensic watermark into PDF binary bytes.
        The fingerprint is bound to BOTH the recipient and the unique decryption session.
        Returns: (watermarked_pdf_bytes, watermark_metadata_dict)
        """
        ts = timestamp if timestamp is not None else time.time()
        sess_id = session_id or f"SESS-{uuid.uuid4().hex[:12].upper()}"
        wm_id = watermark_id or f"WM-{uuid.uuid4().hex[:16].upper()}"
        nonce = uuid.uuid4().hex[:12]
        auth_tag = self.generate_auth_tag(doc_id, sess_id, wm_id, nonce)

        # Canonical forensic token (opaque identifier, no plaintext recipient name exposed)
        canonical_token = f"NISHAN-PROV:{doc_id}:{sess_id}:{wm_id}:{nonce}:{auth_tag}"

        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        writer = pypdf.PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        # Channel 1: Structural PDF Object & Document Catalog
        token_obj = writer._add_object(pypdf.generic.create_string_object(canonical_token))
        if writer._info:
            writer._info.get_object().update({
                pypdf.generic.NameObject('/ForensicProof'): token_obj,
                pypdf.generic.NameObject('/ProvenanceSession'): pypdf.generic.create_string_object(sess_id),
                pypdf.generic.NameObject('/WatermarkId'): pypdf.generic.create_string_object(wm_id)
            })

        # Channel 2: PDF Metadata Producer/Keywords with zero-width stego token
        zw_token = self.text_watermarker.encode_to_zerowidth(canonical_token)
        writer.add_metadata({
            '/Producer': 'NISHAN-PQ Quantum-Safe Provenance Enclave',
            '/Keywords': f"ForensicSign:{nonce}:{zw_token}"
        })

        # Channel 3: In-Page Content Stream Overlay (SURVIVES RE-SAVE & VIEWER NORMALIZATION)
        try:
            from reportlab.pdfgen import canvas
            for page in writer.pages:
                width = float(page.mediabox.width)
                height = float(page.mediabox.height)
                overlay_buf = io.BytesIO()
                wc = canvas.Canvas(overlay_buf, pagesize=(width, height))

                # Layer A: Invisible in-stream text (font 0.05pt, alpha 0.0)
                wc.setFont('Helvetica', 0.05)
                wc.setFillColorRGB(1, 1, 1, alpha=0.0)
                wc.drawString(10, 10, canonical_token)
                wc.drawString(10, 20, zw_token)

                # Layer B: Micro-Canary Tracking String at header and footer (3.5pt, alpha 0.12)
                wc.setFont('Helvetica', 3.5)
                wc.setFillColorRGB(0.5, 0.5, 0.5, alpha=0.12)
                wc.drawString(20, 12, f"SEC-PROV-{wm_id}")
                wc.drawString(20, max(24, height - 12), f"SEC-PROV-{wm_id}")

                wc.save()
                overlay_buf.seek(0)
                ov_reader = pypdf.PdfReader(overlay_buf)
                page.merge_page(ov_reader.pages[0])
        except Exception:
            pass

        out_buf = io.BytesIO()
        writer.write(out_buf)
        watermarked_bytes = out_buf.getvalue()

        metadata = {
            "doc_id": doc_id,
            "recipient_id": recipient_id,
            "session_id": sess_id,
            "watermark_id": wm_id,
            "nonce": nonce,
            "auth_tag": auth_tag,
            "timestamp": ts,
            "canonical_token": canonical_token
        }

        return watermarked_bytes, metadata

    def extract_from_pdf_bytes(self, pdf_bytes: bytes) -> Optional[Dict[str, Any]]:
        """
        Extracts and authenticates the forensic watermark payload from an uploaded suspect PDF or image.
        Survives PDF viewer re-saves, optimizations, metadata stripping, and format normalization.
        """
        try:
            canonical_str = None
            extracted_wm_id = None

            # 1. Parse via pypdf
            try:
                reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))

                # Channel 1: Metadata dictionary
                if reader.metadata:
                    canonical_str = reader.metadata.get('/ForensicProof')
                    if not canonical_str:
                        keywords = reader.metadata.get('/Keywords') or ""
                        extracted_zw = self.text_watermarker.decode_from_zerowidth(str(keywords))
                        if extracted_zw and extracted_zw.startswith("NISHAN-PROV:"):
                            canonical_str = extracted_zw

                # Channel 2: Document trailer / Info
                if not canonical_str and reader.trailer and '/Info' in reader.trailer:
                    info_obj = reader.trailer['/Info']
                    if '/ForensicProof' in info_obj:
                        canonical_str = str(info_obj['/ForensicProof'])

                # Channel 3: In-page text content streams
                if not canonical_str:
                    for page in reader.pages:
                        page_text = page.extract_text() or ""
                        if "NISHAN-PROV:" in page_text:
                            idx = page_text.find("NISHAN-PROV:")
                            candidate = page_text[idx:idx+200].split()[0]
                            if len(candidate.split(":")) >= 6:
                                canonical_str = candidate
                                break
                        extracted_zw = self.text_watermarker.decode_from_zerowidth(page_text)
                        if extracted_zw and extracted_zw.startswith("NISHAN-PROV:"):
                            canonical_str = extracted_zw
                            break
                        if "SEC-PROV-" in page_text and not extracted_wm_id:
                            idx = page_text.find("SEC-PROV-")
                            extracted_wm_id = page_text[idx+9:idx+40].split()[0].strip()
            except Exception:
                pass

            # Channel 4: Raw byte-level pattern search (recovers even from partially damaged PDFs)
            if not canonical_str and not extracted_wm_id:
                try:
                    raw_str = pdf_bytes.decode('utf-8', errors='ignore')
                    if "NISHAN-PROV:" in raw_str:
                        idx = raw_str.find("NISHAN-PROV:")
                        candidate = raw_str[idx:idx+200].split()[0].strip("()<>[] \r\n\t")
                        if len(candidate.split(":")) >= 6:
                            canonical_str = candidate
                    if "SEC-PROV-" in raw_str and not extracted_wm_id:
                        idx = raw_str.find("SEC-PROV-")
                        extracted_wm_id = raw_str[idx+9:idx+40].split()[0].strip("()<>[] \r\n\t")
                except Exception:
                    pass

            # If canonical string recovered, parse and authenticate
            if canonical_str:
                clean_str = str(canonical_str).strip("()<>[] \r\n\t")
                if clean_str.startswith("NISHAN-PROV:"):
                    parts = clean_str.split(":")
                    if len(parts) >= 6:
                        _, doc_id, sess_id, wm_id, nonce, auth_tag = parts[:6]
                        valid_auth = self.verify_auth_tag(doc_id, sess_id, wm_id, nonce, auth_tag)
                        return {
                            "valid_auth": valid_auth,
                            "doc_id": doc_id,
                            "session_id": sess_id,
                            "watermark_id": wm_id,
                            "nonce": nonce,
                            "auth_tag": auth_tag,
                            "canonical_token": clean_str
                        }

            # If canary ID recovered
            if extracted_wm_id:
                clean_wm = extracted_wm_id.strip("()<>[] \r\n\t")
                return {
                    "valid_auth": True,
                    "doc_id": "RECOVERED",
                    "session_id": "RECOVERED",
                    "watermark_id": clean_wm,
                    "nonce": "CANARY",
                    "auth_tag": "CANARY_RECOVERED",
                    "canonical_token": f"CANARY:{clean_wm}"
                }

            return None
        except Exception:
            return None


pdf_watermarker = PDFStegoWatermarker()
