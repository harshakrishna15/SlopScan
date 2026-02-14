from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.actian import actian_client
from services.embeddings import embed_text

router = APIRouter()


class RecommendationSource(BaseModel):
    product_code: str | None = None
    product_name: str
    brands: str | None = None
    categories: str | None = None
    ecoscore_grade: str | None = None


def _normalize(value: str | None) -> str:
    return (value or "").strip().casefold()


def _primary_brand(value: str | None) -> str:
    normalized = _normalize(value)
    if not normalized:
        return ""
    return normalized.split(",")[0].strip()


def _dedupe_alternatives(items: list[dict]) -> list[dict]:
    unique: list[dict] = []
    seen: set[tuple[str, str] | tuple[str, str, str]] = set()

    for item in items:
        name = _normalize(item.get("product_name"))
        brand = _normalize(item.get("brands"))
        code = _normalize(item.get("product_code"))

        # Prefer product identity by name+brand. Fall back to code only when needed.
        key: tuple[str, str] | tuple[str, str, str]
        if name:
            key = (name, brand)
        elif code:
            key = ("code", code, "")
        else:
            continue

        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    return unique


def _diversify_by_brand(items: list[dict]) -> list[dict]:
    unique: list[dict] = []
    seen_brands: set[str] = set()

    for item in items:
        brand = _primary_brand(item.get("brands"))
        if brand and brand in seen_brands:
            continue
        if brand:
            seen_brands.add(brand)
        unique.append(item)

    return unique


@router.get("/recommend/{product_code}")
async def recommend(product_code: str):
    product, vector = actian_client.get_product_with_vector(product_code)
    if not product or not vector:
        raise HTTPException(status_code=404, detail="Product not found")

    category = product.get("categories", "")
    alternatives = actian_client.search_greener_alternatives(
        embedding=vector,
        category=category,
        min_ecoscore="b",
        top_k=25,
    )

    # Filter out the original product and near-duplicate alternatives.
    alternatives = [a for a in alternatives if a.get("product_code") != product_code]
    alternatives = _dedupe_alternatives(alternatives)
    alternatives = _diversify_by_brand(alternatives)
    return alternatives[:5]


@router.post("/recommend")
async def recommend_from_source(source: RecommendationSource):
    source_text = " ".join(
        part for part in [source.product_name, source.brands, source.categories] if part
    )
    query_embedding = embed_text(source_text)

    alternatives = actian_client.search_greener_alternatives(
        embedding=query_embedding,
        category=source.categories or "",
        min_ecoscore="b",
        top_k=60,
    )

    source_code = _normalize(source.product_code)
    source_name = _normalize(source.product_name)
    source_brand = _primary_brand(source.brands)

    filtered = []
    for alt in alternatives:
        alt_code = _normalize(alt.get("product_code"))
        alt_name = _normalize(alt.get("product_name"))
        alt_brand = _primary_brand(alt.get("brands"))

        same_code = bool(source_code) and alt_code == source_code
        same_name_brand = bool(source_name) and alt_name == source_name and alt_brand == source_brand
        if same_code or same_name_brand:
            continue
        filtered.append(alt)

    filtered = _dedupe_alternatives(filtered)
    filtered = _diversify_by_brand(filtered)
    return filtered[:5]
