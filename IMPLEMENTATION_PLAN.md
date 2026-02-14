# ShelfScan — MVP Implementation Plan

> Execute each step in order. Each step specifies exactly what to create, which files to modify, and what commands to run.

---

## Project Summary

**ShelfScan**: User takes a photo of a food product → Gemini Vision identifies it → matches against OpenFoodFacts products stored in Actian VectorDB → shows nutrition, eco-score, and greener alternatives.

## Decisions (Locked In)

- **Frontend**: React (Vite) + Tailwind CSS + shadcn/ui
- **Backend**: Python FastAPI
- **Product identification**: Gemini 3.0 Flash (Vision) — send photo, get product name guesses
- **Embeddings**: Gemini `text-embedding-004` (768-dim) on product name strings
- **Vector DB**: Actian VectorDB — stores product name embeddings + metadata
- **Product data source**: OpenFoodFacts HuggingFace dataset (`openfoodfacts/product-database`)
- **OCR**: Not needed — Gemini Vision handles text extraction implicitly
- **ExecuTorch**: Post-MVP (not in this plan)

## Data Flow

```
User photo
    │
    ▼
Gemini Vision API (gemini-3.0-flash)
    │  "This looks like: Nutella, Nutella & Go, Generic hazelnut spread"
    ▼
Gemini text-embedding-004
    │  embed each candidate name → 768-dim vectors
    ▼
Actian VectorDB: nearest-neighbor search
    │  match against pre-embedded OpenFoodFacts product names
    │  return top matches with metadata
    ▼
Best match + candidates returned to frontend
    │
    ├──▶ Product Detail screen (nutrition, eco-score, ingredients)
    │       │
    │       ▼
    │    Gemini API: plain-language explanation of nutrition + eco data
    │
    └──▶ "Greener Alternatives" screen
            │
            ▼
         Actian VectorDB: vector search filtered by better eco-score
```

---

## Directory Structure (Target)

```
sfhacks2026/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env                     # GEMINI_API_KEY, ACTIAN_* creds
│   ├── config.py                # load env vars, constants
│   ├── routers/
│   │   ├── identify.py          # POST /api/identify
│   │   ├── product.py           # GET  /api/product/{code}
│   │   ├── recommend.py         # GET  /api/recommend/{code}
│   │   └── explain.py           # GET  /api/explain/{code}
│   ├── services/
│   │   ├── gemini.py            # Gemini Vision + text-embedding + explanation
│   │   ├── actian.py            # Actian VectorDB client (insert, search, query)
│   │   └── openfoodfacts.py     # OFF API fallback lookups
│   └── scripts/
│       ├── build_catalog.py     # Download + filter OFF dataset from HuggingFace
│       ├── generate_embeddings.py  # Embed product names via Gemini
│       └── ingest_actian.py     # Bulk-insert catalog + embeddings into Actian
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── CameraPage.tsx       # Photo capture / upload
│   │   │   ├── ResultsPage.tsx      # Match results + candidate list
│   │   │   ├── ProductDetailPage.tsx # Nutrition, eco-score, Gemini explanation
│   │   │   └── AlternativesPage.tsx  # Greener alternatives list
│   │   ├── components/
│   │   │   ├── CameraCapture.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── NutritionTable.tsx
│   │   │   ├── EcoScoreBadge.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── lib/
│   │   │   └── api.ts               # Fetch wrappers for backend endpoints
│   │   └── types/
│   │       └── index.ts             # TypeScript interfaces
│   └── index.html
└── IMPLEMENTATION_PLAN.md
```

---

## STEP 1: Backend Project Setup

