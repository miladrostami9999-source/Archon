"""Symmetric encryption for the one secret in this database that has to be
reversible: a connected Gmail account's refresh token. Everything else
sensitive here (passwords) is one-way hashed — this is deliberately
different because we need the plaintext back to call the Gmail API.

The key lives only in an env var (ENCRYPTION_KEY), never in the database, so
a leaked DB dump alone isn't enough to decrypt anything.
"""
import os

from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set in your .env file. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode())


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise RuntimeError("Could not decrypt stored token — ENCRYPTION_KEY may have changed.")
