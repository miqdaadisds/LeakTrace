import os
import sys
import subprocess
import json

def get_github_token():
    p = subprocess.Popen(['git', 'credential', 'fill'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    out, _ = p.communicate('protocol=https\nhost=github.com\n')
    for line in out.splitlines():
        if line.startswith('password='):
            return line.split('=', 1)[1].strip()
    return None

def upload():
    token = get_github_token()
    if not token:
        print("ERROR: Could not get GitHub token")
        sys.exit(1)

    release_id = 403041779
    assets = [
        ("TraceLeak-1.2.0.msi", os.path.abspath("releases/TraceLeak 1.2.0.msi"), "application/x-msi"),
        ("TraceLeak-Setup-1.2.0.exe", os.path.abspath("releases/TraceLeak Setup 1.2.0.exe"), "application/vnd.microsoft.portable-executable")
    ]

    # Fetch existing assets to delete them before re-uploading
    cmd_list = [
        "curl.exe", "-s",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Accept: application/vnd.github+json",
        f"https://api.github.com/repos/miqdaadisds/LeakTrace/releases/{release_id}/assets"
    ]
    p = subprocess.Popen(cmd_list, stdout=subprocess.PIPE, text=True)
    out_list, _ = p.communicate()
    try:
        existing = json.loads(out_list)
        for item in existing:
            for name, _, _ in assets:
                if item.get("name") == name:
                    asset_id = item["id"]
                    print(f"Deleting older release asset {name} (ID: {asset_id})...")
                    del_cmd = [
                        "curl.exe", "-s", "-X", "DELETE",
                        "-H", f"Authorization: Bearer {token}",
                        f"https://api.github.com/repos/miqdaadisds/LeakTrace/releases/assets/{asset_id}"
                    ]
                    subprocess.run(del_cmd)
                    print(f"Deleted old asset {name}.")
    except Exception as e:
        print(f"Warning checking existing assets: {e}")

    for name, path, mime in assets:
        if not os.path.exists(path):
            print(f"File not found: {path}")
            continue

        size = os.path.getsize(path)
        print(f"\n==========================================")
        print(f"Uploading {name} ({size / (1024*1024):.1f} MB) via curl.exe...")
        print(f"==========================================")

        url = f"https://uploads.github.com/repos/miqdaadisds/LeakTrace/releases/{release_id}/assets?name={name}"

        cmd = [
            "curl.exe",
            "-X", "POST",
            "-H", f"Authorization: Bearer {token}",
            "-H", "Accept: application/vnd.github+json",
            "-H", f"Content-Type: {mime}",
            "--data-binary", f"@{path}",
            url
        ]

        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        out, err = p.communicate()

        if p.returncode == 0:
            try:
                res = json.loads(out)
                if "browser_download_url" in res:
                    print(f"SUCCESS: {name} uploaded successfully!")
                    print(f"Download URL: {res['browser_download_url']}")
                else:
                    print(f"Response: {out}")
            except Exception:
                print(f"Output: {out}")
        else:
            print(f"curl failed with code {p.returncode}: {err}")

    print("\nUpload script completed!")

if __name__ == '__main__':
    upload()
