import traceback

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.actian import actian_client
from services import gemini

router = APIRouter()


async def _explain_product(product: dict):
    print(f"[explain] product: name={product.get('product_name')}, has_nutrition={bool(product.get('nutrition_json'))}, ecoscore={product.get('ecoscore_grade')}")

    try:
        explanation = await gemini.explain_product(product)
    except Exception as e:
        print(f"[explain] ERROR gemini.explain_product failed: {e}")
        traceback.print_exc()
        explanation = {
            "nutrition_summary": "Unable to generate analysis at this time.",
            "eco_explanation": product.get("ecoscore_grade", "Not available"),
            "ingredient_flags": [],
            "advice": f"Error: {e}",
        }
    return explanation


class ExplainRequest(BaseModel):
    product_code: str | None = None
    product_name: str
    brands: str | None = None
    categories: str | None = None
    nutriscore_grade: str | None = None
    ecoscore_grade: str | None = None
    ecoscore_score: float | None = None
    nutrition_json: str | None = None
    ingredients_text: str | None = None
    packaging_tags: str | None = None
    labels_tags: str | None = None
    palm_oil_count: int | None = None
    image_url: str | None = None


@router.post("/explain")
async def explain_from_product(body: ExplainRequest):
    product = body.model_dump(exclude_none=False)
    return await _explain_product(product)


@router.get("/explain/{product_code}")
async def explain(product_code: str):
    print(f"[explain] called for product_code={product_code}")

    product = actian_client.get_product(product_code)
    if not product:
        print(f"[explain] product not found in Actian: {product_code}")
        raise HTTPException(status_code=404, detail="Product not found")

    return await _explain_product(product)