### 1.1 Create `backend/requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-dotenv==1.0.1
google-generativeai==0.8.0
httpx==0.27.0
python-multipart==0.0.9
Pillow==10.4.0
numpy==1.26.4
```

> Note: Actian VectorDB SDK dependency will be added once we confirm the exact package name from their docs. For now, use `pyactian` or their provided SDK.

### 1.2 Create `backend/.env`

```
GEMINI_API_KEY=<your-key-here>
ACTIAN_HOST=<actian-vectordb-host>
ACTIAN_PORT=<port>
ACTIAN_DATABASE=<db-name>
ACTIAN_USER=<user>
ACTIAN_PASSWORD=<password>
```

### 1.3 Create `backend/config.py`

Load all env vars using `python-dotenv`. Export them as module-level constants. Define:

- `GEMINI_API_KEY`
- `GEMINI_MODEL = "gemini-3.0-flash"`
- `GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"`
- `EMBEDDING_DIM = 768`
- `CONFIDENCE_THRESHOLD = 0.75`
- All `ACTIAN_*` connection params

### 1.4 Create `backend/main.py`

FastAPI app with:

- CORS middleware allowing `http://localhost:5173` (Vite dev server)
- Include routers: `identify`, `product`, `recommend`, `explain` under `/api` prefix
- Health check endpoint: `GET /api/health`
- Lifespan handler that initializes Actian DB connection on startup

### 1.5 Run command to verify

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
```

Verify `http://localhost:8000/api/health` returns `{"status": "ok"}`.

---

## STEP 2: Data Pipeline — Build Product Catalog

### 2.1 Create `backend/scripts/build_catalog.py`

This script:

1. Downloads the OpenFoodFacts product database from HuggingFace: `openfoodfacts/product-database`
   - Use the `datasets` library: `from datasets import load_dataset`
   - Or download the parquet files directly
2. Filters to products that have ALL of:
   - `product_name` is not empty
   - `categories` is not empty
   - `nutriments` is not empty
   - `countries_tags` contains `en:united-states` or `en:france` (scope to known markets)
3. Keeps the top ~2000 products (prioritize those with `ecoscore_grade` present, then by completeness)
4. For each product, extract and save:
   ```python
   {
       "code": str,                    # barcode
       "product_name": str,
       "brands": str,
       "categories": str,
       "categories_tags": list[str],
       "ecoscore_grade": str or None,  # a/b/c/d/e
       "ecoscore_score": int or None,  # 0-100
       "packaging_tags": list[str],
       "labels_tags": list[str],
       "ingredients_text": str,
       "ingredients_from_palm_oil_n": int,
       "nutriments": {
           "energy-kcal_100g": float,
           "sugars_100g": float,
           "fat_100g": float,
           "saturated-fat_100g": float,
           "proteins_100g": float,
           "salt_100g": float
       },
       "image_front_url": str or None
   }
   ```
5. Saves to `backend/data/catalog.json`

### 2.2 Run the script

```bash
cd backend && python scripts/build_catalog.py
```

Verify `backend/data/catalog.json` exists and has ~2000 entries. Print summary stats: how many have eco-score, how many have images, category distribution.

---

## STEP 3: Generate Embeddings & Ingest into Actian VectorDB

### 3.1 Create `backend/scripts/generate_embeddings.py`

This script:

1. Loads `backend/data/catalog.json`
2. For each product, creates an embedding input string:
   ```python
   embed_text = f"{product['product_name']} {product['brands']} {product['categories']}"
   ```
3. Calls Gemini `text-embedding-004` API in batches (the API supports batch embedding):
   ```python
   import google.generativeai as genai
   genai.configure(api_key=GEMINI_API_KEY)
   result = genai.embed_content(
       model="models/text-embedding-004",
       content=batch_of_texts,
       task_type="RETRIEVAL_DOCUMENT"
   )
   ```
4. Saves embeddings to `backend/data/embeddings.npy` (shape: N × 768)
5. Saves index mapping to `backend/data/embedding_index.json` (list of product codes in same order)

### 3.2 Create `backend/scripts/ingest_actian.py`

This script:

