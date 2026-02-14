from fastapi import APIRouter, HTTPException
from services.actian import actian_client
from services import gemini

router = APIRouter()


@router.get("/explain/{product_code}")
async def explain(product_code: str):
    product = actian_client.get_product(product_code)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    try:
        explanation = await gemini.explain_product(product)
    except Exception as e:
        explanation = {
            "nutrition_summary": "Unable to generate analysis at this time.",
            "eco_explanation": product.get("ecoscore_grade", "Not available"),
            "ingredient_flags": [],
            "advice": f"Error: {e}",
        }
    return explanation
