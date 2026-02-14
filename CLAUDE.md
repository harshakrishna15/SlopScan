# ShelfScan - Project Context

## What This Is

ShelfScan is a hackathon project (SF Hacks 2026). User takes a photo of a food product → Gemini Vision identifies it → matches against OpenFoodFacts products stored in Actian VectorDB → shows nutrition, eco-score, and greener alternatives.

## Architecture

```
Photo → Gemini Vision API → product name guesses
     → sentence-transformers embed guesses → Actian VectorDB nearest-neighbor search
     → return matched product + metadata
     → Gemini generates plain-language nutrition/eco explanation
```

## Key Tech Decisions

- **Gemini 2.0 Flash** for vision (product identification) and text (explanations). Requires API key in `backend/.env`.
- **sentence-transformers (all-MiniLM-L6-v2)** for embeddings. Runs locally, no API needed. 384-dim vectors.
- **Actian VectorDB** via Docker on `localhost:50051`. Uses `cortex` Python client (gRPC). SDK wheel is in `actian-vectordb/`. No built-in vectorization — it's a pure vector store.
- **OpenFoodFacts** dataset from HuggingFace (`openfoodfacts/product-database`, `split="food"`). Streamed, capped at 10k rows scanned, top 2000 kept by completeness score.
- **React + Vite + Tailwind** frontend with `react-webcam` for camera capture. Proxies `/api` to backend port 8000.

## Backend Layout (backend/)

- `main.py` — FastAPI app, CORS for localhost:5173, Actian connection on startup
- `config.py` — env vars, model names, embedding dim (384), confidence threshold
- `services/gemini.py` — Vision identification + product explanation (sync calls wrapped in run_in_executor for async compat)
- `services/embeddings.py` — Local sentence-transformers model (singleton). `embed_text()` and `embed_texts_batch()`
- `services/actian.py` — Actian VectorDB wrapper. `search_similar()`, `search_greener_alternatives()` (filtered by ecoscore), `get_product()`, `get_product_with_vector()`
- `routers/identify.py` — POST /api/identify (photo → candidates)
- `routers/product.py` — GET /api/product/{code}
- `routers/recommend.py` — GET /api/recommend/{code} (greener alternatives)
- `routers/explain.py` — GET /api/explain/{code} (AI analysis)
- `scripts/setup.py` — One-command data pipeline: build catalog → embed → wipe & ingest into VectorDB

## Frontend Layout (frontend/src/)

- `pages/CameraPage.tsx` — Camera/upload, stores captured image in sessionStorage
- `pages/ResultsPage.tsx` — Calls /api/identify, auto-navigates on confident match or shows candidate list
- `pages/ProductDetailPage.tsx` — Nutrition table, eco-score badge, Gemini AI explanation
- `pages/AlternativesPage.tsx` — Greener alternatives from /api/recommend
- `components/` — EcoScoreBadge, NutritionTable, ProductCard, CameraCapture, LoadingSpinner
- `lib/api.ts` — Fetch wrappers for all backend endpoints

## Data Pipeline Quirks

- OpenFoodFacts HuggingFace dataset returns fields as lists of `{'lang': 'main', 'text': '...'}` dicts. The `_to_str()` helper in `build_catalog.py` extracts the text and strips HTML tags.
- Only `product_name` is required to keep a product. Categories and nutriments are optional.
- Only the clean product name is embedded (not brands/categories).

## Running

```bash
# VectorDB
cd actian-vectordb && docker compose up -d

# Backend (in venv)
cd backend && source venv/bin/activate
python scripts/setup.py          # one-time data pipeline
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

## Common Issues

- **502 on /api/identify**: Check Gemini API key quota. The error traceback prints to the backend terminal.
- **Gemini returns unparseable response**: The parser tries to extract JSON arrays/objects from the response. Falls back to empty list instead of crashing.
- **google-generativeai is sync-only**: All Gemini calls use `run_in_executor` to avoid blocking the async event loop.
- **Actian connection refused**: Make sure Docker container is running (`docker compose up -d` in actian-vectordb/).
