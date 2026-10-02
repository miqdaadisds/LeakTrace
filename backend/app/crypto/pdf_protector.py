import json
import hashlib
import hmac
import io
from pypdf import PdfReader, PdfWriter
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

class PdfProtector:
    @staticmethod
    def protect(source_pdf_bytes: bytes, doc_id: str, title: str,
                doc_open_secret: str, recipient_slots: list[dict]) -> bytes:
        # 1. Read source PDF
        reader = PdfReader(io.BytesIO(source_pdf_bytes))
        writer = PdfWriter()
        
        # 2. Clone to writer
        for page in reader.pages:
            writer.add_page(page)
            
        # 3. Encrypt with user_password=doc_open_secret, algorithm='AES-256'
        # NO owner password trick (owner password = same as user password, or omitted)
        writer.encrypt(user_password=doc_open_secret, algorithm="AES-256")
        
        # 4. Write to buffer -> core_pdf_bytes
        core_buffer = io.BytesIO()
        writer.write(core_buffer)
        core_pdf_bytes = core_buffer.getvalue()
        
        # 5. Build trailer JSON
        trailer_data = {
            "doc_id": doc_id,
            "title": title,
            "recipients": recipient_slots
        }
        slots_json_bytes = json.dumps(trailer_data).encode('utf-8')
        
        # 6. Compute HMAC using HKDF-derived key from doc_open_secret
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'leaktrace-trailer-integrity'
        )
        hmac_key = hkdf.derive(doc_open_secret.encode('utf-8'))
        
        h = hmac.new(hmac_key, slots_json_bytes, hashlib.sha256)
        hmac_hex = h.hexdigest()
        
        # 7. Append trailer after core PDF bytes
        trailer = (
            b"\n%%LEAKTRACE_SLOTS_V2%%\n" +
            slots_json_bytes +
            b"\n" +
            hmac_hex.encode('utf-8') +
            b"\n%%LEAKTRACE_SLOTS_END%%\n"
        )
        
        # 8. Return composite bytes
        return core_pdf_bytes + trailer

    @staticmethod
    def read_slots(protected_pdf_bytes: bytes) -> dict | None:
        start_marker = b"%%LEAKTRACE_SLOTS_V2%%\n"
        end_marker = b"\n%%LEAKTRACE_SLOTS_END%%\n"
        
        start_idx = protected_pdf_bytes.rfind(start_marker)
        if start_idx == -1:
            return None
            
        end_idx = protected_pdf_bytes.rfind(end_marker)
        if end_idx == -1 or end_idx < start_idx:
            return None
            
        trailer_content = protected_pdf_bytes[start_idx + len(start_marker):end_idx]
        
        # content is: slots_json_bytes + b"\n" + hmac_hex
        last_newline = trailer_content.rfind(b"\n")
        if last_newline == -1:
            return None
            
        json_bytes = trailer_content[:last_newline]
        
        try:
            return json.loads(json_bytes.decode('utf-8'))
        except json.JSONDecodeError:
            return None

    @staticmethod
    def verify_trailer_integrity(slots_json_bytes: bytes, hmac_hex: str, doc_open_secret: str) -> bool:
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'leaktrace-trailer-integrity'
        )
        hmac_key = hkdf.derive(doc_open_secret.encode('utf-8'))
        
        h = hmac.new(hmac_key, slots_json_bytes, hashlib.sha256)
        expected_hmac = h.hexdigest()
        
        return hmac.compare_digest(expected_hmac, hmac_hex)

    @staticmethod
    def extract_core_pdf(protected_pdf_bytes: bytes) -> bytes:
        start_marker = b"\n%%LEAKTRACE_SLOTS_V2%%\n"
        idx = protected_pdf_bytes.rfind(start_marker)
        if idx == -1:
            return protected_pdf_bytes
        return protected_pdf_bytes[:idx]

    @staticmethod
    def decrypt_pdf(core_pdf_bytes: bytes, doc_open_secret: str) -> bytes:
        reader = PdfReader(io.BytesIO(core_pdf_bytes))
        reader.decrypt(doc_open_secret)
        
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
            
        out_buffer = io.BytesIO()
        writer.write(out_buffer)
        return out_buffer.getvalue()
