from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import IMAGES_DIR
from .migrations import run_migrations
from .routers.places import router as places_router
from .routers.polls import router as polls_router
from .routers.sessions import router as sessions_router
from .routers.system import router as system_router
from .routers.users import router as users_router

run_migrations()
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="LunchTool")
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router)
app.include_router(users_router)
app.include_router(places_router)
app.include_router(sessions_router)
app.include_router(polls_router)
