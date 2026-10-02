"""
Tests for Role-Based Access Control (RBAC):
- Roles: ADMIN, SENDER, RECIPIENT, INVESTIGATOR, PENDING
- Admin approvals and role assignments
- Non-admin users cannot approve accounts or reassign roles
"""
import os
import pytest
from fastapi import HTTPException

from app.db.database import Database
from app.auth import middleware
from app.api.routes_auth import (
    auth_setup, auth_register, auth_login, auth_me, auth_approve, auth_assign_role,
    SetupRequest, RegisterRequest, LoginRequest, ApproveRequest, AssignRoleRequest
)
from fastapi.security import HTTPAuthorizationCredentials


@pytest.fixture(autouse=True)
def clean_test_db(tmp_path):
    test_db_path = str(tmp_path / "test_rbac.db")
    test_db = Database(test_db_path)
    test_db.initialize()
    middleware.db = test_db
    yield
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass


def test_admin_approves_and_assigns_roles():
    # Setup Admin
    admin_data = auth_setup(SetupRequest(name="Admiral", unit="Command", password="Admin123Pass!"))
    admin_token = admin_data["token"]
    admin_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=admin_token)
    admin_info = middleware.get_current_user(admin_creds)

    # Register Alice
    reg_alice = auth_register(RegisterRequest(name="Alice", unit="Comms", password="AlicePass123!"))
    alice_id = reg_alice["user"]["recipient_id"]
    assert reg_alice["user"]["role"] == "pending"

    # Alice logs in while pending
    login_alice = auth_login(LoginRequest(recipient_id=alice_id, password="AlicePass123!"))
    alice_token = login_alice["token"]
    alice_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=alice_token)
    alice_info = middleware.get_current_user(alice_creds)

    # Alice (pending/non-admin) attempts to approve someone -> guard raises 403 Forbidden
    guard = middleware.require_role("admin")
    with pytest.raises(HTTPException) as exc_unauth:
        guard(alice_info)
    assert exc_unauth.value.status_code == 403

    # Admin approves Alice -> becomes 'recipient'
    admin_guard = middleware.require_role("admin")(admin_info)
    approve_res = auth_approve(ApproveRequest(recipient_id=alice_id), user_info=admin_guard)
    assert approve_res["status"] == "ok"

    # Alice role refreshed
    alice_info_updated = middleware.get_current_user(alice_creds)
    assert alice_info_updated["role"] == "recipient"

    # Admin assigns Alice role 'sender'
    assign_res = auth_assign_role(AssignRoleRequest(recipient_id=alice_id, role="sender"), user_info=admin_guard)
    assert assign_res["status"] == "ok"

    alice_info_sender = middleware.get_current_user(alice_creds)
    assert alice_info_sender["role"] == "sender"
