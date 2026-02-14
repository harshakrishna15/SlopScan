from fastapi import APIRouter, UploadFile, File, HTTPException
from services import gemini
from services.embeddings import embed_texts_batch
from services.actian import actian_client
from config import CONFIDENCE_THRESHOLD

router = APIRouter()


@router.post("/identify")
async def identify(image: UploadFile = File(...)):
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")

    try:
        guesses = await gemini.identify_product(image_bytes)
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

    return {
        "gemini_guesses": guesses,
        "best_match": best_match,
        "candidates": candidate_list,
        "needs_confirmation": needs_confirmation,
    }
