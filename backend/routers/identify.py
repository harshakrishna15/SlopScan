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
        return {
            "gemini_guesses": [],
            "best_match": None,
            "candidates": [],
            "needs_confirmation": True,
        }

    try:
        embeddings = embed_texts_batch(guesses)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Embedding error: {e}")

    all_results = []
    seen_codes = set()
    search_errors = []
    for emb in embeddings:
        try:
            matches = actian_client.search_similar(emb, top_k=3)
            for m in matches:
                code = m.get("product_code")
                if code and code not in seen_codes:
                    seen_codes.add(code)
                    all_results.append(m)
        except Exception as e:
            search_errors.append(str(e))

    if not all_results and search_errors:
        raise HTTPException(status_code=502, detail=f"Vector search error: {search_errors[0]}")

    all_results.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
    candidates = all_results[:5]

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
        }
        for c in candidates
    ]

    return {
        "gemini_guesses": guesses,
        "best_match": best_match,
        "candidates": candidate_list,
        "needs_confirmation": needs_confirmation,
    }
