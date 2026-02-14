"""
Download and filter OpenFoodFacts products from HuggingFace dataset.
Saves a filtered catalog of ~2000 products to backend/data/catalog.json.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datasets import load_dataset


OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "catalog.json")
TARGET_COUNT = 100_000
MAX_SCAN = int(TARGET_COUNT * 1.5)


def _to_str(val) -> str:
    """Convert a value to a clean string. Handles the OpenFoodFacts format
    where fields can be a list of {'lang': ..., 'text': ...} dicts."""
    if val is None:
        return ""
    if isinstance(val, list):
        # Try to extract 'text' from lang dicts (prefer 'main' or 'en')
        if val and isinstance(val[0], dict) and "text" in val[0]:
            for item in val:
                if item.get("lang") == "main":
                    return _clean_text(item["text"])
            for item in val:
                if item.get("lang") == "en":
                    return _clean_text(item["text"])
            return _clean_text(val[0]["text"])
        return ", ".join(str(v) for v in val if v)
    if isinstance(val, dict) and "text" in val:
        return _clean_text(val["text"])
    return _clean_text(str(val))


def _clean_text(text: str) -> str:
    """Strip HTML tags and clean up text."""
    import re
    text = re.sub(r'<[^>]+>', '', text)  # remove HTML like <span class="allergen">
    return text.strip()


def extract_product(row: dict) -> dict | None:
    product_name = _to_str(row.get("product_name"))
    categories = _to_str(row.get("categories"))
    nutriments = row.get("nutriments") or {}

    if not product_name.strip():
        return None

    # Parse nutriments if it's a string
    if isinstance(nutriments, str):
        try:
            nutriments = json.loads(nutriments)
        except (json.JSONDecodeError, TypeError):
            nutriments = {}

    if not isinstance(nutriments, dict):
        nutriments = {}

    code = str(row.get("code", "")).strip()
    if not code:
        return None

    ecoscore_grade = row.get("ecoscore_grade") or None
    ecoscore_score = row.get("ecoscore_score")
    if ecoscore_score is not None:
        try:
            ecoscore_score = int(float(ecoscore_score))
        except (ValueError, TypeError):
            ecoscore_score = None

    # Normalize ecoscore_grade
    if ecoscore_grade and ecoscore_grade.lower() not in ("a", "b", "c", "d", "e"):
        ecoscore_grade = None
    elif ecoscore_grade:
        ecoscore_grade = ecoscore_grade.lower()

    categories_tags = row.get("categories_tags") or []
    if isinstance(categories_tags, str):
        categories_tags = [t.strip() for t in categories_tags.split(",") if t.strip()]

    packaging_tags = row.get("packaging_tags") or []
    if isinstance(packaging_tags, str):
        packaging_tags = [t.strip() for t in packaging_tags.split(",") if t.strip()]

    labels_tags = row.get("labels_tags") or []
    if isinstance(labels_tags, str):
        labels_tags = [t.strip() for t in labels_tags.split(",") if t.strip()]

    palm_oil_count = row.get("ingredients_from_palm_oil_n")
    try:
        palm_oil_count = int(palm_oil_count) if palm_oil_count is not None else 0
    except (ValueError, TypeError):
        palm_oil_count = 0

    nutrition = {
        "energy-kcal_100g": _safe_float(nutriments.get("energy-kcal_100g")),
        "sugars_100g": _safe_float(nutriments.get("sugars_100g")),
        "fat_100g": _safe_float(nutriments.get("fat_100g")),
        "saturated-fat_100g": _safe_float(nutriments.get("saturated-fat_100g")),
        "proteins_100g": _safe_float(nutriments.get("proteins_100g")),
        "salt_100g": _safe_float(nutriments.get("salt_100g")),
    }

    return {
        "code": code,
        "product_name": product_name.strip(),
        "brands": _to_str(row.get("brands")).strip(),
        "categories": categories.strip(),
        "categories_tags": categories_tags,
        "ecoscore_grade": ecoscore_grade,
        "ecoscore_score": ecoscore_score,
        "packaging_tags": packaging_tags,
        "labels_tags": labels_tags,
        "ingredients_text": _to_str(row.get("ingredients_text")).strip(),
        "ingredients_from_palm_oil_n": palm_oil_count,
        "nutriments": nutrition,
        "image_front_url": row.get("image_front_url") or row.get("image_url") or None,
    }


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return None


def compute_completeness(product: dict) -> int:
    score = 0
    if product["ecoscore_grade"]:
        score += 10
    if product["image_front_url"]:
        score += 3
    if product["ingredients_text"]:
        score += 2
    if product["brands"]:
        score += 1
    n = product["nutriments"]
    score += sum(1 for v in n.values() if v is not None)
    return score


def main():
    print("Loading OpenFoodFacts dataset from HuggingFace...")
    print("(This may take a while on first run as it downloads the data)")

    # Load a subset — the full dataset is huge, so we stream and take what we need
    ds = load_dataset(
        "openfoodfacts/product-database",
        split="food",
        streaming=True,
    )

    products = []
    seen_codes = set()
    scanned = 0

    print("Scanning products...")
    for row in ds:
        scanned += 1
        if scanned % 10000 == 0:
            print(f"  Scanned {scanned} rows, kept {len(products)} so far...")

        product = extract_product(row)
        if product is None:
            continue

        if product["code"] in seen_codes:
            continue
        seen_codes.add(product["code"])

        products.append(product)

        # Stop after scanning MAX_SCAN rows from the dataset
        if scanned >= MAX_SCAN:
            break

    print(f"\nScanned {scanned} rows total, extracted {len(products)} valid products")

    # Sort by completeness (eco-score presence prioritized)
    products.sort(key=compute_completeness, reverse=True)
    products = products[:TARGET_COUNT]

    # Save
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    # Stats
    with_ecoscore = sum(1 for p in products if p["ecoscore_grade"])
    with_image = sum(1 for p in products if p["image_front_url"])
    categories = {}
    for p in products:
        for tag in p["categories_tags"][:1]:
            categories[tag] = categories.get(tag, 0) + 1

    print(f"\nSaved {len(products)} products to {OUTPUT_PATH}")
    print(f"  With eco-score: {with_ecoscore}")
    print(f"  With image: {with_image}")
    top_cats = sorted(categories.items(), key=lambda x: -x[1])[:10]
    print(f"  Top categories: {top_cats}")


if __name__ == "__main__":
    main()
