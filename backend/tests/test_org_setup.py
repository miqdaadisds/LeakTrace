"""
Tests for Organization Setup (First-Launch Bootstrap):
- Fresh database requires setup
- First user is Organization Admin
- Setup complete flag persisted
- Multiple setups prevented
"""
import os
import pytest
from fastapi import HTTPException

from app.db.database import Database
from app.auth import middleware
from app.api.routes_auth import auth_status, auth_setup, SetupRequest


@pytest.fixture(autouse=True)
def clean_test_db(tmp_path):
    test_db_path = str(tmp_path / "test_org.db")
    test_db = Database(test_db_path)
    test_db.initialize()
    middleware.db = test_db
    yield
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass


def test_first_launch_organization_setup():
    # 1. Fresh state requires setup
    status = auth_status()
    assert status["setup_complete"] is False

    # 2. Setup the organization administrator
    setup_req = SetupRequest(
        name="Fleet Commander",
        unit="Naval Headquarters",
        password="CommanderSecure2026!"
    )
    res_data = auth_setup(setup_req)
    assert res_data["user"]["role"] == "admin"
    assert "recovery_key" in res_data
    assert "token" in res_data

    # 3. Status now indicates setup is complete
    status_after = auth_status()
    assert status_after["setup_complete"] is True

    # 4. Attempting setup again is rejected
    with pytest.raises(HTTPException) as exc:
        auth_setup(setup_req)
    assert exc.value.status_code == 400
    assert "already complete" in exc.value.detail.lower()
