#!/usr/bin/env python3
"""Test script to check if predicted scores are working"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import asyncio
from services import gemini

async def test_prediction():
    # Test product with no scores
    test_product = {
        "product_name": "Test Soda",
        "brands": "TestBrand",
        "categories": "en:beverages,en:sodas",
        "nutriscore_grade": None,  # Missing
        "ecoscore_grade": None,  # Missing
        "ecoscore_score": None,
        "nutrition_json": {
            "energy-kcal_100g": 42,
            "sugars_100g": 10.5,
            "fat_100g": 0,
            "saturated-fat_100g": 0,
            "proteins_100g": 0,
            "salt_100g": 0.02
        },
        "packaging_tags": "plastic,bottle",
        "labels_tags": "",
        "palm_oil_count": 0,
        "ingredients_text": "Water, sugar, carbon dioxide, citric acid, natural flavors"
    }
    
    print("Testing with product that has NO scores...")
    print(f"Input: nutriscore={test_product['nutriscore_grade']}, ecoscore={test_product['ecoscore_grade']}")
    
    result = await gemini.explain_product(test_product)
    
    print("\n=== RESULT ===")
    print(f"Keys returned: {list(result.keys())}")
    print(f"predicted_nutriscore: {result.get('predicted_nutriscore')}")
    print(f"predicted_ecoscore: {result.get('predicted_ecoscore')}")
    print(f"\nFull response:")
    import json
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(test_prediction())
