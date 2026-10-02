"""
Tests for Authentication & Session Management:
- Organization Setup (first launch) creates Admin
- User Registration (defaults to Pending)
- Session token generation and validation (Opaque tokens, no JWT)
- Password validation via Argon2id credential vault
- Session invalidation on Logout
- Invalid/expired token rejection
"""
import os
import pytest
from fastapi import HTTPException

from app.db.database import Database
from app.auth import middleware
from app.api.routes_auth import (
    auth_status, auth_setup, auth_register, auth_login, auth_logout, auth_me,
    SetupRequest, RegisterRequest, LoginRequest
)
from fastapi.security import HTTPAuthorizationCredentials


@pytest.fixture(autouse=True)
def clean_test_db(tmp_path):
    test_db_path = str(tmp_path / "test_auth.db")
    test_db = Database(test_db_path)
    test_db.initialize()
    middleware.db = test_db
    yield
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass


def test_auth_setup_organization():
    # 1. Setup status is incomplete
    status = auth_status()
    assert status["setup_complete"] is False

    # 2. Perform initial admin setup
    setup_req = SetupRequest(
        name="Naval Admin",
        unit="WESEE HQ",
        password="AdminStrongPassword2026!"
    )
    data = auth_setup(setup_req)
    assert data["user"]["role"] == "admin"
    assert "recovery_key" in data
    assert len(data["recovery_key"]) > 20
    assert "token" in data

    # 3. Subsequent setup attempt fails
    with pytest.raises(HTTPException) as exc:
        auth_setup(setup_req)
    assert exc.value.status_code == 400


def test_auth_registration_and_login():
    # Setup admin first
    auth_setup(SetupRequest(name="Admin", unit="HQ", password="AdminPass123!"))

    # Register new user
    reg_data = auth_register(RegisterRequest(
        name="Commander Bob",
        unit="Submarine Flotilla",
        password="BobPasscode2026!"
    ))
    assert reg_data["user"]["role"] == "pending"
    bob_id = reg_data["user"]["recipient_id"]

    # Login with correct password
    login_data = auth_login(LoginRequest(
        recipient_id=bob_id,
        password="BobPasscode2026!"
    ))
    assert "token" in login_data
    token = login_data["token"]

    # Login with wrong password fails
    with pytest.raises(HTTPException) as exc:
        auth_login(LoginRequest(recipient_id=bob_id, password="WrongPassword!"))
    assert exc.value.status_code == 401

    # Check /api/auth/me
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user_info = middleware.get_current_user(creds)
    me_data = auth_me(user_info)
    assert me_data["recipient_id"] == bob_id

    # Logout
    logout_res = auth_logout(user_info, creds)
    assert logout_res["status"] == "ok"

    # Token now invalid
    with pytest.raises(HTTPException) as exc_after:
        middleware.get_current_user(creds)
    assert exc_after.value.status_code == 401
