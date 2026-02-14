from fastapi import APIRouter, HTTPException
from services.actian import actian_client

router = APIRouter()


@router.get("/product/{product_code}")
async def get_product(product_code: str):
    product = actian_client.get_product(product_code)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    print(f"[product] code={product_code} -> name='{product.get('product_name')}' brands='{product.get('brands')}'")
    return product
