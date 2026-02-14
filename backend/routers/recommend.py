from fastapi import APIRouter, HTTPException
from services.actian import actian_client

router = APIRouter()


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
        top_k=5,
    )

    # Filter out the original product
    alternatives = [a for a in alternatives if a.get("product_code") != product_code]
    return alternatives
