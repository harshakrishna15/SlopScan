import requests
import csv
import io
import json

# ---- Config ----
USER_AGENT = "GreenShelfScanner/0.1 (charsmith034@gmail.com)"  # change email
HEADERS = {"User-Agent": USER_AGENT}

# Nutella barcode is usually the most reliable way to fetch the right product.
# If this barcode doesn't match your region's Nutella, you can switch to name search below.
BARCODE = "8019428008057"
POORE_NEMECEK_GHG_CSV_URLS = [
    "https://ourworldindata.org/grapher/ghg-per-kg-poore.csv",
    "https://archive.ourworldindata.org/20250903-083611/grapher/ghg-per-kg-poore.csv",
]
OFF_DATASET_PATH = "beauty.json"


# ---- Helpers ----
def pretty_join(x):
    if not x:
        return None
    if isinstance(x, list):
        return ", ".join(str(i) for i in x if i)
    return str(x)


def get_nested(d, *keys, default=None):
    cur = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


def fetch_by_barcode(barcode: str) -> dict:
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    data = r.json()
    if data.get("status") != 1:
        raise ValueError(
            f"Product not found for barcode={barcode}. status={data.get('status')}"
        )
    return data["product"]


def search_first_product(query: str) -> dict:
    url = "https://world.openfoodfacts.org/cgi/search.pl"
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 1,
    }
    r = requests.get(url, params=params, headers=HEADERS, timeout=20)
    r.raise_for_status()
    data = r.json()
    products = data.get("products", [])
    if not products:
        raise ValueError(f"No products found for query='{query}'")
    return products[0]


def fetch_poore_nemecek_ghg_rows(
    urls: list[str] = POORE_NEMECEK_GHG_CSV_URLS,
) -> tuple[list[dict], str]:
    last_error = None
    for url in urls:
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            r.raise_for_status()
            csv_text = r.text
            reader = csv.DictReader(io.StringIO(csv_text))
            return list(reader), url
        except Exception as e:
            last_error = e

    raise RuntimeError(
        "All Poore & Nemecek dataset URLs failed."
        + (f" Last error: {last_error}" if last_error else "")
    )


def normalize_barcode(code) -> str | None:
    if code is None:
        return None
    return str(code).strip()


def extract_ecoscore_fields(product: dict) -> dict:
    ecoscore_grade = product.get("ecoscore_grade")
    ecoscore_score = product.get("ecoscore_score")
    if ecoscore_grade is None:
        ecoscore_grade = get_nested(product, "ecoscore_data", "grade")
    if ecoscore_score is None:
        ecoscore_score = get_nested(product, "ecoscore_data", "score")
    return {"ecoscore_grade": ecoscore_grade, "ecoscore_score": ecoscore_score}


def lookup_ecoscore_in_dataset(dataset_path: str, barcode: str) -> dict | None:
    target = normalize_barcode(barcode)
    if not target:
        return None

    with open(dataset_path, "r", encoding="utf-8") as f:
        first = f.read(1)
        f.seek(0)

        # Supports standard JSON arrays and line-delimited JSON dumps.
        if first == "[":
            data = json.load(f)
            for product in data:
                if normalize_barcode(product.get("code")) == target:
                    return extract_ecoscore_fields(product)
            return None

        for line in f:
            line = line.strip()
            if not line:
                continue
            product = json.loads(line)
            if normalize_barcode(product.get("code")) == target:
                return extract_ecoscore_fields(product)

    return None


