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
from sentence_transformers import SentenceTransformer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import ACTIAN_ADDRESS, EMBEDDING_DIM, EMBEDDING_MODEL_NAME
from cortex import CortexClient, DistanceMetric

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CATALOG_PATH = os.path.join(DATA_DIR, "catalog.json")

# Balanced profile for Apple Silicon laptops with 16GB RAM.
# Adjust only if you see very low CPU utilization (increase) or memory pressure (decrease).
ENCODE_CHUNK_SIZE = 3000
EMBED_BATCH_SIZE = 96
UPSERT_BATCH_SIZE = 100

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

    model = SentenceTransformer(EMBEDDING_MODEL_NAME)

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

        # Chunked encode + batch insert — avoids holding all embeddings in memory.
        # Lists/dicts are JSON-serialized for storage; the UI selectively reads what it needs.
        total = len(products)
        encode_started = time.time()

        for chunk_start in range(0, total, ENCODE_CHUNK_SIZE):
            chunk_end = min(chunk_start + ENCODE_CHUNK_SIZE, total)
            chunk_products = products[chunk_start:chunk_end]
            chunk_texts = [p.get("product_name", "") for p in chunk_products]
            chunk_vectors = model.encode(
                chunk_texts,
                normalize_embeddings=True,
                batch_size=EMBED_BATCH_SIZE,
                show_progress_bar=False,
            )

            for local_start in range(0, len(chunk_products), UPSERT_BATCH_SIZE):
                local_end = min(local_start + UPSERT_BATCH_SIZE, len(chunk_products))
                global_start = chunk_start + local_start
                global_end = chunk_start + local_end
                batch_ids = list(range(global_start, global_end))
                batch_vectors = [v.tolist() for v in chunk_vectors[local_start:local_end]]
                batch_payloads = []

                # Fields to skip: "ingredients" is a massive nested structure (up to 80KB)
                # that duplicates "ingredients_text" in a less useful form.
                # "images" is per-image metadata blobs. "ecoscore_data" can also be huge.
                # "packagings" is structured packaging data redundant with packaging_tags.
                SKIP_KEYS = {"code", "ingredients", "images", "ecoscore_data", "packagings"}

                for p in chunk_products[local_start:local_end]:
                    payload = {}
                    payload["product_code"] = p["code"]
                    for key, val in p.items():
                        if key in SKIP_KEYS:
                            continue
                        if val is None:
                            continue
                        if isinstance(val, (list, dict)):
                            serialized = json.dumps(val)
                            if len(serialized) > 5_000:
                                continue
                            payload[key] = serialized
                        else:
                            payload[key] = val
                    # Keep legacy aliases the UI expects
                    payload.setdefault(
                        "palm_oil_count", p.get("ingredients_from_palm_oil_n") or 0
                    )
                    payload.setdefault("nutrition_json", json.dumps(p.get("nutriments") or {}))
                    payload.setdefault("image_url", p.get("image_front_url") or "")
                    batch_payloads.append(payload)

                client.batch_upsert(
                    "products", ids=batch_ids, vectors=batch_vectors, payloads=batch_payloads
                )
                if global_end % 500 == 0 or global_end == total:
                    print(f"  Inserted {global_end}/{total}")

            elapsed = time.time() - encode_started
            rate = chunk_end / elapsed if elapsed > 0 else 0
            print(
                f"  Encoded chunk {chunk_end}/{total} "
                f"({rate:.0f} products/sec overall)"
            )

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
