# LeakTrace — Connected Cloud Deployment Guide ($0 Forever)

> **Ministry of Defence (WESEE) &bull; SIH 2026 Problem Statement #26237**  
> **Architecture:** ONE Central Backend (Render) + ONE Central Database (Supabase) + MANY LeakTrace Workstation Clients (Electron)

---

## 1. System Architecture Overview

LeakTrace uses a **Zero-Trust Client-Sovereign Architecture**. All team members and field officers connect to the **same** public cloud backend, but **zero cryptographic private keys, passwords, or decrypted document contents ever leave their local machines**.

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│     Client A (Admin/Sender)     │                 │       Client B (Recipient)      │
│  - Local ML-KEM/ML-DSA Keys     │                 │  - Local ML-KEM/ML-DSA Keys     │
│  - Local Argon2id Vault         │                 │  - Local Argon2id Vault         │
│  - Local Decryptor & Watermark  │                 │  - Local Decryptor & Watermark  │
└────────────────┬────────────────┘                 └────────────────┬────────────────┘
                 │                                                   │
                 │ HTTPS (TLS 1.3)                                   │ HTTPS (TLS 1.3)
                 │ Realtime SSE / Polling                            │ Realtime SSE / Polling
                 ▼                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    ONE CENTRAL LEAKTRACE BACKEND (FastAPI / Render)                 │
│  - Zero-Knowledge Public Key Directory       - Ephemeral Challenge-Response Auth   │
│  - Permissioned 3-of-4 Notary Blockchain    - Realtime Event Broker (SSE)          │
│  - Single Protected PDF Distribution Enclave - Cold-Start / Health Monitoring       │
└──────────────────────────┬───────────────────────────────┬──────────────────────────┘
                           │                               │
                           ▼                               ▼
       ┌───────────────────────────────┐       ┌───────────────────────────────┐
       │   ONE CENTRAL DATABASE        │       │   PROTECTED DOCUMENT STORAGE  │
       │   (Supabase PostgreSQL)       │       │   (Supabase / PostgreSQL)     │
       │   - Public Identities & Roles │       │   - Single Protected PDF      │
       │   - Sessions & Nonce Registry │       │     (AES-256 with ML-KEM      │
       │   - Append-Only DLT Ledger    │       │      Recipient Slots)         │
       └───────────────────────────────┘       └───────────────────────────────┘
```

### Cryptographic Security Boundary
| Stored Centrally in Cloud (Render + Supabase) | Kept EXCLUSIVELY on Local Laptop (Sovereign) |
|---|---|
| User Recipient IDs, Names, Units | ML-KEM-768 Private Decryption Key |
| User Public ML-KEM & ML-DSA Keys | ML-DSA-65 Private Signing Key |
| User Roles & Approval Status | User Login Passwords (Argon2id Vault) |
| Nonces & Cryptographic Challenges | Decrypted Credential Vault Plaintext |
| Opaque Active Session Tokens | Document Open Secret (DOS) |
| Single Shared AES-256 Protected PDF | Decrypted Document Plaintext |
| Signed Decryption Provenance Receipts | Plaintext Watermark Implementation Data |
| Append-Only DLT Ledger Blocks | Local Cryptographic Hardware Fingerprints |

---

## 2. Step 1: Set Up Supabase PostgreSQL Database (Free Forever)

1. Sign up for a free account at [https://supabase.com](https://supabase.com).
2. Click **New Project**:
   - **Name:** `leaktrace-db`
   - **Database Password:** Enter a strong password (save this securely).
   - **Region:** Choose the region closest to your team (e.g., `South Asia (Mumbai)`).
   - **Pricing Plan:** Free ($0/month).
3. Once the database is provisioned (approx. 60 seconds), go to **Project Settings** &rarr; **Database** &rarr; **Connection string**:
   - Select **URI** (or **Transaction Pooler**).
   - Copy the connection string. It will look like:
     ```
     postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
     ```
   - Replace `[PASSWORD]` with your actual database password.
4. Run the Schema Migration:
   - In Supabase, navigate to the **SQL Editor** tab on the left sidebar.
   - Click **New Query**.
   - Open [`backend/migrations/001_initial_schema.sql`](file:///c:/Users/sayed/Documents/antigravity/brave-einstein/backend/migrations/001_initial_schema.sql) from this repository.
   - Copy and paste the entire script into the SQL editor and click **Run**.
   - Verify that tables `identities`, `sessions`, `auth_challenges`, `ledger_blocks`, `watermark_index`, `protected_documents`, and `app_config` are created.
5. (Optional) Create Storage Bucket for Encrypted PDFs:
   - Navigate to **Storage** on the left sidebar.
   - Click **New Bucket**.
   - Name: `leaktrace-documents`.
   - Toggle **Public bucket** to **OFF** (private bucket).
   - Under **Project Settings** &rarr; **API**, copy your `URL` and `service_role` secret key.

---

## 3. Step 2: Deploy FastAPI Backend on Render (Free Forever)

1. Sign up for a free account at [https://render.com](https://render.com).
2. Connect your GitHub account and click **New +** &rarr; **Web Service**.
3. Select your repository: `LeakTrace`.
4. Configure the service:
   - **Name:** `leaktrace-backend`
   - **Region:** Choose the region closest to your Supabase region (e.g., `Singapore` or `Frankfurt`).
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free` ($0.00/month)
5. Add Environment Variables:
   Under **Environment Variables**, add:
   - `DATABASE_URL`: Your Supabase connection string from Step 1.
   - `PYTHON_VERSION`: `3.11.8`
   - `SUPABASE_URL`: (Optional) Your Supabase Project URL.
   - `SUPABASE_KEY`: (Optional) Your Supabase `service_role` secret key.
   - `SUPABASE_STORAGE_BUCKET`: `leaktrace-documents`
   - `LEAKTRACE_API_URL`: Your assigned Render service URL (e.g., `https://leaktrace-backend.onrender.com`).
