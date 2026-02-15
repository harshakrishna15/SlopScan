"""
Download and filter OpenFoodFacts products from HuggingFace dataset.
Saves a filtered catalog of products to backend/data/catalog.json.
Stores ALL fields from the dataset — the UI selectively displays what it needs.
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datasets import load_dataset


OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "catalog.json"
)
TARGET_COUNT = 150000
US_COUNTRY_TAGS = {"en:united-states", "en:usa", "en:us"}
ENGLISH_LANGUAGE_TAGS = {"en:english", "en:en"}
EXCLUDED_STATES_TAGS = {"en:to-be-completed", "en:to-be-checked"}


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
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _normalize_list(val) -> list:
    """Normalize a value that should be a list of strings."""
    if val is None:
        return []
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        return [t.strip() for t in val.split(",") if t.strip()]
    return []


def _normalized_tag_set(val) -> set[str]:
    return {str(t).lower() for t in _normalize_list(val)}


def _serialize_value(val):
    """Make a value JSON-serializable for storage."""
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        return val
    return str(val)


def extract_product(row: dict) -> dict | None:
    """Extract ALL fields from a dataset row, keeping everything available."""
    product_name = _to_str(row.get("product_name"))
    code = str(row.get("code", "")).strip()

    if not product_name.strip() or not code:
        return None

    # Normalize ecoscore_grade
    ecoscore_grade = row.get("ecoscore_grade") or None
    if ecoscore_grade and ecoscore_grade.lower() not in ("a", "b", "c", "d", "e"):
        ecoscore_grade = None
    elif ecoscore_grade:
        ecoscore_grade = ecoscore_grade.lower()

    # Parse nutriments - OpenFoodFacts dataset can have it as:
    # 1. A dict: {"energy-kcal_100g": 100, "sugars_100g": 5, ...}
    # 2. A list: [{"name": "energy-kcal", "100g": 100, ...}, ...]
    # 3. A JSON string of either format
    nutriments_raw = row.get("nutriments") or {}
    nutriments = {}

    if isinstance(nutriments_raw, str):
        try:
            nutriments_raw = json.loads(nutriments_raw)
        except (json.JSONDecodeError, TypeError):
            nutriments_raw = {}

    if isinstance(nutriments_raw, dict):
        # Already in the right format
        nutriments = nutriments_raw
    elif isinstance(nutriments_raw, list):
        # Convert list format to dict format
        # List entries look like: {"name": "energy-kcal", "100g": 267.0, "serving": 4.0, ...}
        # We want: {"energy-kcal_100g": 267.0, ...}
        for entry in nutriments_raw:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            value_100g = entry.get("100g")
            if name and value_100g is not None:
                # Normalize the key format (e.g., "energy-kcal" -> "energy-kcal_100g")
                key = f"{name}_100g"
                nutriments[key] = value_100g

    # Ensure it's a dict
    if not isinstance(nutriments, dict):
        nutriments = {}

    # Build product dict with ALL available fields
    product = {
        # --- Core identifiers ---
        "code": code,
        "product_name": product_name.strip(),
        "generic_name": _to_str(row.get("generic_name")).strip(),
        "brands": _to_str(row.get("brands")).strip(),
        "brands_tags": _normalize_list(row.get("brands_tags")),
        "categories": _to_str(row.get("categories")).strip(),
        "categories_tags": _normalize_list(row.get("categories_tags")),
        "categories_properties": _serialize_value(row.get("categories_properties")),
        "link": row.get("link") or None,
        "lang": row.get("lang") or None,
        "languages_tags": _normalize_list(row.get("languages_tags")),
        # --- Ingredients ---
        "ingredients": _serialize_value(row.get("ingredients")),
        "ingredients_text": _to_str(row.get("ingredients_text")).strip(),
        "ingredients_tags": _normalize_list(row.get("ingredients_tags")),
        "ingredients_original_tags": _normalize_list(
            row.get("ingredients_original_tags")
        ),
        "ingredients_n": _safe_int(row.get("ingredients_n")),
        "ingredients_analysis_tags": _normalize_list(
            row.get("ingredients_analysis_tags")
        ),
        "ingredients_percent_analysis": _safe_int(
            row.get("ingredients_percent_analysis")
        ),
        "ingredients_with_specified_percent_n": _safe_int(
            row.get("ingredients_with_specified_percent_n")
        ),
        "ingredients_with_unspecified_percent_n": _safe_int(
            row.get("ingredients_with_unspecified_percent_n")
        ),
        "ingredients_without_ciqual_codes_n": _safe_int(
            row.get("ingredients_without_ciqual_codes_n")
        ),
        "ingredients_without_ciqual_codes": _normalize_list(
            row.get("ingredients_without_ciqual_codes")
        ),
        "ingredients_from_palm_oil_n": _safe_int(row.get("ingredients_from_palm_oil_n"))
        or 0,
        "known_ingredients_n": _safe_int(row.get("known_ingredients_n")),
        "unknown_ingredients_n": _safe_int(row.get("unknown_ingredients_n")),
        # --- Nutrition (full raw nutriments + parsed summary) ---
        "nutriments": nutriments,
        "nutrition_data_per": row.get("nutrition_data_per") or None,
        "no_nutrition_data": row.get("no_nutrition_data") or None,
        "nutrient_levels_tags": _normalize_list(row.get("nutrient_levels_tags")),
        "nutriscore_grade": row.get("nutriscore_grade") or None,
        "nutriscore_score": _safe_int(row.get("nutriscore_score")),
        "nova_group": _safe_int(row.get("nova_group")),
        "nova_groups": row.get("nova_groups") or None,
        "nova_groups_tags": _normalize_list(row.get("nova_groups_tags")),
        # --- Allergens & additives ---
        "allergens_tags": _normalize_list(row.get("allergens_tags")),
        "additives_n": _safe_int(row.get("additives_n")),
        "additives_tags": _normalize_list(row.get("additives_tags")),
        "new_additives_n": _safe_int(row.get("new_additives_n")),
        "traces_tags": _normalize_list(row.get("traces_tags")),
        "with_sweeteners": _safe_int(row.get("with_sweeteners")),
        "with_non_nutritive_sweeteners": _safe_int(
            row.get("with_non_nutritive_sweeteners")
        ),
        # --- Labels & certifications ---
        "labels": _to_str(row.get("labels")).strip(),
        "labels_tags": _normalize_list(row.get("labels_tags")),
        # --- Eco-score ---
        "ecoscore_grade": ecoscore_grade,
        "ecoscore_score": _safe_int(row.get("ecoscore_score")),
        "ecoscore_data": _serialize_value(row.get("ecoscore_data")),
        "ecoscore_tags": _normalize_list(row.get("ecoscore_tags")),
        # --- Packaging ---
        "packaging": _to_str(row.get("packaging")).strip(),
        "packaging_text": _to_str(row.get("packaging_text")).strip(),
        "packagings": _serialize_value(row.get("packagings")),
        "packagings_complete": _safe_int(row.get("packagings_complete")),
        "packaging_tags": _normalize_list(row.get("packaging_tags")),
        "packaging_shapes_tags": _normalize_list(row.get("packaging_shapes_tags")),
        "packaging_recycling_tags": _normalize_list(
            row.get("packaging_recycling_tags")
        ),
        # --- Geographic & origin ---
        "countries_tags": _normalize_list(row.get("countries_tags")),
        "main_countries_tags": _normalize_list(row.get("main_countries_tags")),
        "origins": _to_str(row.get("origins")).strip(),
        "origins_tags": _normalize_list(row.get("origins_tags")),
        "manufacturing_places": _to_str(row.get("manufacturing_places")).strip(),
        "manufacturing_places_tags": _normalize_list(
            row.get("manufacturing_places_tags")
        ),
        "purchase_places_tags": _normalize_list(row.get("purchase_places_tags")),
        "cities_tags": _normalize_list(row.get("cities_tags")),
        "emb_codes": row.get("emb_codes") or None,
        "emb_codes_tags": _normalize_list(row.get("emb_codes_tags")),
        # --- Images ---
        "images": _serialize_value(row.get("images")),
        "image_front_url": row.get("image_front_url") or row.get("image_url") or None,
        "max_imgid": _safe_int(row.get("max_imgid")),
        "last_image_t": _safe_int(row.get("last_image_t")),
        # --- Quantity & serving ---
        "quantity": _to_str(row.get("quantity")).strip(),
        "product_quantity": _safe_float(row.get("product_quantity")),
        "product_quantity_unit": row.get("product_quantity_unit") or None,
        "serving_size": _to_str(row.get("serving_size")).strip(),
        "serving_quantity": _safe_float(row.get("serving_quantity")),
        # --- Completeness & data quality ---
        "complete": _safe_int(row.get("complete")),
        "completeness": _safe_float(row.get("completeness")),
        "data_quality_errors_tags": _normalize_list(
            row.get("data_quality_errors_tags")
        ),
        "data_quality_warnings_tags": _normalize_list(
            row.get("data_quality_warnings_tags")
        ),
        "data_quality_info_tags": _normalize_list(row.get("data_quality_info_tags")),
        "states_tags": _normalize_list(row.get("states_tags")),
        # --- Stores & distribution ---
        "stores": _to_str(row.get("stores")).strip(),
        "stores_tags": _normalize_list(row.get("stores_tags")),
        "compared_to_category": row.get("compared_to_category") or None,
        "popularity_key": _safe_int(row.get("popularity_key")),
        "popularity_tags": _normalize_list(row.get("popularity_tags")),
        "scans_n": _safe_int(row.get("scans_n")),
        "unique_scans_n": _safe_int(row.get("unique_scans_n")),
        # --- Food classification ---
        "food_groups_tags": _normalize_list(row.get("food_groups_tags")),
        "ciqual_food_name_tags": _normalize_list(row.get("ciqual_food_name_tags")),
        "minerals_tags": _normalize_list(row.get("minerals_tags")),
        "vitamins_tags": _normalize_list(row.get("vitamins_tags")),
        "nucleotides_tags": _normalize_list(row.get("nucleotides_tags")),
        "misc_tags": _normalize_list(row.get("misc_tags")),
        "data_sources_tags": _normalize_list(row.get("data_sources_tags")),
        # --- Contributors & timestamps ---
        "creator": row.get("creator") or None,
        "created_t": _safe_int(row.get("created_t")),
        "last_modified_t": _safe_int(row.get("last_modified_t")),
        "last_modified_by": row.get("last_modified_by") or None,
        "last_updated_t": _safe_int(row.get("last_updated_t")),
        "owner": row.get("owner") or None,
        "rev": _safe_int(row.get("rev")),
        "obsolete": _safe_int(row.get("obsolete")),
    }

    return product


def compute_completeness(product: dict) -> int:
    score = 0
    if product.get("ecoscore_grade"):
        score += 10
    if product.get("image_front_url"):
        score += 3
    if product.get("ingredients_text"):
        score += 2
    if product.get("brands"):
        score += 1
    n = product.get("nutriments") or {}
    if isinstance(n, dict):
        score += sum(1 for v in n.values() if v is not None)
    return score


def keep_us_english_product(product: dict) -> bool:
    """Keep products that are mainly US-market and English-compatible.

    Priority:
    1) If main_countries_tags exists, US must be in main_countries_tags.
    2) Otherwise, US must be present in countries_tags.
    3) Product should also be English by lang or languages_tags.
    """
    lang = (product.get("lang") or "").lower()
    language_tags = {str(t).lower() for t in (product.get("languages_tags") or [])}
    countries_tags = {str(t).lower() for t in (product.get("countries_tags") or [])}
    main_countries_tags = {
        str(t).lower() for t in (product.get("main_countries_tags") or [])
    }

    is_english = lang == "en" or bool(language_tags & ENGLISH_LANGUAGE_TAGS)

    if main_countries_tags:
        is_us_market = bool(main_countries_tags & US_COUNTRY_TAGS)
    else:
        is_us_market = bool(countries_tags & US_COUNTRY_TAGS)

    return is_us_market and is_english


def keep_raw_row_us_english(row: dict) -> bool:
    """Fast prefilter on raw row values before full extraction."""
    lang = (row.get("lang") or "").lower()
    language_tags = _normalized_tag_set(row.get("languages_tags"))
    countries_tags = _normalized_tag_set(row.get("countries_tags"))
    main_countries_tags = _normalized_tag_set(row.get("main_countries_tags"))

    is_english = lang == "en" or bool(language_tags & ENGLISH_LANGUAGE_TAGS)
    if main_countries_tags:
        is_us_market = bool(main_countries_tags & US_COUNTRY_TAGS)
    else:
        is_us_market = bool(countries_tags & US_COUNTRY_TAGS)

    return is_us_market and is_english


def keep_raw_row_quality(row: dict) -> bool:
    """Reject low-quality/incomplete rows early to reduce downstream work."""
    product_name = _to_str(row.get("product_name")).strip()
    if not product_name:
        return False

    brands = _to_str(row.get("brands")).strip()
    categories = _to_str(row.get("categories")).strip()
    categories_tags = _normalize_list(row.get("categories_tags"))
    if not brands and not categories and not categories_tags:
        return False

    states_tags = _normalized_tag_set(row.get("states_tags"))
    if states_tags & EXCLUDED_STATES_TAGS:
        return False

    return True


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
    rejected_by_market_filter = 0
    rejected_by_quality_filter = 0

    print("Scanning products...")
    for row in ds:
        scanned += 1
        if scanned % 10000 == 0:
            print(f"  Scanned {scanned} rows, kept {len(products)} so far...")

        if not keep_raw_row_us_english(row):
            rejected_by_market_filter += 1
            continue

        if not keep_raw_row_quality(row):
            rejected_by_quality_filter += 1
            continue

        product = extract_product(row)
        if product is None:
            continue

        # Defensive check on normalized data.
        if not keep_us_english_product(product):
            rejected_by_market_filter += 1
            continue

        if product["code"] in seen_codes:
            continue
        seen_codes.add(product["code"])

        products.append(product)

        # Stop after keeping TARGET_COUNT products
        if len(products) >= TARGET_COUNT:
            break

    print(f"\nScanned {scanned} rows total, extracted {len(products)} valid products")
    print(f"Filtered out by US/English criteria: {rejected_by_market_filter}")
    print(f"Filtered out by quality criteria: {rejected_by_quality_filter}")

    # Sort by completeness (eco-score presence prioritized)
    products.sort(key=compute_completeness, reverse=True)

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