1. Connects to Actian VectorDB
2. Creates the products table:
   ```sql
   CREATE TABLE IF NOT EXISTS products (
       product_code    VARCHAR(64) PRIMARY KEY,
       product_name    VARCHAR(512),
       brands          VARCHAR(256),
       categories      TEXT,
       categories_tags TEXT,
       ecoscore_grade  VARCHAR(2),
       ecoscore_score  INTEGER,
       packaging_tags  TEXT,
       labels_tags     TEXT,
       ingredients_text TEXT,
       palm_oil_count  INTEGER DEFAULT 0,
       nutrition_json  TEXT,
       image_url       VARCHAR(1024),
       embedding       VECTOR(768)
   );
   ```
3. Loads `catalog.json` and `embeddings.npy`
4. Batch-inserts all rows
5. Creates vector index for cosine similarity search
6. Runs a test query: embed "Nutella hazelnut spread" → find top 5 nearest → print results

### 3.3 Run both scripts in sequence

```bash
cd backend && python scripts/generate_embeddings.py
cd backend && python scripts/ingest_actian.py
```

---

## STEP 4: Actian VectorDB Service

### 4.1 Create `backend/services/actian.py`

Implement a class `ActianClient` with these methods:

```python
class ActianClient:
    def __init__(self, host, port, database, user, password):
        # establish connection

    def search_similar(self, embedding: list[float], top_k: int = 5) -> list[dict]:
        # vector nearest-neighbor search
        # returns list of {product_code, product_name, brands, ecoscore_grade, similarity_score, ...}

    def search_greener_alternatives(self, embedding: list[float], category: str, min_ecoscore: str = "b", top_k: int = 5) -> list[dict]:
        # vector search filtered by: ecoscore_grade IN ('a', 'b') AND categories LIKE '%{category}%'
        # ordered by similarity

    def get_product(self, product_code: str) -> dict | None:
        # fetch full product row by code

    def close(self):
        # close connection
```

---

## STEP 5: Gemini Service

### 5.1 Create `backend/services/gemini.py`

Implement these functions:

```python
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_EMBEDDING_MODEL

genai.configure(api_key=GEMINI_API_KEY)

async def identify_product(image_bytes: bytes) -> list[str]:
    """
    Send product photo to Gemini Vision.
    Returns a list of 3-5 candidate product name guesses.

    Prompt:
    "You are a food product identifier. Look at this photo of a food product package.
    Return ONLY a JSON array of 3-5 possible product names, from most to least likely.
    Include the brand name. Example: ["Nutella Hazelnut Spread", "Nutella & Go", "Generic Hazelnut Spread"]
    Return ONLY the JSON array, no other text."
    """

async def embed_text(text: str) -> list[float]:
    """
    Embed a single text string using text-embedding-004.
    task_type="RETRIEVAL_QUERY" for query-time embeddings.
    Returns 768-dim vector.
    """

async def embed_texts_batch(texts: list[str]) -> list[list[float]]:
    """
    Batch embed multiple texts.
    task_type="RETRIEVAL_QUERY"
    """

async def explain_product(product_data: dict) -> dict:
    """
    Given full product data, ask Gemini to generate a user-friendly explanation.

    Prompt:
    "You are a nutrition and sustainability advisor. Given this product data,
    provide a JSON response with these fields:
    {
      "nutrition_summary": "2-3 sentences about the nutrition profile",
      "eco_explanation": "what the eco-score means, or 'Not available' if missing",
      "ingredient_flags": ["list of concerns: palm oil, additives, allergens"],
      "advice": "1-2 sentences of practical advice"
    }

    Product: {product_name} by {brands}
    Category: {categories}
    Nutrition per 100g: energy={energy}kcal, sugars={sugars}g, fat={fat}g, sat_fat={sat_fat}g, protein={protein}g, salt={salt}g
    Eco-Score: {ecoscore_grade} ({ecoscore_score}/100) — or 'not available'
    Packaging: {packaging_tags}
    Labels: {labels_tags}
    Palm oil ingredients count: {palm_oil_count}
    Ingredients: {ingredients_text}

    Return ONLY valid JSON."

    Parse the JSON response and return as dict.
    If parsing fails, return a fallback dict with template strings.
    """
```

---

## STEP 6: API Routers

### 6.1 Create `backend/routers/identify.py`

