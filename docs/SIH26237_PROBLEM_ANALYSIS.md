# SIH 2026 Problem Statement Analysis: SIH26237

**Organization:** Ministry of Defence (Indian Navy — Weapons and Electronics Systems Engineering Establishment / WESEE)  
**Theme:** Blockchain & Cybersecurity  
**Category:** Software  
**Problem Statement ID:** **SIH26237**  
**Title:** Cryptographic Attribution and Immutable Decryption Provenance for Multi-Recipient Encrypted Document Distribution  
**Submission Deadline:** October 5, 2026  

---

## 1. Context & Operational Threat Model

In high-security defence environments (e.g. Naval Headquarters, joint command operations, weapon systems engineering), classified operational documents, maritime patrol orders, and tactical intelligence must be distributed simultaneously to multiple authorized commanders, ships, and operational units.

### The Fatal Flaw of Standard Public Key Encryption (PKI):
When a document is encrypted for multiple recipients using standard envelope encryption (e.g. S/MIME, PGP, CMS/PKCS#7):
1. The publisher generates a random Content Encryption Key ($\text{CEK}$).
2. The payload is encrypted once: $C = \text{AES-256-GCM}_{\text{CEK}}(\text{Document})$.
3. The $\text{CEK}$ is wrapped for each recipient's public key: $E_1 = \text{Enc}_{PK_1}(\text{CEK}), \dots, E_n = \text{Enc}_{PK_n}(\text{CEK})$.
4. All $N$ recipients receive the exact same ciphertext $C$ and their respective encrypted key $E_i$.
5. **The Leak Vulnerability:** Once Commander A decrypts $E_1$ to recover $\text{CEK}$, their decrypted document is bit-for-bit identical to Commander B's or Commander C's decrypted copy.
6. If Commander A takes a screenshot, prints to PDF, photos the screen with a mobile camera, or extracts the text and leaks it to unauthorized entities, **forensic investigators have zero mathematical proof of who leaked it**. All $N$ recipients possess identical plaintexts and have plausible deniability.
7. Traditional static visible watermarks (e.g., *"CONFIDENTIAL - ADMIRALTY"*) are trivial to crop, blur, mask, or remove using modern OCR and AI inpainting tools.

---

## 2. What Does the Ministry of Defence (SIH26237) Expect Us to Make?

The Ministry of Defence problem statement demands an end-to-end operational software architecture solving this leak attribution dilemma without degrading document visual clarity or requiring massive storage overhead:

```
+----------------------------------------------------------------------------------------------------+
|                                    DEFENCE DOCUMENT LIFECYCLE                                      |
|                                                                                                    |
|  [Publisher (HQ)]                     [Recipient Node (Ship/Unit)]               [Investigator]    |
|   1. Hybrid PQC Encrypt       --->     3. Decrypt CEK                     --->    5. Leak Found    |
|      (ML-KEM-768 / X25519)             4. Dynamic Decryption-Time                 6. Forensic      |
|   2. Distribute Single                   Invisible Watermarking                      Extraction    |
|      Encrypted Package                   (Zero-Width + DCT-QIM)                   7. Merkle Provenance|
|                                        + 4b. Commit Signed Receipt                   Ledger Check  |
|                                              to Immutable Ledger                  8. Non-Repudiable|
|                                                                                      Attribution   |
+----------------------------------------------------------------------------------------------------+
```

### Core Deliverables Required:

### 1. Post-Quantum Multi-Recipient Hybrid Envelope Encryption
- Future-proof defense against **"Harvest Now, Decrypt Later"** attacks by quantum adversaries.
- Combines classical **X25519** ECDH and NIST FIPS 203 **ML-KEM-768** (Kyber-768) for quantum-resistant key encapsulation.
- Symmetric payload encryption with **AES-256-GCM** (authenticated Galois/Counter Mode with 128-bit integrity tags).

### 2. Decryption-Time Forensic Attribution (Dynamic Binding)
- The server stores and distributes only **one single encrypted file** to all $N$ recipients (no bloated per-recipient storage on military networks).
- Forensic attribution is injected **deterministically inside the secure client decryption runtime** at the exact moment of decryption.
- The watermark payload contains:
  $$\text{Payload} = \text{RecipientID} \parallel \text{DecryptionTimestamp} \parallel \text{SessionNonce} \parallel \text{HMAC-SHA256}_{K_{\text{master}}}(\text{DocID} \parallel \text{RecipientID})$$

### 3. Imperceptible & Attack-Resilient Dual-Domain Steganography
- **Text Domain:** Zero-width non-printable unicode character encoding (ZWSP `\u200B`, ZWNJ `\u200C`, ZWJ `\u200D`) and micro-space perturbations that survive plaintext copy-paste, OCR, and terminal dumping.
- **Visual / Image Domain:** Discrete Cosine Transform (DCT) block Quantization Index Modulation (QIM) embedded in middle frequency bands. This survives screenshots, lossy JPEG compression, visual cropping, and print-and-scan attacks without visible degradation.

### 4. Immutable Decryption Provenance Ledger (Cryptographic Merkle Chain)
- Every decryption event requires the recipient client to compute a signed cryptographic receipt:
  $$\text{Receipt} = \text{Sign}_{SK_{\text{recipient}}}(\text{DocID} \parallel \text{Timestamp} \parallel \text{WatermarkHash} \parallel \text{DeviceFingerprint})$$
- Receipts are anchored into an append-only, tamper-evident Merkle-tree blockchain ledger.
- Provides cryptographic non-repudiation: a recipient cannot claim *"I never decrypted or opened this document"*.

### 5. Automated Forensic Leak Attribution Console
- An investigator tool where a leaked document (screenshot, PDF, or text snippet) is uploaded.
- The forensic engine automatically scans and extracts the steganographic payload.
- Cross-references the extracted signature against the immutable decryption provenance ledger.
- Produces mathematical, legally admissible attribution:
  - **Leaker Identity:** Officer / Command ID
  - **Decryption Timestamp:** Exact UTC second
  - **Ledger Block & Hash:** Block #, Merkle Root, and cryptographic inclusion proof.

---

## 3. Technology Stack & Modern Dependencies

| Component | Modern Library / Technology | Purpose |
|---|---|---|
| **Backend Runtime** | Python 3.12+ / FastAPI | High-throughput asynchronous REST API & WebSocket telemetry |
| **Cryptography** | Python `cryptography` (OpenSSL 3.x) + PQC KEM primitives | AES-256-GCM, X25519, Ed25519, ML-KEM-768, HMAC-SHA256 |
| **Numeric & DSP** | NumPy 2.x + SciPy 1.18+ | Fast 2D-DCT, block QIM frequency transformation, steganography |
| **Imaging & Documents** | Pillow (PIL) + PyPDF / canvas | PDF page rendering, visual watermark embedding, screenshot processing |
| **Provenance Ledger** | Python Merkle Tree & SHA-256 Block Chaining | Immutable, tamper-evident append-only decryption log |
| **Frontend** | React 19 + Vite 6 + Tailwind CSS | Defence command-and-control visual theme (Indian Navy / MoD palette) |

---

## 4. SIH Evaluation Matrix & Strategic Advantages

1. **True Problem Alignment:** Solves the exact Ministry of Defence WESEE mandate for multi-recipient document distribution.
2. **PQC Quantum Resistance:** Demonstrates readiness for post-quantum cryptographic standards (NIST FIPS 203/204).
3. **Screenshot & Crop Resilience:** Unlike naive text watermarking that fails on screenshots, the dual-domain DCT-QIM survives visual leaks.
4. **Zero Extra Bandwidth / Storage:** Single encrypted file distribution with decryption-time client synthesis.
5. **Legally Admissible Proof:** Cryptographic non-repudiation backed by the Merkle provenance ledger.
