"""
Generate embeddings for all products in catalog.json using sentence-transformers (local).
Uses multi-process pool for parallel encoding.
Saves embeddings to data/embeddings.npy and index mapping to data/embedding_index.json.
"""

import json
import os
import sys
import time

import numpy as np
from sentence_transformers import SentenceTransformer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import EMBEDDING_MODEL_NAME

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CATALOG_PATH = os.path.join(DATA_DIR, "catalog.json")
EMBEDDINGS_PATH = os.path.join(DATA_DIR, "embeddings.npy")
INDEX_PATH = os.path.join(DATA_DIR, "embedding_index.json")


def build_embed_text(product: dict) -> str:
    return product.get("product_name", "")


def main():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)

    print(f"Loaded {len(products)} products from catalog")
    print(f"Using model: {EMBEDDING_MODEL_NAME}")

    texts = [build_embed_text(p) for p in products]
    codes = [p["code"] for p in products]

    model = SentenceTransformer(EMBEDDING_MODEL_NAME)

    start = time.time()
    print(f"Encoding {len(texts)} texts...")

    # sentence-transformers handles batching and parallelism internally
    # Use a large batch size for throughput; the library handles GPU/CPU threading
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        batch_size=512,
        show_progress_bar=True,
    )

    elapsed = time.time() - start
    print(f"Encoded {len(texts)} texts in {elapsed:.1f}s ({len(texts)/elapsed:.0f} texts/sec)")

    embeddings_array = np.array(embeddings, dtype=np.float32)
    print(f"Embeddings shape: {embeddings_array.shape}")

    np.save(EMBEDDINGS_PATH, embeddings_array)
    print(f"Saved embeddings to {EMBEDDINGS_PATH}")

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(codes, f)
    print(f"Saved index mapping to {INDEX_PATH}")


if __name__ == "__main__":
    main()
