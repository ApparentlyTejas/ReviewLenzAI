import pytest
from cryptography.fernet import InvalidToken

from app.services.crypto_service import decrypt_pat, encrypt_pat


def test_encrypt_then_decrypt_roundtrips():
    pat = "ghp_realLookingTokenValue123456789"
    encrypted = encrypt_pat(pat)
    assert decrypt_pat(encrypted) == pat


def test_encrypted_value_does_not_contain_the_plaintext():
    pat = "ghp_superSecretPat"
    encrypted = encrypt_pat(pat)
    assert pat not in encrypted


def test_encrypting_the_same_pat_twice_produces_different_ciphertext():
    # Fernet embeds a random IV and a timestamp, so two encryptions of the
    # same plaintext should never be byte-identical -- that's the whole
    # point of not using something like plain AES-ECB here.
    pat = "ghp_sameTokenBothTimes"
    first = encrypt_pat(pat)
    second = encrypt_pat(pat)
    assert first != second
    assert decrypt_pat(first) == decrypt_pat(second) == pat


def test_decrypting_garbage_raises():
    with pytest.raises(InvalidToken):
        decrypt_pat("not-a-real-fernet-token")


def test_decrypting_empty_string_raises():
    with pytest.raises(InvalidToken):
        decrypt_pat("")
