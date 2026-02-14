import traceback

from fastapi import APIRouter, HTTPException
from services.actian import actian_client
from services import gemini

router = APIRouter()


@router.get("/explain/{product_code}")
async def explain(product_code: str):
    print(f"[explain] called for product_code={product_code}")

    product = actian_client.get_product(product_code)
    if not product:
        print(f"[explain] product not found in Actian: {product_code}")
        raise HTTPException(status_code=404, detail="Product not found")

    print(f"[explain] product fetched: name={product.get('product_name')}, has_nutrition={bool(product.get('nutrition_json'))}, ecoscore={product.get('ecoscore_grade')}")

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
