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
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = text.find(start_char)
        end = text.rfind(end_char)
        if start != -1 and end != -1 and end > start:
            return text[start:end + 1]
    return text


def _safe_float(val):
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _heuristic_nutriscore(nutrition: dict) -> str | None:
    """Simple fallback estimate for missing Nutri-Score from nutrition per 100g.
    This is not official OFF computation, but provides stable A-E fallback.
    """
    if not isinstance(nutrition, dict):
        return None

    sugars = _safe_float(nutrition.get("sugars_100g"))
    sat_fat = _safe_float(nutrition.get("saturated-fat_100g"))
    salt = _safe_float(nutrition.get("salt_100g"))
    kcal = _safe_float(nutrition.get("energy-kcal_100g"))
    protein = _safe_float(nutrition.get("proteins_100g"))

    available = [v for v in [sugars, sat_fat, salt, kcal, protein] if v is not None]
    if not available:
        return None

    # Penalty from sugar/saturated fat/salt/energy.
    penalty = 0.0
    if sugars is not None:
        penalty += min(max(sugars / 4.5, 0), 10)
    if sat_fat is not None:
        penalty += min(max(sat_fat / 1.5, 0), 10)
    if salt is not None:
        penalty += min(max(salt / 0.18, 0), 10)
    if kcal is not None:
        penalty += min(max((kcal - 50) / 35, 0), 10)

    # Small credit for protein.
    bonus = 0.0
    if protein is not None:
        bonus += min(max(protein / 4.0, 0), 4)

    net = penalty - bonus
    if net <= 4:
        return "a"
    if net <= 10:
        return "b"
    if net <= 17:
        return "c"
    if net <= 24:
        return "d"
    return "e"


def _normalize_grade(val):
    if val is None:
        return None
    s = str(val).strip().lower()
    return s if s in {"a", "b", "c", "d", "e"} else None


def _guaranteed_predicted_nutriscore(nutrition: dict) -> str:
    """Always return a Nutri-Score fallback grade when DB grade is missing."""
    return _heuristic_nutriscore(nutrition) or "c"


def _identify_sync(image_bytes: bytes) -> dict:
    model = genai.GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(
        [
            {
                "mime_type": "image/jpeg",
                "data": image_bytes,
            },
            (
                "You are a food product identifier. Look at this photo of a food product package. "
                "Return a JSON object with three fields:\n"
                "1. 'guesses': A JSON array of 3-5 possible product names (including brand) IN ENGLISH, from most to least likely.\n"
                "2. 'brand': The most likely brand name detected (e.g. 'Coca-Cola', 'Nestle') IN ENGLISH.\n"
                "3. 'front_text': Key visible front-label text from the package (OCR-like), as a short string IN ENGLISH.\n"
                'Example: {"guesses": ["Nutella Hazelnut Spread", "Nutella & Go"], "brand": "Ferrero", "front_text": "nutella hazelnut spread"}\n'
                "Prioritize English names even if the packaging is in another language.\n"
                "Return ONLY the valid JSON object, no other text."
            ),
        ]
    )
    raw = response.text
    print(f"[Gemini raw response]: {raw[:500]}")
    text = _parse_json_response(raw)
    try:
        result = json.loads(text)
        if isinstance(result, list):
            # Fallback for old prompt style if model ignores instruction
            return {"guesses": result, "brand": None, "front_text": ""}
        if isinstance(result, dict):
            if "front_text" not in result:
                result["front_text"] = ""
            return result
        return {"guesses": [], "brand": None, "front_text": ""}
    except json.JSONDecodeError:
        print(f"[Gemini parse error] Could not parse: {text[:500]}")
        return {"guesses": [], "brand": None, "front_text": ""}


async def identify_product(image_bytes: bytes) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _identify_sync, image_bytes)


