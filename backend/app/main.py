import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from .routes import router as api_router  # noqa: E402
from .ws import router as ws_router  # noqa: E402
from . import database as db  # noqa: E402
from .backup_service import run_backup_scheduler  # noqa: E402
import asyncio

app = FastAPI(title="Mikrotik Monitoring Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


@app.on_event("startup")
async def startup():
    db.init_db()
    asyncio.create_task(run_backup_scheduler())


@app.get("/")
def root():
    return {"status": "ok", "service": "mikrotik-dashboard"}
