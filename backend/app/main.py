from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .routers import auth, expenses

app = FastAPI(title="Expense Tracker API")
app.include_router(auth.router)
app.include_router(expenses.router)


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