def _explain_sync(product_data: dict) -> dict:
    nutrition = product_data.get("nutrition_json", "{}")
    if isinstance(nutrition, str):
        try:
            nutrition = json.loads(nutrition)
        except json.JSONDecodeError:
            nutrition = {}

    ecoscore_grade = _normalize_grade(product_data.get("ecoscore_grade"))
    ecoscore_score = product_data.get("ecoscore_score")
    eco_str = f"{ecoscore_grade} ({ecoscore_score}/100)" if ecoscore_score else (ecoscore_grade or "not available")
    
    nutriscore_grade = _normalize_grade(product_data.get("nutriscore_grade"))
    
    print(f"[explain] Input scores - nutriscore: {nutriscore_grade}, ecoscore: {ecoscore_grade}")

    prompt = f"""You are a nutrition and sustainability advisor. Given this product data,
provide a JSON response with these fields:
{{
  "nutrition_summary": "2-3 sentences about the nutrition profile",
  "eco_explanation": "Explanation of the Eco-Score (if available) OR the predicted Eco-Score (if missing). Do NOT say 'Not available' if you are predicting a score.",
  "ingredient_flags": ["list of concerns: palm oil, additives, allergens"],
  "advice": "1-2 sentences of practical advice",
  "predicted_nutriscore": "a-e or null (ONLY if nutriscore_grade is missing - predict based on nutrition data)",
  "predicted_ecoscore": "a-e or null (ONLY if ecoscore is missing - predict based on ingredients, packaging, processing)"
}}

Product: {product_data.get('product_name', 'Unknown')} by {product_data.get('brands', 'Unknown')}
Category: {product_data.get('categories', 'Unknown')}
Nutrition per 100g: energy={nutrition.get('energy-kcal_100g', 'N/A')}kcal, sugars={nutrition.get('sugars_100g', 'N/A')}g, fat={nutrition.get('fat_100g', 'N/A')}g, sat_fat={nutrition.get('saturated-fat_100g', 'N/A')}g, protein={nutrition.get('proteins_100g', 'N/A')}g, salt={nutrition.get('salt_100g', 'N/A')}g
Nutri-Score (from DB): {nutriscore_grade or 'NOT AVAILABLE - please predict'}
Eco-Score (from DB): {eco_str}
Packaging: {product_data.get('packaging_tags', 'N/A')}
Labels: {product_data.get('labels_tags', 'N/A')}
Palm oil ingredients count: {product_data.get('palm_oil_count', 0)}
Ingredients: {product_data.get('ingredients_text', 'N/A')}

IMPORTANT: Only provide predicted_nutriscore if nutriscore_grade is missing. Only provide predicted_ecoscore if ecoscore_grade is missing.
In nutrition_summary, do NOT mention Nutri-Score or Eco-Score grades/letters/scores; focus only on nutrition traits and ingredient quality.
Return ONLY valid JSON."""

    model = genai.GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(prompt)
    raw_text = response.text
    print(f"[explain] Gemini raw response: {raw_text[:500]}")

    text = _parse_json_response(raw_text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"[explain] ERROR failed to parse JSON: {e}")
        print(f"[explain] ERROR raw: {raw_text[:500]}")
        print(f"[explain] ERROR after parse: {text[:500]}")
        fallback = _guaranteed_predicted_nutriscore(nutrition) if not nutriscore_grade else None
        result = {
            "nutrition_summary": "Unable to generate detailed analysis.",
            "eco_explanation": eco_str,
            "ingredient_flags": [],
            "advice": "Check the product label for more details.",
        }
        if fallback:
            result["predicted_nutriscore"] = fallback
        return result

    if not isinstance(parsed, dict):
        print(f"[explain] ERROR Gemini returned {type(parsed).__name__} instead of dict: {text[:500]}")
        fallback = _guaranteed_predicted_nutriscore(nutrition) if not nutriscore_grade else None
        result = {
            "nutrition_summary": "Unable to generate detailed analysis.",
            "eco_explanation": eco_str,
            "ingredient_flags": [],
            "advice": "Check the product label for more details.",
        }
        if fallback:
            result["predicted_nutriscore"] = fallback
        return result

    # Normalize model outputs for predicted grades.
    for k in ("predicted_nutriscore", "predicted_ecoscore"):
        if k in parsed and isinstance(parsed.get(k), str):
            parsed[k] = parsed[k].strip().lower()


    # Clean up - remove predicted scores if actual scores exist
    print(f"[explain] Before cleanup - predicted_nutriscore: {parsed.get('predicted_nutriscore')}, predicted_ecoscore: {parsed.get('predicted_ecoscore')}")
    if nutriscore_grade:
        parsed.pop("predicted_nutriscore", None)
    if ecoscore_grade:
        parsed.pop("predicted_ecoscore", None)

    # Guaranteed fallback: always provide a Nutri-Score estimate when DB grade is missing.
    if not nutriscore_grade:
        predicted = _normalize_grade(parsed.get("predicted_nutriscore"))
        if predicted:
            parsed["predicted_nutriscore"] = predicted
        else:
            parsed["predicted_nutriscore"] = _guaranteed_predicted_nutriscore(nutrition)

    print(f"[explain] After cleanup - keys={list(parsed.keys())}")
    print(f"[explain] Final predicted scores - nutriscore: {parsed.get('predicted_nutriscore')}, ecoscore: {parsed.get('predicted_ecoscore')}")
    return parsed


async def explain_product(product_data: dict) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _explain_sync, product_data)
