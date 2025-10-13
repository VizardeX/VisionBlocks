from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes import health, datasets
from app.services.datasets import get_datasets_index

app = FastAPI(title=settings.API_TITLE, version=settings.API_VERSION)

# CORS (allow local web app on 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(datasets.router)

@app.on_event("startup")
def _warmup():
    # Build dataset index in memory for fast access
    get_datasets_index(force_refresh=True)
