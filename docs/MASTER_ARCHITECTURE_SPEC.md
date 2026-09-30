# Cryptographic Attribution & Immutable Decryption Provenance (SIH26237)
## Master Technical Architecture & Cryptographic Specification

**Target:** Ministry of Defence (Indian Navy - WESEE)  
**Classification:** DEFENCE TECH DEMO / UNCLASSIFIED ARCHITECTURE SPECIFICATION  

---

## 1. High-Level System Architecture

The architecture is divided into five decoupled subsystems, each adhering to the **Single Ownership Principle**:

```
+----------------------------------------------------------------------------------------------------+
|                                    DEFENCE SYSTEM TOPOLOGY                                         |
|                                                                                                    |
|  +----------------------------------+          +-------------------------------------------------+ |
|  |     1. CRYPTO ENVELOPE (HQ)      |          |       2. DECRYPTION RUNTIME (RECIPIENT)         | |
|  | - ML-KEM-768 / X25519 KEM        |          | - PQC Private Key Decapsulation                 | |
|  | - AES-256-GCM Payload Encryption |  =====>  | - Dynamic Decryption-Time Steganography         | |
|  | - Single Multi-Recipient Package |          | - Deterministic Forensic Watermark Injection    | |
|  +----------------------------------+          +------------------------+------------------------+ |
|                                                                         |                          |
|                                                                         v                          |
|  +----------------------------------+          +-------------------------------------------------+ |
|  |    4. FORENSIC INVESTIGATOR      |          |       3. IMMUTABLE PROVENANCE LEDGER            | |
|  | - Leak Extractor (Text / DCT-QIM)|          | - Cryptographic Decryption Receipts (Ed25519)   | |
|  | - HMAC Authenticity Verification |  <=====  | - Tamper-Evident Merkle Tree Chain              | |
|  | - Non-Repudiable Attribution    |          | - Zero-Knowledge Hash Integrity Proofs          | |
|  +----------------------------------+          +-------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Mathematical & Cryptographic Specifications

### 2.1 Hybrid Post-Quantum Key Encapsulation (PQC KEM)
To safeguard classified defense communication against future Shor's algorithm quantum cryptanalysis, key establishment uses a hybrid dual-layer scheme:

1. **Classical Layer:** X25519 Elliptic Curve Diffie-Hellman (ECDH) providing 128-bit classical security.
2. **Post-Quantum Layer:** NIST FIPS 203 ML-KEM-768 (Lattice-based Module Learning with Errors) providing Category 3 post-quantum security ($\ge$ AES-192 equivalent).
3. **Key Derivation (HKDF-SHA256):**
   $$K_{\text{hybrid}} = \text{HKDF-Extract}(\text{Salt}, \text{SharedSecret}_{\text{X25519}} \parallel \text{SharedSecret}_{\text{ML-KEM-768}})$$
   $$\text{RecipientWrapKey}_i = \text{HKDF-Expand}(K_{\text{hybrid}}, \text{"sih26237-pqc-wrap"}, 32)$$

### 2.2 Multi-Recipient Envelope Payload Encryption
1. Publisher generates a high-entropy 256-bit Content Encryption Key ($\text{CEK}$) and a 96-bit initialization vector ($IV$).
2. Document payload is encrypted:
   $$\text{Ciphertext}, \text{Tag} = \text{AES-256-GCM}_{\text{CEK}, IV}(\text{PlaintextDocument}, \text{AAD}=\text{DocMetadata})$$
3. The $\text{CEK}$ is wrapped independently for each of the $N$ authorized recipients:
   $$\text{WrappedCEK}_i = \text{AES-GCM}_{\text{RecipientWrapKey}_i}(\text{CEK})$$
4. The distributed package contains:
   $$\text{Package} = \{ \text{DocID}, \text{AAD}, IV, \text{Ciphertext}, \text{Tag}, [(\text{RecipientID}_i, \text{EncapsulatedKey}_i, \text{WrappedCEK}_i)]_{i=1}^N \}$$

### 2.3 Decryption-Time Forensic Watermarking
Unlike traditional server-side watermarking, the document is decrypted inside a secure client viewer runtime where watermark synthesis is deterministically bound to the decryptor's identity:

$$\text{WatermarkPayload} = \text{RecipientID} \parallel \text{DecryptionEpoch} \parallel \text{SessionNonce} \parallel \text{HMAC-SHA256}_{K_{\text{audit}}}(\text{DocID} \parallel \text{RecipientID})$$

#### A. Text-Domain Steganography (Zero-Width Unicode Encoding)
Binary serialization of the watermark payload is mapped onto non-printable zero-width Unicode codepoints:
- Bit `0` $\rightarrow$ `\u200B` (Zero Width Space)
- Bit `1` $\rightarrow$ `\u200C` (Zero Width Non-Joiner)
- Delimiter $\rightarrow$ `\u200D` (Zero Width Joiner)
- Checksum $\rightarrow$ `\uFEFF` (Zero Width No-Break Space)

The resulting invisible stream is interleaved into natural word boundaries throughout the document text. The text remains visually identical to the human eye, but any copy-paste, text export, or terminal scrape retains the hidden binary watermark.

#### B. Visual / Image-Domain Steganography (Block 2D-DCT QIM)
For rendered PDF pages, technical blueprints, and operational maps, a frequency-domain Discrete Cosine Transform (DCT) with **Quantization Index Modulation (QIM)** is applied:
1. Divide image luminance channel $Y$ into $8 \times 8$ pixel blocks.
2. Compute 2D-DCT for each block: $C = \text{DCT2D}(B_{8 \times 8})$.
3. Select mid-frequency coefficients (e.g. $(u, v) \in \{(3, 2), (2, 3), (3, 3), (4, 2)\}$):
   $$C_q(u, v) = \text{round}\left(\frac{C(u, v) - d(m_i)}{\Delta}\right) \cdot \Delta + d(m_i)$$
   where $\Delta$ is the quantization step and $d(0) = 0, d(1) = \Delta/2$.
4. Apply Inverse DCT to reconstruct image.
5. **Robustness:** Because mid-frequency energy is modified, this watermark survives:
   - Lossy JPEG re-compression.
   - Screen screenshots.
   - Cropping up to 60% of document area.
   - Print-and-scan camera captures.

### 2.4 Immutable Decryption Provenance Ledger
Whenever an authorized recipient decrypts a document, the client must submit a signed Decryption Provenance Receipt before rendering completes:
$$\text{Receipt} = \{ \text{DocID}, \text{RecipientID}, \text{DecryptionEpoch}, \text{WatermarkHash}, \text{DeviceFingerprint} \}$$
$$\text{Signature} = \text{Ed25519-Sign}_{SK_{\text{recipient}}}(\text{SHA-256}(\text{Receipt}))$$

The receipt is appended into an immutable Merkle-tree blockchain block:
$$\text{Block}_k = \{ \text{BlockNumber}, \text{Timestamp}, \text{PrevBlockHash}, \text{MerkleRoot}, \text{Receipts}, \text{BlockHash} \}$$

Provides **cryptographic non-repudiation**: a rogue officer cannot claim their device was spoofed, because the receipt is signed with their unique hardware-bound private key.

### 2.5 Forensic Leak Attribution & Extraction
When a leaked document is discovered on an external forum, USB drive, or public channel:
1. The investigator submits the leaked text or image into the Forensic Attribution Engine.
2. The engine attempts dual-domain extraction:
   - If text: Parses zero-width binary bitstream, validates HMAC and delimiters.
   - If image/PDF: Computes block-DCT QIM residuals to decode embedded bitstream with error correction.
3. Decoded $\text{RecipientID}$ and $\text{DecryptionEpoch}$ are looked up against the immutable Merkle ledger.
4. The cryptographic signature and Merkle inclusion path are verified.
5. An official **Forensic Attribution Certificate** is generated with mathematical certainty.
