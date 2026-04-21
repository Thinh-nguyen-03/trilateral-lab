import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .session_store import SessionStore
from .routes import adversarial, crlb, failure_clusters, results, session, static_data

store = SessionStore(ttl_minutes=30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(store.cleanup_loop())
    yield
    task.cancel()


app = FastAPI(title="Trilateration Lab API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(results.router, prefix="/api")
app.include_router(session.router, prefix="/api")
app.include_router(static_data.router, prefix="/api")
app.include_router(adversarial.router, prefix="/api")
app.include_router(crlb.router, prefix="/api")
app.include_router(failure_clusters.router, prefix="/api")

_dist = Path(__file__).parent.parent / "web" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
