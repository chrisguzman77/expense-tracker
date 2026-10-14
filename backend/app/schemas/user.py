from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..auth import BCRYPT_MAX_BYTES


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def fits_bcrypt(cls, value: str) -> str:
        # The limit is bytes: emoji and accented letters take more than one each.
        if len(value.encode()) > BCRYPT_MAX_BYTES:
            raise ValueError(
                "Password is too long: 72 bytes max "
                "(emoji and accented letters count as more than one)"
            )
        return value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False
