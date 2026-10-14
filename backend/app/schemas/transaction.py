from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .account import AccountRead

# Must match the frontend palette (frontend/src/lib/palette.ts). Validated here
# only, not with a database CHECK, so adding a color is a code change.
CategoryColor = Literal[
    "amber",
    "emerald",
    "sky",
    "violet",
    "rose",
    "orange",
    "teal",
    "indigo",
    "lime",
    "slate",
]

# Only spending categories count toward spending; income and transfer are
# kept out of it (record 21).
CategoryKind = Literal["spending", "income", "transfer"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: CategoryColor = "slate"
    # Any short text; not checked to be an emoji (that needs a Unicode library).
    # 16 code points leaves room for multi-part emoji such as 👨‍👩‍👧.
    icon: str = Field(default="🏷️", min_length=1, max_length=16)
    kind: CategoryKind = "spending"


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: CategoryColor
    icon: str
    kind: CategoryKind


class TransactionCreate(BaseModel):
    account_id: int
    category_id: int
    # Signed: negative is money out, positive is money in.
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    occurred_on: date
    note: str | None = Field(default=None, max_length=255)

    @field_validator("amount")
    @classmethod
    def not_zero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("amount cannot be zero")
        return v

    @field_validator("occurred_on")
    @classmethod
    def not_in_future(cls, v: date) -> date:
        if v > datetime.now(UTC).date() + timedelta(days=1):
            raise ValueError("occurred_on cannot be in the future")
        return v


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: Decimal
    occurred_on: date
    note: str | None
    category: CategoryRead
    account: AccountRead


class CategorySummary(BaseModel):
    category_id: int
    name: str
    color: CategoryColor
    icon: str
    total: Decimal
