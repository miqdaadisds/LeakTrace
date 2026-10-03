from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
try:
    from app.auth.session_manager import validate_session
except ImportError:
    from backend.app.auth.session_manager import validate_session

security = HTTPBearer(auto_error=False)
db = None  # To be set by main.py

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    if not credentials or not hasattr(credentials, "credentials"):
        raise HTTPException(status_code=401, detail="Authentication token required")
    token = credentials.credentials
    user_info = validate_session(db, token)
    if not user_info:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user_info

def require_role(*allowed_roles):
    def role_checker(user_info: dict = Security(get_current_user)):
        if user_info['role'] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user_info
    return role_checker
