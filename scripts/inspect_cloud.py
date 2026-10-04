import urllib.request
import json

try:
    with urllib.request.urlopen('https://leaktrace-backend.onrender.com/api/identities') as r:
        data = json.loads(r.read().decode())
        print(f"Total cloud identities: {len(data)}")
        for d in data:
            print(f"- {d.get('recipient_id')}: {d.get('name')} (role={d.get('role')}, approved={d.get('approved')})")
except Exception as e:
    print("Error fetching cloud identities:", e)
