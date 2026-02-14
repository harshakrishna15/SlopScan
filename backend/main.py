from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ACTIAN_ADDRESS
from services.actian import actian_client
from routers import identify, product, recommend, explain


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to Actian VectorDB
    try:
        actian_client.connect()
        actian_client.ensure_collection()
        initial_count = actian_client.count()
        print(f"Actian products count: {initial_count}")
        if initial_count == 0 and actian_client.seed_dummy_products_if_empty():
            print("Seeded Actian with dummy products for local testing.")
        print(f"Actian products count (active): {actian_client.count()}")
        print(f"Connected to Actian VectorDB at {ACTIAN_ADDRESS}")
    except Exception as e:
        print(f"Warning: Could not connect to Actian VectorDB: {e}")
    yield
    # Shutdown: close connection
    try:
        actian_client.close()
    except Exception:
        pass


app = FastAPI(title="ShelfScan API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(identify.router, prefix="/api")
app.include_router(product.router, prefix="/api")
app.include_router(recommend.router, prefix="/api")
app.include_router(explain.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
