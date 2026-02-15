from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from services import gemini
from services.embeddings import embed_texts_batch
from services.actian import actian_client
from config import CONFIDENCE_THRESHOLD

router = APIRouter()


@router.post("/identify")
async def identify(image: UploadFile = File(...), skip_explanation: bool = Query(False)):
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")

    try:
        gemini_result = await gemini.identify_product(image_bytes)
        guesses = gemini_result.get("guesses", [])
        gemini_brand = gemini_result.get("brand")
        category_icon = gemini_result.get("category_icon", "basket")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Gemini Vision error: {e}")

    if not guesses:
        print("[identify] Gemini returned no guesses")
        return {
            "gemini_guesses": [],
            "best_match": None,
            "candidates": [],
            "needs_confirmation": True,
        }

    print(f"[identify] Gemini guesses: {guesses}")
    if gemini_brand:
        print(f"[identify] Gemini detected brand: {gemini_brand}")

    try:
        db_count = actian_client.count()
        print(f"[identify] Products in VectorDB: {db_count}")
    except Exception:
        print("[identify] Could not get DB product count")

    try:
        embeddings = embed_texts_batch(guesses)
        for i, (guess, emb) in enumerate(zip(guesses, embeddings)):
            print(f"[identify] Embedding for '{guess}': dim={len(emb)}, first5={emb[:5]}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Embedding error: {e}")

    all_results = []
    seen_codes = set()
    search_errors = []
    for i, emb in enumerate(embeddings):
        try:
            matches = actian_client.search_similar(emb, top_k=3)
            print(f"[identify] Search results for guess '{guesses[i]}':")
            for j, m in enumerate(matches):
                print(f"  [{j}] score={m.get('similarity_score', 0):.4f} "
                      f"name='{m.get('product_name')}' "
                      f"code={m.get('product_code')} "
                      f"brands='{m.get('brands')}'")
            for m in matches:
                code = m.get("product_code")
                if code and code not in seen_codes:
                    seen_codes.add(code)
                    all_results.append(m)
        except Exception as e:
            search_errors.append(str(e))
            print(f"[identify] Search error for guess '{guesses[i]}': {e}")

    if not all_results and search_errors:
        raise HTTPException(status_code=502, detail=f"Vector search error: {search_errors[0]}")

    candidate_brands = set()
    if gemini_brand:
        candidate_brands.add(gemini_brand.lower())

    for guess in guesses:
        # Simple heuristic: first word is often the brand (e.g. "Nutella" in "Nutella Hazelnut Spread")
        parts = guess.split()
        if parts:
            candidate_brands.add(parts[0].lower())
        # Also add the full guess as a potential brand if it's short (e.g. "Nike")
        candidate_brands.add(guess.lower())
    
    print(f"[identify] Candidate brands from Gemini: {candidate_brands}")

    # Apply Brand Boost
    for res in all_results:
        brand_db = (res.get("brands") or "").lower()
        product_name_db = (res.get("product_name") or "").lower()
        
        # Check if any candidate brand is in the DB brand field
        boost = 0.0
        for brand in candidate_brands:
            # If the candidate brand (e.g. "ferrero") appears in the DB brand field
            if brand in brand_db:
                boost = 0.25 # Significant boost
                break
            # Fallback: if brand is effectively the start of product name
            if product_name_db.startswith(brand + " "):
                boost = 0.15
                break
        
        if boost > 0:
            original_score = res.get("similarity_score", 0)
            res["similarity_score"] = min(original_score + boost, 1.0) # Cap at 1.0
            print(f"  -> Boosted '{res.get('product_name')}' by {boost} (new score: {res['similarity_score']:.4f})")

    all_results.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
    candidates = all_results[:5]

    print(f"[identify] Total unique results: {len(all_results)}, returning top {len(candidates)}")
    for i, c in enumerate(candidates):
        print(f"  [final {i}] score={c.get('similarity_score', 0):.4f} name='{c.get('product_name')}'")

    best_match = None
    needs_confirmation = True
    if candidates:
        top = candidates[0]
        confidence = top.get("similarity_score", 0)
        best_match = {
            "product_code": top.get("product_code"),
            "product_name": top.get("product_name"),
            "brands": top.get("brands"),
            "confidence": confidence,
            "ecoscore_grade": top.get("ecoscore_grade"),
        }
        needs_confirmation = confidence < CONFIDENCE_THRESHOLD

    candidate_list = [
        {
            "product_code": c.get("product_code"),
            "product_name": c.get("product_name"),
            "brands": c.get("brands"),
            "confidence": c.get("similarity_score", 0),
            "ecoscore_grade": c.get("ecoscore_grade"),
            "ecoscore_score": c.get("ecoscore_score"),
            "categories": c.get("categories"),
            "categories_tags": c.get("categories_tags"),
            "packaging_tags": c.get("packaging_tags"),
            "labels_tags": c.get("labels_tags"),
            "ingredients_text": c.get("ingredients_text"),
            "palm_oil_count": c.get("palm_oil_count"),
            "nutrition_json": c.get("nutrition_json"),
            "image_url": c.get("image_url"),
        }
        for c in candidates
    ]

    # Generate explanation for the best match (skipped when mobile passes skip_explanation=true)
    best_match_explanation = None
    if not skip_explanation and best_match and candidates:
        try:
            from routers.explain import _explain_product
            best_match_explanation = await _explain_product(candidates[0])
        except Exception as e:
            print(f"[identify] WARN: Failed to generate explanation for best match: {e}")

    return {
        "gemini_guesses": guesses,
        "best_match": best_match,
        "best_match_explanation": best_match_explanation,
        "candidates": candidate_list,
        "needs_confirmation": needs_confirmation,
        "category_icon": category_icon,
    }