6. Click **Create Web Service**.
7. Wait 2-3 minutes for the build to complete. Once deployed, test your backend in your browser or terminal:
   ```bash
   curl https://leaktrace-backend.onrender.com/health
   # Response: {"status":"HEALTHY","mode":"connected_postgres","version":"2.4.0-cloud",...}
   ```

---

## 4. Step 3: Configure and Package Electron Desktop Client

Desktop clients need to know the central backend address. LeakTrace is built to read the central URL seamlessly.

### Development / Testing from Workstations:
To run the client pointing to the live central cloud backend:

**PowerShell (Windows):**
```powershell
$env:LEAKTRACE_API_URL = "https://leaktrace-backend.onrender.com"
cd frontend
npm run dev
```

### Production Build & Installer Generation:
To build the Windows MSI/EXE installer for distribution to team members and friends:

1. In `frontend/.env.production` (or `frontend/.env`):
   ```env
   VITE_API_URL=https://leaktrace-backend.onrender.com
   ```
2. Build the Electron desktop distribution package:
   ```powershell
   cd frontend
   npm run build
   npx electron-builder --win msi --publish never
   ```
3. The standalone Windows installer will be generated in `frontend/dist-electron/` (or `dist/`).
4. Share the installer with team members. They can install it on any Windows laptop anywhere in the world.

---

## 5. Step 4: Multi-User Operational Walkthrough

Here is the exact live sequence when multiple people use LeakTrace:

### 1. Initial Launch: Enclave Bootstrap (Admin / You)
- You launch LeakTrace on your laptop.
- Because the central database is freshly provisioned, you are greeted with the **Organization Setup** screen.
- Enter your Officer Name (`Miqdaad Sayyed`), Command (`WESEE Naval Command`), and master password.
- Your ML-KEM-768 and ML-DSA-65 keys are generated locally. Your Argon2id vault is encrypted locally. Only your public key profile is registered to the central backend.
- You are now the enclave **Administrator**.

### 2. Friend Registration (e.g., Annam on a Laptop 10 km Away)
- Your friend opens LeakTrace on their laptop.
- The app points to `https://leaktrace-backend.onrender.com`.
- They select **Create Account / Register Workstation**.
- They enter their details: Callsign: `Annam Kazi`, Unit: `Naval Communications`, Password: `[THEIR_PASSWORD]`.
- Their laptop generates ML-KEM-768 and ML-DSA-65 keypairs locally.
- Their laptop creates an Argon2id vault locally and stores it strictly on their disk.
- Their client sends **ONLY public key material** to the central backend.
- The backend stores them in `identities` with `role: "pending"`.
- Friend sees: `Status: Pending Administrator Authorization`.

