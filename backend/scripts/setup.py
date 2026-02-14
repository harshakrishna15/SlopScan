"""
One-command data pipeline: build catalog → generate embeddings → ingest into Actian VectorDB.
Wipes and recreates the VectorDB collection from scratch.

Usage:
    python scripts/setup.py
"""

import json
import os
import sys
import time

import numpy as np
from sentence_transformers import SentenceTransformer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import ACTIAN_ADDRESS, EMBEDDING_DIM, EMBEDDING_MODEL_NAME
from cortex import CortexClient, DistanceMetric

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CATALOG_PATH = os.path.join(DATA_DIR, "catalog.json")

# Import build_catalog functions
from scripts.build_catalog import main as build_catalog


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    # --- Step 1: Build catalog ---
    print("=" * 60)
    print("STEP 1: Building product catalog from OpenFoodFacts")
    print("=" * 60)
    build_catalog()

    # --- Step 2: Generate embeddings ---
    print("\n" + "=" * 60)
    print("STEP 2: Generating embeddings with local model")
    print("=" * 60)

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)

    print(f"Loaded {len(products)} products")
    print(f"Model: {EMBEDDING_MODEL_NAME}")

    texts = [p.get("product_name", "") for p in products]
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)

    start = time.time()
    embeddings = model.encode(texts, normalize_embeddings=True, batch_size=512, show_progress_bar=True)
    elapsed = time.time() - start
    print(f"Encoded {len(texts)} texts in {elapsed:.1f}s ({len(texts)/elapsed:.0f} texts/sec)")

    # --- Step 3: Ingest into Actian VectorDB ---
    print("\n" + "=" * 60)
    print("STEP 3: Ingesting into Actian VectorDB")
    print("=" * 60)

    print(f"Connecting to {ACTIAN_ADDRESS}...")
    with CortexClient(ACTIAN_ADDRESS) as client:
        version, uptime = client.health_check()
        print(f"Connected: {version}")

        # Wipe and recreate
        print(f"Recreating collection 'products' (dim={EMBEDDING_DIM}, COSINE)...")
        client.recreate_collection(
            name="products",
            dimension=EMBEDDING_DIM,
            distance_metric=DistanceMetric.COSINE,
        )

        # Batch insert
        total = len(products)
        BATCH_SIZE = 100
        for start_idx in range(0, total, BATCH_SIZE):
            end_idx = min(start_idx + BATCH_SIZE, total)
            batch_ids = list(range(start_idx, end_idx))
            batch_vectors = [embeddings[i].tolist() for i in range(start_idx, end_idx)]
            batch_payloads = []

            for p in products[start_idx:end_idx]:
                batch_payloads.append({
                    "product_code": p["code"],
                    "product_name": p["product_name"],
                    "brands": p.get("brands", ""),
                    "categories": p.get("categories", ""),
                    "categories_tags": json.dumps(p.get("categories_tags", [])),
                    "ecoscore_grade": p.get("ecoscore_grade"),
                    "ecoscore_score": p.get("ecoscore_score"),
                    "packaging_tags": json.dumps(p.get("packaging_tags", [])),
                    "labels_tags": json.dumps(p.get("labels_tags", [])),
                    "ingredients_text": p.get("ingredients_text", ""),
                    "palm_oil_count": p.get("ingredients_from_palm_oil_n", 0),
                    "nutrition_json": json.dumps(p.get("nutriments", {})),
                    "image_url": p.get("image_front_url"),
                })

            client.batch_upsert("products", ids=batch_ids, vectors=batch_vectors, payloads=batch_payloads)
            if end_idx % 500 == 0 or end_idx == total:
                print(f"  Inserted {end_idx}/{total}")

        count = client.count("products")
        print(f"\nTotal vectors in collection: {count}")

        # Test query
        print("\nTest query: 'Nutella hazelnut spread'")
        test_emb = model.encode("Nutella hazelnut spread", normalize_embeddings=True).tolist()
        results = client.search("products", query=test_emb, top_k=5, with_payload=True)
        for r in results:
            print(f"  {r.score:.4f} | {r.payload.get('product_name')} ({r.payload.get('brands')})")

    print("\n" + "=" * 60)
    print("DONE! Pipeline complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
