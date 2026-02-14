"""
Bulk-insert catalog products and embeddings into Actian VectorDB.
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cortex import CortexClient, DistanceMetric
from config import ACTIAN_ADDRESS, EMBEDDING_DIM
from sentence_transformers import SentenceTransformer
from config import EMBEDDING_MODEL_NAME

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CATALOG_PATH = os.path.join(DATA_DIR, "catalog.json")
EMBEDDINGS_PATH = os.path.join(DATA_DIR, "embeddings.npy")
INDEX_PATH = os.path.join(DATA_DIR, "embedding_index.json")

BATCH_SIZE = 100


def main():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)

    embeddings = np.load(EMBEDDINGS_PATH)

    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        codes = json.load(f)

    assert len(products) == len(embeddings) == len(codes), (
        f"Mismatch: {len(products)} products, {len(embeddings)} embeddings, {len(codes)} codes"
    )

    print(f"Connecting to Actian VectorDB at {ACTIAN_ADDRESS}...")
    with CortexClient(ACTIAN_ADDRESS) as client:
        version, uptime = client.health_check()
        print(f"Connected: {version}, uptime={uptime}s")

        # Recreate collection
        print(f"Creating collection 'products' (dim={EMBEDDING_DIM}, COSINE)...")
        client.recreate_collection(
            name="products",
            dimension=EMBEDDING_DIM,
            distance_metric=DistanceMetric.COSINE,
        )

        # Batch insert
        total = len(products)
        for start in range(0, total, BATCH_SIZE):
            end = min(start + BATCH_SIZE, total)
            batch_products = products[start:end]
            batch_ids = list(range(start, end))
            batch_vectors = [embeddings[i].tolist() for i in range(start, end)]
            batch_payloads = []

            for p in batch_products:
                payload = {
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
                }
                batch_payloads.append(payload)

            client.batch_upsert("products", ids=batch_ids, vectors=batch_vectors, payloads=batch_payloads)
            print(f"  Inserted {end}/{total}")

        count = client.count("products")
        print(f"\nTotal vectors in collection: {count}")

        # Test query using local model
        print("\nTest query: embedding 'Nutella hazelnut spread'...")
        model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        test_emb = model.encode("Nutella hazelnut spread", normalize_embeddings=True).tolist()

        results = client.search("products", query=test_emb, top_k=5, with_payload=True)
        print("Top 5 matches:")
        for r in results:
            print(f"  Score={r.score:.4f} | {r.payload.get('product_name')} ({r.payload.get('brands')})")


if __name__ == "__main__":
    main()
