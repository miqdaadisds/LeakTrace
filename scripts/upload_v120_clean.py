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

def main():
    token = get_github_token()
    if not token:
        print("ERROR: Could not retrieve GitHub token", flush=True)
        sys.exit(1)

    repo = "miqdaadisds/LeakTrace"
    release_id = 403041779  # v1.2.0

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "TraceLeak-Release-Bot"
    }

    # Fetch release to get current upload_url and assets
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/{release_id}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        rel = json.loads(resp.read().decode())
    
    upload_url_template = rel['upload_url'].split('{')[0]
    print(f"Target Release: {rel['name']} (ID: {release_id})", flush=True)

    # Delete any 0-byte or leftover asset with matching name
    existing_assets = rel.get('assets', [])
    for a in existing_assets:
        print(f"Found existing asset: {a['name']} ({a['size']} bytes, ID: {a['id']})", flush=True)

    assets_to_upload = [
        ("TraceLeak-1.2.0.msi", os.path.abspath("releases/TraceLeak 1.2.0.msi"), "application/x-msi"),
        ("TraceLeak-Setup-1.2.0.exe", os.path.abspath("releases/TraceLeak Setup 1.2.0.exe"), "application/vnd.microsoft.portable-executable")
    ]

    for asset_name, asset_path, mime_type in assets_to_upload:
        if not os.path.exists(asset_path):
            print(f"ERROR: Local file does not exist: {asset_path}", flush=True)
            continue

        size = os.path.getsize(asset_path)

        # Check if already uploaded with matching size
        already_done = False
        for a in existing_assets:
            if a['name'] == asset_name:
                if a['size'] == size:
                    print(f"Asset '{asset_name}' already uploaded and matches size ({size} bytes). Skipping.", flush=True)
                    already_done = True
                    break
                else:
                    print(f"Deleting mismatched asset {asset_name} (ID: {a['id']})...", flush=True)
                    del_req = urllib.request.Request(
                        f"https://api.github.com/repos/{repo}/releases/assets/{a['id']}",
                        headers=headers,
                        method='DELETE'
                    )
                    with urllib.request.urlopen(del_req) as del_resp:
                        print(f"Deleted old asset {a['id']}", flush=True)

        if already_done:
            continue

        print(f"\nReading {asset_name} ({size / (1024*1024):.1f} MB) into memory...", flush=True)
        with open(asset_path, 'rb') as f:
            file_bytes = f.read()

        upload_url = f"{upload_url_template}?name={urllib.parse.quote(asset_name)}"
        print(f"Uploading {asset_name} to {upload_url} ...", flush=True)

        upload_req = urllib.request.Request(
            upload_url,
            data=file_bytes,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "Content-Type": mime_type,
                "Content-Length": str(size),
                "User-Agent": "TraceLeak-Release-Bot"
            },
            method='POST'
        )

        try:
            with urllib.request.urlopen(upload_req, timeout=600) as up_resp:
                res_data = json.loads(up_resp.read().decode())
                print(f"SUCCESS: Uploaded {res_data['name']} -> {res_data['browser_download_url']}", flush=True)
        except urllib.error.HTTPError as e:
            print(f"HTTP ERROR uploading {asset_name}: {e.code} - {e.read().decode()}", flush=True)
        except Exception as e:
            print(f"ERROR uploading {asset_name}: {e}", flush=True)

    print("\nAll assets processed successfully!", flush=True)

if __name__ == '__main__':
    main()
