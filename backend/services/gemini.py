import asyncio
import json
from functools import partial

import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL

genai.configure(api_key=GEMINI_API_KEY)


def _parse_json_response(text: str) -> str:
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```)
        lines = lines[1:]
        # Remove last line if it's ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    # Sometimes the model wraps in just backticks
    text = text.strip("`").strip()
    # Try to find a JSON array or object in the response
    for start_char, end_char in [("[", "]"), ("{", "}")]:
        start = text.find(start_char)
        end = text.rfind(end_char)
        if start != -1 and end != -1 and end > start:
            return text[start:end + 1]
    return text


def _identify_sync(image_bytes: bytes) -> list[str]:
    model = genai.GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(
        [
            {
                "mime_type": "image/jpeg",
                "data": image_bytes,
            },
            (
                "You are a food product identifier. Look at this photo of a food product package. "
                "Return ONLY a JSON array of 3-5 possible product names, from most to least likely. "
                'Include the brand name. Example: ["Nutella Hazelnut Spread", "Nutella & Go", "Generic Hazelnut Spread"] '
                "Return ONLY the JSON array, no other text."
            ),
        ]
    )
    raw = response.text
    print(f"[Gemini raw response]: {raw[:500]}")
    text = _parse_json_response(raw)
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        return []
    except json.JSONDecodeError:
        print(f"[Gemini parse error] Could not parse: {text[:500]}")
        return []


async def identify_product(image_bytes: bytes) -> list[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _identify_sync, image_bytes)


def _explain_sync(product_data: dict) -> dict:
    nutrition = product_data.get("nutrition_json", "{}")
    if isinstance(nutrition, str):
        try:
            nutrition = json.loads(nutrition)
        except json.JSONDecodeError:
            nutrition = {}

    ecoscore_grade = product_data.get("ecoscore_grade") or "not available"
    ecoscore_score = product_data.get("ecoscore_score")
    eco_str = f"{ecoscore_grade} ({ecoscore_score}/100)" if ecoscore_score else ecoscore_grade

    prompt = f"""You are a nutrition and sustainability advisor. Given this product data,
provide a JSON response with these fields:
{{
  "nutrition_summary": "2-3 sentences about the nutrition profile",
  "eco_explanation": "what the eco-score means, or 'Not available' if missing",
  "ingredient_flags": ["list of concerns: palm oil, additives, allergens"],
  "advice": "1-2 sentences of practical advice"
}}

Product: {product_data.get('product_name', 'Unknown')} by {product_data.get('brands', 'Unknown')}
Category: {product_data.get('categories', 'Unknown')}
Nutrition per 100g: energy={nutrition.get('energy-kcal_100g', 'N/A')}kcal, sugars={nutrition.get('sugars_100g', 'N/A')}g, fat={nutrition.get('fat_100g', 'N/A')}g, sat_fat={nutrition.get('saturated-fat_100g', 'N/A')}g, protein={nutrition.get('proteins_100g', 'N/A')}g, salt={nutrition.get('salt_100g', 'N/A')}g
Eco-Score: {eco_str}
Packaging: {product_data.get('packaging_tags', 'N/A')}
Labels: {product_data.get('labels_tags', 'N/A')}
Palm oil ingredients count: {product_data.get('palm_oil_count', 0)}
Ingredients: {product_data.get('ingredients_text', 'N/A')}

Return ONLY valid JSON."""

    model = genai.GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(prompt)
    text = _parse_json_response(response.text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "nutrition_summary": "Unable to generate detailed analysis.",
            "eco_explanation": eco_str,
            "ingredient_flags": [],
            "advice": "Check the product label for more details.",
        }


async def explain_product(product_data: dict) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _explain_sync, product_data)
