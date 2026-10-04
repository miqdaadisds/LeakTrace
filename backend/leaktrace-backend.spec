# -*- mode: python ; coding: utf-8 -*-
import os
import sys

block_cipher = None

backend_dir = os.path.abspath(SPECPATH)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

datas = [
    (os.path.join(backend_dir, 'app'), 'app'),
]

# Include default db if exists
db_path = os.path.join(backend_dir, 'leaktrace.db')
if os.path.exists(db_path):
    datas.append((db_path, '.'))

hidden_imports = [
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'fastapi',
    'pydantic',
    'argon2',
    'argon2._ffi',
    '_cffi_backend',
    'cryptography',
    'reportlab',
    'reportlab.lib',
    'reportlab.lib.colors',
    'reportlab.lib.pagesizes',
    'reportlab.pdfgen',
    'reportlab.pdfgen.canvas',
    'reportlab.platypus',
    'PIL',
    'PIL.Image',
    'scipy',
    'scipy.fft',
    'scipy.fftpack',
    'numpy',
    'multipart',
    'psycopg2',
    'psycopg2.extras',
    'psycopg2.extensions',
    'app',
    'app.config',
    'app.main',
    'app.db',
    'app.db.base_repo',
    'app.db.database',
    'app.db.factory',
    'app.db.postgres_repo',
    'app.db.sqlite_repo',
    'app.db.storage',
    'app.auth.session_manager',
    'app.auth.middleware',
    'app.core.events',
    'app.core.state',
    'app.core.types',
    'app.core.pdf_generator',
    'app.crypto.pqc_kem',
    'app.crypto.pqc_sig',
    'app.crypto.vault',
    'app.crypto.envelope',
    'app.crypto.pdf_protector',
    'app.client.decryptor',
    'app.forensics.attribution_engine',
    'app.provenance.ledger',
    'app.provenance.merkle_tree',
    'app.provenance.validator',
    'app.watermarking.base',
    'app.watermarking.dct_qim',
    'app.watermarking.pdf_stego',
    'app.watermarking.text_stego',
    'app.api.routes_auth',
    'app.api.routes_distribution',
    'app.api.routes_forensics',
    'app.api.routes_identity',
    'app.api.routes_ledger',
    'app.api.routes_recipient',
    'app.api.routes_security',
]

a = Analysis(
    ['run_server.py'],
    pathex=[backend_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='leaktrace-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='leaktrace-backend',
)