```
POST /api/identify
```

- **Input**: multipart form with `image` file field
- **Logic**:
  1. Read image bytes from upload
  2. Call `gemini.identify_product(image_bytes)` → get list of candidate names
  3. Call `gemini.embed_texts_batch(candidate_names)` → get embeddings for each guess
  4. For each candidate embedding, call `actian.search_similar(embedding, top_k=3)`
  5. Flatten all Actian results, deduplicate by product_code
  6. Rank by cosine similarity score (highest first)
  7. Return:
     ```json
     {
       "gemini_guesses": ["Nutella Hazelnut Spread", ...],
       "best_match": {"product_code": "...", "product_name": "...", "brands": "...", "confidence": 0.92, "ecoscore_grade": "c"},
       "candidates": [... top 5 ...],
       "needs_confirmation": false
     }
     ```
  8. Set `needs_confirmation = true` if best match confidence < `CONFIDENCE_THRESHOLD`

### 6.2 Create `backend/routers/product.py`

```
GET /api/product/{product_code}
```

- Call `actian.get_product(product_code)`
- Return full product data as JSON
- 404 if not found

### 6.3 Create `backend/routers/recommend.py`

```
GET /api/recommend/{product_code}
```

- Fetch product from Actian → get its embedding and category
- Call `actian.search_greener_alternatives(embedding, category)`
- Return list of alternatives

### 6.4 Create `backend/routers/explain.py`

```
GET /api/explain/{product_code}
```

- Fetch product from Actian
- Call `gemini.explain_product(product_data)`
- Return the explanation JSON

---

## STEP 7: Frontend Setup

### 7.1 Scaffold React + Vite + Tailwind

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom react-webcam lucide-react
```

Set up Tailwind via the Vite plugin in `vite.config.ts`.
Add `@import "tailwindcss";` to `src/index.css`.

Add proxy to backend in `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

### 7.2 Create `frontend/src/types/index.ts`

```typescript
export interface Product {
  product_code: string;
  product_name: string;
  brands: string;
  categories: string;
  ecoscore_grade: string | null;
  ecoscore_score: number | null;
  packaging_tags: string;
  labels_tags: string;
  ingredients_text: string;
  palm_oil_count: number;
  nutrition: {
    energy_kcal: number | null;
    sugars: number | null;
    fat: number | null;
    saturated_fat: number | null;
    protein: number | null;
    salt: number | null;
  };
  image_url: string | null;
}

export interface IdentifyResponse {
  gemini_guesses: string[];
  best_match: {
    product_code: string;
    product_name: string;
    brands: string;
    confidence: number;
    ecoscore_grade: string | null;
  };
  candidates: Array<{
    product_code: string;
    product_name: string;
    brands: string;
    confidence: number;
    ecoscore_grade: string | null;
  }>;
  needs_confirmation: boolean;
}

export interface ExplanationResponse {
  nutrition_summary: string;
  eco_explanation: string;
  ingredient_flags: string[];
  advice: string;
}
```

### 7.3 Create `frontend/src/lib/api.ts`

```typescript
export async function identifyProduct(imageFile: File): Promise<IdentifyResponse> {
  const formData = new FormData();
  formData.append('image', imageFile);
  const res = await fetch('/api/identify', { method: 'POST', body: formData });
  return res.json();
}

export async function getProduct(code: string): Promise<Product> { ... }
export async function getRecommendations(code: string): Promise<Product[]> { ... }
export async function getExplanation(code: string): Promise<ExplanationResponse> { ... }
```

---

## STEP 8: Frontend Pages

### 8.1 `CameraPage.tsx`

- Full-screen camera viewfinder using `react-webcam` OR a file upload input
- "Take Photo" button captures image
- "Upload Photo" button as alternative
- On capture/upload: navigate to results page, passing the image

### 8.2 `ResultsPage.tsx`

- Shows loading spinner while calling `/api/identify`
- On response:
  - If `needs_confirmation == false`: auto-navigate to `ProductDetailPage` with `best_match.product_code`
  - If `needs_confirmation == true`: show candidate list as cards, user taps one to confirm
  - Show "Retake Photo" button

