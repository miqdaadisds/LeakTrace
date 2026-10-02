import os
import sys
import subprocess
import json
import urllib.request
import urllib.parse

def get_github_token():
    p = subprocess.Popen(['git', 'credential', 'fill'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    out, _ = p.communicate('protocol=https\nhost=github.com\n')
    for line in out.splitlines():
        if line.startswith('password='):
            return line.split('=', 1)[1].strip()
    return None

def publish():
    token = get_github_token()
    if not token:
        print("ERROR: Could not retrieve GitHub token from Git Credential Manager")
        sys.exit(1)
        
    repo = "miqdaadisds/LeakTrace"
    tag = "v1.0.0"
    title = "LeakTrace v1.0.0 — Standalone MSI & Desktop Enclave"
    body = (
        "## LeakTrace v1.0.0: Cryptographic Attribution & Provenance Enclave\n\n"
        "Official Release for SIH 2026 Problem Statement No. 237 (ID: 26237) — Ministry of Defence / WESEE.\n\n"
        "### Key Highlights:\n"
        "- **100% Self-Contained Standalone App:** Zero runtime prerequisites on target systems (no Python, Node.js, Git, or pip needed).\n"
        "- **Pre-Configured Administrator Enclave:** Organization Master Administrator (`Miqdaad Sayyed`, WESEE Naval Directorate) pre-seeded and locked.\n"
        "- **Seamless First-Launch:** Opens directly to the Sign In interface; friends and officers can register individual recipient accounts without accessing administrative configuration.\n"
        "- **Post-Quantum Cryptography:** NIST FIPS 203 ML-KEM-768 hybrid envelope distribution and NIST FIPS 204 ML-DSA-65 non-repudiation signing.\n"
        "- **4-Node Permissioned Quorum:** Local DLT notary ledger tracking recipient decryption receipts.\n\n"
        "### Installer Downloads:\n"
        "- **`LeakTrace 1.0.0.msi`**: Official Microsoft Windows Installer (181 MB)\n"
        "- **`LeakTrace Setup 1.0.0.exe`**: Standalone Setup Wizard with desktop & start menu shortcuts (169 MB)\n"
    )
    
    # 1. Create or get existing release
    url = f"https://api.github.com/repos/{repo}/releases"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "LeakTrace-Release-Bot"
    }
    
    # Check if release already exists
    tag_url = f"{url}/tags/{tag}"
    req = urllib.request.Request(tag_url, headers=headers)
    release = None
    try:
        with urllib.request.urlopen(req) as resp:
            release = json.loads(resp.read().decode('utf-8'))
            print(f"Found existing release ID: {release['id']}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            pass
        else:
            print(f"Check release error: {e.read().decode('utf-8')}")
            
    if not release:
        payload = json.dumps({
            "tag_name": tag,
            "target_commitish": "main",
            "name": title,
            "body": body,
            "draft": False,
            "prerelease": False
        }).encode('utf-8')
        
        req = urllib.request.Request(url, data=payload, headers={**headers, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as resp:
                release = json.loads(resp.read().decode('utf-8'))
                print(f"Created new release ID: {release['id']} ({release['html_url']})")
        except urllib.error.HTTPError as e:
            print(f"Create release error: {e.read().decode('utf-8')}")
            sys.exit(1)

    release_id = release['id']
    upload_url_template = release['upload_url'].split('{')[0]
    
    # 2. Upload assets
    assets = [
        ("LeakTrace-1.0.0.msi", os.path.abspath("packages/LeakTrace 1.0.0.msi"), "application/x-msi"),
        ("LeakTrace-Setup-1.0.0.exe", os.path.abspath("packages/LeakTrace Setup 1.0.0.exe"), "application/vnd.microsoft.portable-executable")
    ]
    
    existing_asset_names = [a['name'] for a in release.get('assets', [])]
    
    for asset_name, asset_path, mime_type in assets:
        if asset_name in existing_asset_names:
            print(f"Asset '{asset_name}' already attached. Skipping.")
            continue
            
        if not os.path.exists(asset_path):
            print(f"WARNING: File not found: {asset_path}")
            continue
            
        size = os.path.getsize(asset_path)
        print(f"Uploading {asset_name} ({size / (1024*1024):.1f} MB)...")
        
        upload_endpoint = f"{upload_url_template}?name={urllib.parse.quote(asset_name)}"
        
        with open(asset_path, 'rb') as f:
            data = f.read()
            
        req = urllib.request.Request(
            upload_endpoint,
            data=data,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "Content-Type": mime_type,
                "Content-Length": str(size),
                "User-Agent": "LeakTrace-Release-Bot"
            }
        )
        
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                print(f"Successfully uploaded: {result['name']} -> {result['browser_download_url']}")
        except urllib.error.HTTPError as e:
            print(f"Upload error for {asset_name}: {e.read().decode('utf-8')}")

    print("\nRelease publishing completed successfully!")
    print(f"Release URL: {release['html_url']}")

if __name__ == '__main__':
    publish()
