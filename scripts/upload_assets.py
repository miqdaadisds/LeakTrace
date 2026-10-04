import os
import sys
import subprocess
import httpx
import time

def get_github_token():
    p = subprocess.Popen(['git', 'credential', 'fill'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    out, _ = p.communicate('protocol=https\nhost=github.com\n')
    for line in out.splitlines():
        if line.startswith('password='):
            return line.split('=', 1)[1].strip()
    return None

def upload_assets():
    token = get_github_token()
    if not token:
        print("ERROR: Could not retrieve GitHub token")
        sys.exit(1)
        
    repo = "miqdaadisds/LeakTrace"
    tag = "v1.1"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "LeakTrace-Release-Uploader"
    }
    
    # 1. Get release info
    with httpx.Client(timeout=30.0) as client:
        res = client.get(f"https://api.github.com/repos/{repo}/releases/tags/{tag}", headers=headers)
        if res.status_code != 200:
            print(f"Error fetching release: {res.status_code} {res.text}")
            sys.exit(1)
        release = res.json()
        
    release_id = release["id"]
    upload_url_template = release["upload_url"].split("{")[0]
    print(f"Found release '{release['name']}' (ID: {release_id})")
    
    assets = [
        ("TraceLeak-1.1.0.msi", os.path.abspath("releases/TraceLeak 1.1.0.msi"), "application/x-msi"),
        ("TraceLeak-Setup-1.1.0.exe", os.path.abspath("releases/TraceLeak Setup 1.1.0.exe"), "application/octet-stream")
    ]
    
    for asset_name, asset_path, mime_type in assets:
        if not os.path.exists(asset_path):
            print(f"File not found: {asset_path}")
            continue

        size = os.path.getsize(asset_path)
        existing_match = next((a for a in release.get("assets", []) if a["name"] == asset_name), None)
        if existing_match and existing_match.get("size") == size:
            print(f"Asset '{asset_name}' already uploaded and size matches ({size / (1024*1024):.1f} MB). Skipping.")
            continue

        if existing_match:
            print(f"Deleting older/partial asset '{asset_name}' (ID: {existing_match['id']})...")
            with httpx.Client(timeout=30.0) as client:
                client.delete(f"https://api.github.com/repos/{repo}/releases/assets/{existing_match['id']}", headers=headers)

        print(f"\nUploading {asset_name} ({size / (1024*1024):.1f} MB)...")
        
        upload_url = f"{upload_url_template}?name={asset_name}"
        upload_headers = {
            **headers,
            "Content-Type": mime_type,
            "Content-Length": str(size)
        }
        
        def read_chunks(p, chunk_sz=2 * 1024 * 1024):
            with open(p, "rb") as f:
                while True:
                    chunk = f.read(chunk_sz)
                    if not chunk:
                        break
                    yield chunk

        success = False
        for attempt in range(1, 4):
            try:
                print(f"Attempt {attempt}/3...")
                with httpx.Client(timeout=httpx.Timeout(1800.0, connect=120.0, read=1800.0, write=1800.0)) as upload_client:
                    upload_res = upload_client.post(
                        upload_url,
                        content=read_chunks(asset_path),
                        headers=upload_headers
                    )
                    
                if upload_res.status_code in (200, 201):
                    asset_info = upload_res.json()
                    print(f"SUCCESS: {asset_name} uploaded!")
                    print(f"Download URL: {asset_info['browser_download_url']}")
                    success = True
                    break
                else:
                    print(f"Upload failed (status {upload_res.status_code}): {upload_res.text}")
                    time.sleep(5)
            except Exception as e:
                print(f"Exception during upload: {e}")
                time.sleep(5)
                
        if not success:
            print(f"FAILED to upload {asset_name} after 3 attempts.")

    print("\nRelease upload process finished!")
    print(f"Release page: {release['html_url']}")

if __name__ == "__main__":
    upload_assets()
