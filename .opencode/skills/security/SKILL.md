# Security Skill for BOP-software ERP

## Overview
Provides authentication and security utilities for the Pharmaceutical ERP system. Wraps the existing auth_service with additional security features and best practices.

## When to Use
- Implementing password policies and validation
- Authenticating users against the users table
- Managing user roles and permissions
- Secure password hashing and verification
- Audit logging for authentication events

## Project Security Architecture

### Existing Components
- `authentication/auth_service.py` - Core authentication service
- `authentication/auth_service.py` - User repository integration
- `utils/security.py` - Password hashing utilities (hash_password, verify_password)
- `utils/exceptions.py` - AuthenticationError, ValidationError

### User Roles (planned)
- Accountant (full access)
- Manager (limited access)
- Storekeeper (inventory access)
- Production Manager (manufacturing access)

## Common Operations

### User Login
```python
from authentication.auth_service import AuthService

auth = AuthService(db)
user = auth.login("username", "password")
```

### Password Change
```python
auth.change_password(user_id, old_password, new_password)
```

### Check User Permissions
```python
user = auth.current_user
if user.role_name == "accountant":
    # Full access
    pass
```

### Generate Audit Log
```python
from utils.logger import get_logger
logger = get_logger(__name__)
logger.info("User %s performed action", user.username)
```

## Security Best Practices
- Passwords minimum 6 characters (enforced in auth_service)
- Password hashing with salt (using `utils.security.hash_password`)
- Session management via `_current_user` property
- Active user validation (`is_active` check)
- Login attempt logging

## Extending Security
To add new roles/permissions:
1. Add role to `models/user.py`
2. Update `auth_service.py` login logic
3. Add permission checks in controllers
4. Update UI visibility in views