### 8.3 `ProductDetailPage.tsx`

- Fetch product data from `/api/product/{code}`
- Fetch explanation from `/api/explain/{code}` (can load async)
- Display:
  - Product name, brand, image
  - **Eco-Score badge** (color-coded: A=green, B=light-green, C=yellow, D=orange, E=red)
  - **Nutrition table** (energy, sugars, fat, sat fat, protein, salt)
  - **Gemini explanation** sections (nutrition summary, eco explanation, ingredient flags, advice)
  - **"Find Greener Alternatives"** button → navigates to AlternativesPage

### 8.4 `AlternativesPage.tsx`

- Fetch from `/api/recommend/{code}`
- List of product cards sorted by eco-score
- Each card shows: name, brand, eco-score badge, similarity percentage
- Tap a card → navigate to its ProductDetailPage

### 8.5 `App.tsx` — Router Setup

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<CameraPage />} />
    <Route path="/results" element={<ResultsPage />} />
    <Route path="/product/:code" element={<ProductDetailPage />} />
    <Route path="/alternatives/:code" element={<AlternativesPage />} />
  </Routes>
</BrowserRouter>
```

---

## STEP 9: Integration Testing & Edge Cases

### 9.1 Test with known products

Test the full flow with these products (should be in the catalog):

- Nutella
- Coca-Cola
- Oreos
- Kellogg's Corn Flakes
- Lay's Classic Chips

For each: take a real photo → verify identification → verify nutrition data → verify explanation → verify alternatives.

### 9.2 Edge cases to handle

- **Product not in catalog**: Gemini guesses won't match anything in Actian. Return `needs_confirmation: true` with empty candidates. Frontend shows "Product not found — try another photo."
- **Missing eco-score**: Many products won't have it. UI shows "N/A" gray badge. Gemini explanation says "Eco-score data is not available for this product."
- **Gemini API error/rate limit**: Catch exceptions. For `/identify`, return error. For `/explain`, return a template-based fallback explanation built from raw data.
- **Blurry/bad photo**: Gemini will return low-quality guesses → low similarity scores in Actian → `needs_confirmation: true` → user sees "We're not sure — try a clearer photo."
- **Actian connection failure**: Return 503 with helpful error message.

---

## STEP 10: Demo Polish

- Pre-test 5-10 "hero products" and verify they work end-to-end
- Add a landing page / splash with app name and "Scan a Product" CTA
- Eco-score badge colors: A=#1E8F4E, B=#60AC0E, C=#EEAE0E, D=#FF6F1E, E=#E63E11
- Loading states on every async operation
- Error toasts for failed API calls
- Mobile-responsive layout (demo might be on a phone)

---

## API Quick Reference

| Method | Endpoint                | Input                    | Output                |
| ------ | ----------------------- | ------------------------ | --------------------- |
| POST   | `/api/identify`         | `image` (multipart file) | `IdentifyResponse`    |
| GET    | `/api/product/{code}`   | —                        | `Product`             |
| GET    | `/api/recommend/{code}` | —                        | `Product[]`           |
| GET    | `/api/explain/{code}`   | —                        | `ExplanationResponse` |
| GET    | `/api/health`           | —                        | `{"status": "ok"}`    |

---

## Key Dependencies

**Backend (Python)**:

- `fastapi`, `uvicorn`, `python-multipart` — web framework
- `google-generativeai` — Gemini Vision + embeddings + explanation
- `httpx` — async HTTP client (OFF API fallback)
- `python-dotenv` — env vars
- `Pillow` — image handling
- `numpy` — embedding arrays
- Actian VectorDB SDK — vector storage and search
- `datasets` (HuggingFace) — for downloading OFF dataset

**Frontend (TypeScript)**:

- `react`, `react-dom`, `react-router-dom` — UI framework + routing
- `react-webcam` — camera capture
- `lucide-react` — icons
- `tailwindcss` — styling
