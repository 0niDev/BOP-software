"""
Password hashing utilities.

Uses PBKDF2-HMAC-SHA256 with a random per-user salt (stdlib `hashlib`,
no extra dependency required). This is the single place password
hashing happens, so upgrading the algorithm later (e.g. to argon2)
only requires changing this module.
"""
from __future__ import annotations

import hashlib
import hmac
import os

_ITERATIONS = 200_000
_ALGO = "sha256"


def hash_password(plain_password: str, salt: str | None = None) -> tuple[str, str]:
    """
    Returns (salt_hex, hash_hex). If salt is not provided, a new random
    16-byte salt is generated (used when creating/resetting a password).
    """
    salt_bytes = bytes.fromhex(salt) if salt else os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        _ALGO, plain_password.encode("utf-8"), salt_bytes, _ITERATIONS
    )
    return salt_bytes.hex(), digest.hex()


def verify_password(plain_password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    _, computed_hash = hash_password(plain_password, salt_hex)
    return hmac.compare_digest(computed_hash, expected_hash_hex)
