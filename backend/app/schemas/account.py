from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Must match the frontend list (frontend/src/lib/accountTypes.ts).
AccountType = Literal["checking", "savings", "credit_card", "cash"]


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    type: AccountType


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    type: AccountType
