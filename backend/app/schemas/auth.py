from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# Common disposable/temporary email domains
_DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info", "sharklasers.com",
    "guerrillamailblock.com", "grr.la", "spam4.me", "trashmail.com", "trashmail.me",
    "trashmail.net", "trashmail.at", "trashmail.io", "trashmail.org", "trashmail.xyz",
    "tempmail.com", "tempmail.net", "tempmail.org", "temp-mail.org", "temp-mail.io",
    "throwam.com", "throwaway.email", "dispostable.com", "mailnull.com", "spamgourmet.com",
    "yopmail.com", "yopmail.fr", "yopmail.net", "spam.la", "spamfree24.org",
    "fakeinbox.com", "mailnesia.com", "maildrop.cc", "spamgourmet.net",
    "10minutemail.com", "10minutemail.net", "10minutemail.org", "10minutemail.co.uk",
    "20minutemail.com", "spamevader.com",
    "discard.email", "discardmail.com", "discardmail.de", "spamherelots.com",
    "mailexpire.com", "spamhereplease.com", "getairmail.com", "filzmail.com",
    "spamgob.com", "crap.handcrafted.jp", "hatespam.org",
    "jetable.fr.nf", "jetable.net", "jetable.org", "noref.in", "zetmail.com",
    "mt2015.com", "mt2014.com", "mt2009.com", "temporarymail.net", "spambox.us",
    "privacy.net", "mailbolt.com", "tempinbox.com", "tempr.email", "spamgourmet.org", "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org",
    "spambox.info", "spambox.me", "spambox.org", "spambox.net", "spambox.com",
    "gufum.com", "tmail.com", "cmail.net", "emlhub.com", "eml.pp.ua",
}


def _validate_password_strength(v: str) -> str:
    import re
    errors = []
    if len(v) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", v):
        errors.append("one uppercase letter")
    if not re.search(r"[a-z]", v):
        errors.append("one lowercase letter")
    if not re.search(r"[0-9]", v):
        errors.append("one number")
    if not re.search(r"[^A-Za-z0-9]", v):
        errors.append("one special character")
    if errors:
        raise ValueError(f"Password must contain: {', '.join(errors)}.")
    return v


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def reject_disposable_email(cls, v: str) -> str:
        domain = v.split("@")[-1].lower()
        if domain in _DISPOSABLE_DOMAINS:
            raise ValueError("Disposable email addresses are not allowed.")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class DeleteAccountRequest(BaseModel):
    # OAuth-only accounts (no password) confirm by retyping their email instead.
    current_password: str | None = None


class UpdateUsernameRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    created_at: datetime
    has_github: bool = False
    has_password: bool = False

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr
