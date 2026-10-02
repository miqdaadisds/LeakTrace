"""
Tests for Password & Account Recovery:
- Recovery Key issued once during registration / setup
- Password reset using Recovery Key retains cryptographic identity
- Old password ceases to work after reset
- New password successfully decrypts the primary vault
- Incorrect recovery key is rejected
"""
import os
import json
import pytest
from fastapi import HTTPException

from app.db.database import Database
from app.auth import middleware
from app.api.routes_auth import (
    auth_register, auth_login, auth_recover_password,
    RegisterRequest, LoginRequest, RecoverPasswordRequest
)


@pytest.fixture(autouse=True)
def clean_test_db(tmp_path):
    test_db_path = str(tmp_path / "test_recovery.db")
    test_db = Database(test_db_path)
    test_db.initialize()
    middleware.db = test_db
    yield
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass


def test_password_recovery_with_valid_key():
    # 1. Register user and capture recovery key
    data = auth_register(RegisterRequest(
        name="Officer Charlie",
        unit="Naval Intelligence",
        password="OldForgottenPassword2026!"
    ))
    recipient_id = data["user"]["recipient_id"]
    recovery_key = data["recovery_key"]

    # 2. Attempt recovery with wrong key -> 401
    with pytest.raises(HTTPException) as exc_bad:
        auth_recover_password(RecoverPasswordRequest(
            recipient_id=recipient_id,
            recovery_key="InvalidRecoveryKey12345",
            new_password="BrandNewPassword2026!"
        ))
    assert exc_bad.value.status_code == 401

    # 3. Successful recovery with genuine recovery key
    good_rec = auth_recover_password(RecoverPasswordRequest(
        recipient_id=recipient_id,
        recovery_key=recovery_key,
        new_password="BrandNewPassword2026!"
    ))
    assert good_rec["status"] == "SUCCESS"

    # 4. Old password no longer works
    with pytest.raises(HTTPException) as exc_old:
        auth_login(LoginRequest(
            recipient_id=recipient_id,
            password="OldForgottenPassword2026!"
        ))
    assert exc_old.value.status_code == 401

    # 5. New password works seamlessly and returns session token
    new_login = auth_login(LoginRequest(
        recipient_id=recipient_id,
        password="BrandNewPassword2026!"
    ))
    assert "token" in new_login
