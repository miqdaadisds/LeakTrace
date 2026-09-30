"""
Naval Defence PDF Document Generator for NISHAN-PQ.
Synthesizes professional, realistic operational orders and classified directives.
"""
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas


def generate_sample_navy_pdf(title: str, doc_id: str, classification: str, directive_body: str) -> bytes:
    """Generates a professional military directive PDF."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter

    # Draw Top Classification Banner
    c.setFillColor(colors.HexColor("#7F1D1D")) # Dark red
    c.rect(0, height - 36, width, 36, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2.0, height - 24, classification)

    # Header section
    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(54, height - 70, "MINISTRY OF DEFENCE &bull; NAVAL HEADQUARTERS")
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawString(54, height - 85, f"ORIGINATOR: WESEE DIRECTORATE (NEW DELHI) | REF: {doc_id}")

    # Separator line
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.setLineWidth(1)
    c.line(54, height - 95, width - 54, height - 95)

    # Document Title
    c.setFillColor(colors.HexColor("#1E293B"))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(54, height - 120, title)

    # Body lines
    c.setFont("Helvetica", 9.5)
    c.setFillColor(colors.HexColor("#334155"))
    y = height - 150
    for line in directive_body.split("\n"):
        if y < 60:
            c.showPage()
            y = height - 60
        if line.startswith("1.") or line.startswith("2.") or line.startswith("3."):
            c.setFont("Helvetica-Bold", 9.5)
            c.setFillColor(colors.HexColor("#0F172A"))
        else:
            c.setFont("Helvetica", 9)
            c.setFillColor(colors.HexColor("#334155"))
        c.drawString(54, y, line)
        y -= 15

    # Bottom Classification Banner
    c.setFillColor(colors.HexColor("#7F1D1D"))
    c.rect(0, 0, width, 28, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(width / 2.0, 10, f"{classification} - NON-REPUDIATION ATTESTED")

    c.save()
    buf.seek(0)
    return buf.getvalue()
