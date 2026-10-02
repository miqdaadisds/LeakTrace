import secrets
import time

def create_session(db, user_id, ttl_seconds=86400 * 7):
    token = secrets.token_urlsafe(32)
    created_at = time.time()
    expires_at = created_at + ttl_seconds
    db.insert_session(token, user_id, created_at, expires_at)
    return token

def validate_session(db, token):
    db.cleanup_expired_sessions()
    session = db.get_session(token)
    if not session:
        return None
    user = db.get_identity(session['user_id'])
    if not user or user['is_revoked']:
        return None
    return {'user_id': user['recipient_id'], 'role': user['role']}

def invalidate_session(db, token):
    db.delete_session(token)
