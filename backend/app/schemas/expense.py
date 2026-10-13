from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: CategoryColor = "slate"
    # Any short text; not checked to be an emoji (that needs a Unicode library).
    # 16 code points leaves room for multi-part emoji such as 👨‍👩‍👧.
    icon: str = Field(default="🏷️", min_length=1, max_length=16)


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: CategoryColor
    icon: str


class ExpenseCreate(BaseModel):
    category_id: int
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    spent_on: date
    note: str | None = Field(default=None, max_length=255)

    @field_validator("spent_on")
    @classmethod
    def not_in_future(cls, v: date) -> date:
        if v > datetime.now(UTC).date() + timedelta(days=1):
            raise ValueError("spent_on cannot be in the fiuture")
        return v


class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: Decimal
    spent_on: date
    note: str | None
    category: CategoryRead


class CategorySummary(BaseModel):
    category_id: int
    name: str
    color: CategoryColor
    icon: str
    total: Decimal
