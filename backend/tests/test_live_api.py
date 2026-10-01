import urllib.request
import urllib.parse
import json
import io
import socket
import pytest

def is_server_running(host="127.0.0.1", port=8000):
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False

def test_live_server_end_to_end_flow():
    if not is_server_running():
        pytest.skip("Live server on 127.0.0.1:8000 is not running. Launch desktop app or run uvicorn to test live API.")

    # Ensure ledger is clean and restored
    try:
        req_reset = urllib.request.Request(
            'http://127.0.0.1:8000/api/ledger/restore',
            data=json.dumps({'block_index': 1, 'original_recipient': 'USER-BOB'}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req_reset)
    except Exception:
        pass

    # 1. Decrypt as Bob
    data = urllib.parse.urlencode({
        'doc_id': 'DOC-7F3A29B1',
        'recipient_id': 'USER-BOB',
        'password': 'BobSecure2026!'
    }).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:8000/api/recipient/decrypt', data=data)
    res = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    assert res['status'] == 'DECRYPTION_SUCCESSFUL'
    assert res['recipient_id'] == 'USER-BOB'
    assert res['watermark_id'].startswith('WM-')

    # 2. Download watermarked PDF
    pdf_url = 'http://127.0.0.1:8000' + res['pdf_download_url']
    pdf_bytes = urllib.request.urlopen(pdf_url).read()
    assert len(pdf_bytes) > 500

    # 3. Upload leaked PDF to Forensics Lab
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    body = io.BytesIO()
    header = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="LEAKED_BOB.pdf"\r\n'
        f'Content-Type: application/pdf\r\n\r\n'
    ).encode('utf-8')
    body.write(header)
    body.write(pdf_bytes)
    body.write(f'\r\n--{boundary}--\r\n'.encode('utf-8'))

    req_forensics = urllib.request.Request(
        'http://127.0.0.1:8000/api/forensics/analyze-pdf',
        data=body.getvalue(),
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    forensics_res = json.loads(urllib.request.urlopen(req_forensics).read().decode('utf-8'))
    assert forensics_res['is_attributed'] is True
    assert forensics_res['recipient_id'] == 'USER-BOB'
    assert forensics_res['watermark_status'] == 'MATCHED'
    assert forensics_res['signature_status'] == 'VALID'
    assert forensics_res['ledger_status'] == 'VALID'

    # 4. Tamper Test
    req_tamper = urllib.request.Request(
        'http://127.0.0.1:8000/api/ledger/tamper-test',
        data=json.dumps({'block_index': 1, 'fake_recipient': 'COMPROMISED-ATTACKER'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    tamper_res = json.loads(urllib.request.urlopen(req_tamper).read().decode('utf-8'))
    assert tamper_res['verification_result']['detected_tampering'] is True

    # 5. Restore back to valid state
    req_restore = urllib.request.Request(
        'http://127.0.0.1:8000/api/ledger/restore',
        data=json.dumps({'block_index': 1, 'original_recipient': 'USER-BOB'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    restore_res = json.loads(urllib.request.urlopen(req_restore).read().decode('utf-8'))
    assert restore_res['is_valid'] is True