def print_product_summary(p: dict) -> None:
    print("=== Basic Info ===")
    print("Name:", p.get("product_name") or p.get("product_name_en"))
    print("Brands:", p.get("brands"))
    print("Quantity:", p.get("quantity"))
    print("Barcode (code):", p.get("code"))
    print("Countries:", p.get("countries"))
    print("Categories:", p.get("categories"))

    print("\n=== Ingredients ===")
    print(p.get("ingredients_text") or p.get("ingredients_text_en"))

    nutr = p.get("nutriments", {}) or {}
    print("\n=== Nutrition (per 100g, if available) ===")
    print("Energy (kcal):", nutr.get("energy-kcal_100g"))
    print("Sugars (g):", nutr.get("sugars_100g"))
    print("Fat (g):", nutr.get("fat_100g"))
    print("Saturated fat (g):", nutr.get("saturated-fat_100g"))
    print("Protein (g):", nutr.get("proteins_100g"))
    print("Salt (g):", nutr.get("salt_100g"))

    # ---- Environmental / sustainability-related fields (availability varies a lot) ----
    print("\n=== Environmental / Sustainability (OpenFoodFacts) ===")

    # Eco-Score (if present)
    ecoscore_grade = p.get("ecoscore_grade")
    ecoscore_score = p.get("ecoscore_score")
    if ecoscore_grade is not None or ecoscore_score is not None:
        print("Eco-Score grade:", ecoscore_grade)
        print("Eco-Score score:", ecoscore_score)
    else:
        print("Eco-Score: (not available for this product)")

    # Environmental impact “level” tags (sometimes present)
    env_level = pretty_join(p.get("environmental_impact_level_tags"))
    if env_level:
        print("Environmental impact tags:", env_level)

    # Packaging info (often useful for “green score” heuristics)
    packaging = p.get("packaging")
    packaging_tags = pretty_join(p.get("packaging_tags"))
    if packaging or packaging_tags:
        print("Packaging (text):", packaging)
        print("Packaging tags:", packaging_tags)
    else:
        print("Packaging: (not available)")

    # Labels (e.g., organic, rainforest alliance, etc. — not guaranteed)
    labels = p.get("labels")
    labels_tags = pretty_join(p.get("labels_tags"))
    if labels or labels_tags:
        print("Labels (text):", labels)
        print("Labels tags:", labels_tags)

    # Palm oil flags (common sustainability signal)
    palm_oil = p.get("ingredients_from_palm_oil_n")
    palm_oil_maybe = p.get("ingredients_that_may_be_from_palm_oil_n")
    if palm_oil is not None or palm_oil_maybe is not None:
        print("Ingredients from palm oil (count):", palm_oil)
        print("May be from palm oil (count):", palm_oil_maybe)

    # Origins (sometimes available)
    origins = p.get("origins")
    origins_tags = pretty_join(p.get("origins_tags"))
    if origins or origins_tags:
        print("Origins (text):", origins)
        print("Origins tags:", origins_tags)

    # “Sustainability” style fields can be sparse; show a reminder:
    print(
        "\nNote: OpenFoodFacts environmental fields are incomplete for many products."
    )
    print(
        "For robust 'green scores', you typically map product categories/ingredients to an LCA dataset (e.g., Poore & Nemecek)."
    )


def main():
    try:
        ghg_rows, used_url = fetch_poore_nemecek_ghg_rows()
        print("=== Poore & Nemecek dataset (GHG per kg) ===")
        print("Source URL:", used_url)
        print(f"Rows fetched: {len(ghg_rows)}")
        if ghg_rows:
            print("Columns:", ", ".join(ghg_rows[0].keys()))
            print("First row:", ghg_rows[0])
        print()
    except Exception as e:
        print(f"Could not fetch Poore & Nemecek dataset: {e}\n")

    try:
        product = fetch_by_barcode(BARCODE)
    except Exception as e:
        print(f"Barcode lookup failed: {e}")
        print("Falling back to name search for 'nutella'...")
        product = search_first_product("nutella")

    try:
        code = product.get("code") or BARCODE
        ecoscore = lookup_ecoscore_in_dataset(OFF_DATASET_PATH, code)
        print(f"=== Eco-Score from local OFF dataset ({OFF_DATASET_PATH}) ===")
        if ecoscore is None:
            print(f"No matching barcode found for {code}")
            print("Falling back to OpenFoodFacts API product fields:")
            print("Eco-Score grade:", product.get("ecoscore_grade"))
            print("Eco-Score score:", product.get("ecoscore_score"))
            print()
        else:
            print("Eco-Score grade:", ecoscore["ecoscore_grade"])
            print("Eco-Score score:", ecoscore["ecoscore_score"])
            print()
    except Exception as e:
        print(f"Could not read Eco-Score from {OFF_DATASET_PATH}: {e}\n")

    print_product_summary(product)


if __name__ == "__main__":
    main()
