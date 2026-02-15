# SlopScan

Scan a food product photo to see its nutrition, eco-score, and greener alternatives. Built with React, FastAPI, Gemini Vision, and Actian VectorDB.

## What is This?

SlopScan is a web app that helps you make smarter food choices. Point your camera at any food product, and it will:

1. **Identify the product** using Gemini Vision AI
2. **Look it up** in a database of thousands of real products from OpenFoodFacts
3. **Show you what's inside** — nutrition facts, Nutri-Score, and Eco-Score in plain language
4. **Suggest greener alternatives** with better environmental ratings

### How it Works

```
You snap a photo
  → Gemini Vision identifies the product
  → Product name gets embedded into a vector
  → Actian VectorDB finds the closest match in our database
  → You see nutrition, eco-score, and AI-generated explanations
  → One tap to find greener alternatives
```

The backend pairs Gemini 2.5 Flash (for vision and natural-language explanations) with a local sentence-transformers model (for vector embeddings) and Actian VectorDB (for fast similarity search). The product database is sourced from OpenFoodFacts via HuggingFace — ~2,000 products ranked by data completeness.

No accounts, no tracking. Your scan history stays in your browser's local storage.

Built for **SF Hacks 2026**.

## Prerequisites

- Python 3.10+
- Node.js 18+
- Docker Desktop
- Gemini API key from https://aistudio.google.com/apikey

## Project Structure

```
sfhacks2026/
├── backend/          # FastAPI server
├── frontend/         # React + Vite + Tailwind
├── actian-vectordb/  # Actian VectorDB Docker setup + Python SDK
```

## Setup

### 1. Start Actian VectorDB

```bash
cd actian-vectordb
docker compose up -d
```

Runs on `localhost:50051`.

### 2. Set up backend virtual environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install ../actian-vectordb/actiancortex-0.1.0b1-py3-none-any.whl
```

### 3. Configure environment

Edit `backend/.env` and set your Gemini API key:

```
GEMINI_API_KEY=your-key-here
```

### 4. Run the data pipeline

This downloads product data from OpenFoodFacts, generates embeddings locally, and loads everything into VectorDB. One command does it all:

```bash
cd backend
source venv/bin/activate
python scripts/setup.py
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

## Running

Start both the backend and frontend:

```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open http://localhost:5173

## API Endpoints

| Method | Endpoint                | Description                          |
| ------ | ----------------------- | ------------------------------------ |
| POST   | `/api/identify`         | Upload a photo to identify a product |
| GET    | `/api/product/{code}`   | Get full product details             |
| GET    | `/api/recommend/{code}` | Get greener alternatives             |
| GET    | `/api/explain/{code}`   | Get AI nutrition/eco analysis        |
| GET    | `/api/health`           | Health check                         |

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, react-webcam
- **Backend**: Python FastAPI
- **Product ID**: Gemini 2.5 Flash (Vision)
- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2, local)
- **Vector DB**: Actian VectorDB
- **Data**: OpenFoodFacts (via HuggingFace)
