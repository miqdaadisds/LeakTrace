import os
import sys
import subprocess
import json
import urllib.request

p = subprocess.Popen(['git', 'credential', 'fill'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
out, _ = p.communicate('protocol=https\nhost=github.com\n')
token = None
for l in out.splitlines():
    if l.startswith('password='):
        token = l.split('=', 1)[1].strip()

if not token:
    print("No token found")
    sys.exit(1)

req = urllib.request.Request(
    'https://api.github.com/repos/miqdaadisds/LeakTrace/releases',
    headers={'Authorization': f'Bearer {token}', 'User-Agent': 'test'}
)
with urllib.request.urlopen(req) as resp:
    releases = json.loads(resp.read().decode())
    for r in releases:
        print(f"Release ID {r['id']}: tag={r['tag_name']}, name={r['name']}")
        for a in r.get('assets', []):
            print(f"   Asset: {a['name']} ({a['size']} bytes) ID={a['id']}")