### 3. Realtime Approval (Admin's Laptop)
- On your laptop, the **Admin Dashboard** receives a live `USER_REGISTERED` event via Server-Sent Events (SSE).
- The "Pending Authorizations" badge updates in real time without refreshing.
- You see `Annam Kazi (Naval Communications)` with their public fingerprint.
- You click **Approve** and assign role `Recipient`.
- The central backend updates the database and broadcasts `USER_APPROVED`.

### 4. Zero-Password Login (Friend's Laptop)
- Friend's client receives the approval notification.
- Friend logs in.
- **Login Flow:**
  1. Client requests a 32-byte cryptographic nonce challenge from the central backend.
  2. Friend enters their local LeakTrace password.
  3. Password unlocks the **local** Argon2id vault.
  4. Workstation signs the challenge nonce using their **local ML-DSA-65 private key**.
  5. Signature is sent to the backend. The backend cryptographically verifies the signature against the friend's registered public key.
  6. Backend issues an opaque session token. **Zero passwords or private keys ever traversed the Internet!**

### 5. Document Protection & Distribution (Sender's Laptop)
- You go to **Protect Document**.
- You select the classified PDF directive.
- Under Authorized Recipients, you select `Annam Kazi` (fetched live from the central backend).
- The client generates a random 256-bit Document Open Secret (DOS).
- The document is encrypted **once** using standard AES-256 PDF encryption.
- An ML-KEM-768 slot is wrapped for Annam Kazi (plus any other selected recipients).
- The protected PDF is uploaded to the central backend.
- The backend stores the protected PDF and broadcasts `DOCUMENT_AUTHORIZED` and `DOCUMENT_AVAILABLE`.

### 6. Remote Download & Local Decryption (Friend's Laptop)
- Friend sees the new document in their **My Documents** view.
- Friend clicks **Download Protected Document**.
- Both you and Friend hold the **exact same binary file** (`SHA-256` hashes are identical).
- Friend clicks **Decrypt & Open**.
- Friend enters their local password to unlock their vault.
- Friend's local ML-KEM-768 private key unwraps the Document Open Secret from their personal slot.
- The original AES-256 PDF is decrypted locally in memory.
- An imperceptible forensic watermark is injected with a unique session ID.
- Friend's laptop produces an **ML-DSA-65 digital signature** over the decryption receipt.
- The signed receipt is submitted to the central backend.
- The central backend logs the receipt into the **3-of-4 Notary Blockchain Ledger**.

### 7. Forensic Leak Investigation
- If a leaked document is ever intercepted, anyone with investigator clearance can upload the leaked file to the **Forensics Investigation Engine**.
- The engine extracts the steganographic watermark, queries the immutable central ledger, verifies the recipient's ML-DSA-65 signature, and provides mathematical non-repudiable proof of the exact officer and workstation who decrypted the file.

---

## 6. Cold-Start Handling & Performance Optimization

Render's free tier spins down web services after 15 minutes of inactivity:
- **Automatic Health Ping:** The LeakTrace desktop client contains automatic retry logic with exponential backoff on `/health` when waking a cold instance.
- **Visual Status Badge:** The desktop app header displays an amber `Connecting to Enclave...` indicator while the service awakens, transitioning to a green `Enclave Connected` badge within seconds.
- **Free Keep-Alive Option:** You can optionally configure a free external monitoring ping (such as [UptimeRobot](https://uptimerobot.com) or [Cron-Job.org](https://cron-job.org)) to hit `https://your-service.onrender.com/health` every 10 minutes to keep your backend warm 24/7 at $0 cost.

---

## 7. Air-Gapped / Offline Workstation Fallback

LeakTrace maintains full dual-mode support:
- If a laptop is deployed into an air-gapped facility or loses internet connectivity:
  1. The client detects connection loss and switches to **Offline Mode**.
  2. Local operations run against the built-in SQLite database engine (`leaktrace.db`).
  3. Receipts are saved to the offline queue and can be synced back when connectivity is restored.
