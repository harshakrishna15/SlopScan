"""
Backfill missing Nutri-Score and Eco-Score fields in catalog.json from OpenFoodFacts.

Usage:
  python scripts/backfill_scores.py
  python scripts/backfill_scores.py --concurrency 20 --limit 5000
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Any

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CATALOG_PATH = os.path.join(DATA_DIR, "catalog.json")

OFF_V2_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
OFF_V0_URL = "https://world.openfoodfacts.org/api/v0/product/{code}.json"


def _is_missing_grade(val: Any) -> bool:
    if val is None:
        return True
    s = str(val).strip().lower()
    return s in {"", "unknown", "not-applicable", "not available", "none", "null"}


def _safe_int(val: Any) -> int | None:
    if val is None:
        return None
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _needs_backfill(product: dict[str, Any]) -> bool:
    return _is_missing_grade(product.get("nutriscore_grade")) or _is_missing_grade(
        product.get("ecoscore_grade")
    )


async def _fetch_product_scores(client: httpx.AsyncClient, code: str) -> dict[str, Any] | None:
    params = {"fields": "nutriscore_grade,nutriscore_score,ecoscore_grade,ecoscore_score"}

    for _ in range(2):
        try:
            r = await client.get(OFF_V2_URL.format(code=code), params=params)
            if r.status_code == 200:
                data = r.json()
                product = data.get("product")
                if isinstance(product, dict):
                    return product
            # Fallback to v0 for compatibility.
            r = await client.get(OFF_V0_URL.format(code=code))
            if r.status_code == 200:
                data = r.json()
                product = data.get("product")
                if isinstance(product, dict):
                    return product
        except httpx.HTTPError:
            await asyncio.sleep(0.3)
    return None


async def _backfill_async(
    products: list[dict[str, Any]], concurrency: int, limit: int | None
) -> tuple[int, int, int]:
    semaphore = asyncio.Semaphore(concurrency)
    updated = 0
    attempted = 0
    missing_remote = 0

    candidates = [p for p in products if _needs_backfill(p)]
    if limit is not None:
        candidates = candidates[:limit]

    timeout = httpx.Timeout(20.0, connect=10.0)
    headers = {"User-Agent": "sfhacks2026-score-backfill/1.0"}

    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        async def process(product: dict[str, Any]) -> None:
            nonlocal updated, attempted, missing_remote
            code = str(product.get("code") or "").strip()
            if not code:
                return

            attempted += 1
            async with semaphore:
                remote = await _fetch_product_scores(client, code)
            if not remote:
                return

            changed = False

            if _is_missing_grade(product.get("nutriscore_grade")):
                remote_grade = remote.get("nutriscore_grade")
                if not _is_missing_grade(remote_grade):
                    product["nutriscore_grade"] = str(remote_grade).strip().lower()
                    changed = True

                if product.get("nutriscore_score") is None:
                    remote_score = _safe_int(remote.get("nutriscore_score"))
                    if remote_score is not None:
                        product["nutriscore_score"] = remote_score
                        changed = True

            if _is_missing_grade(product.get("ecoscore_grade")):
                remote_grade = remote.get("ecoscore_grade")
                if not _is_missing_grade(remote_grade):
                    product["ecoscore_grade"] = str(remote_grade).strip().lower()
                    changed = True
                else:
                    missing_remote += 1

                if product.get("ecoscore_score") is None:
                    remote_score = _safe_int(remote.get("ecoscore_score"))
                    if remote_score is not None:
                        product["ecoscore_score"] = remote_score
                        changed = True

            if changed:
                updated += 1

            if attempted % 500 == 0:
                print(f"  Processed {attempted}/{len(candidates)} candidates, updated {updated}")

        await asyncio.gather(*(process(p) for p in candidates))

    return attempted, updated, missing_remote


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill missing Nutri/Eco scores in catalog.json")
    parser.add_argument("--catalog", default=CATALOG_PATH, help="Path to catalog.json")
    parser.add_argument(
        "--concurrency",
        type=int,
        default=16,
        help="Number of concurrent OpenFoodFacts requests (default: 16)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process up to N missing-score products (default: all)",
    )
    args = parser.parse_args()

    catalog_path = args.catalog
    if not os.path.exists(catalog_path):
        raise FileNotFoundError(f"Catalog not found: {catalog_path}")

    with open(catalog_path, "r", encoding="utf-8") as f:
        products = json.load(f)

    if not isinstance(products, list):
        raise ValueError("catalog.json is not a JSON array")

    total = len(products)
    missing_before = sum(1 for p in products if _needs_backfill(p))
    print(f"Loaded {total} products")
    print(f"Products needing backfill: {missing_before}")

    attempted, updated, missing_remote = asyncio.run(
        _backfill_async(products, concurrency=max(1, args.concurrency), limit=args.limit)
    )

    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    missing_after = sum(1 for p in products if _needs_backfill(p))
    print("\nBackfill complete")
    print(f"  Attempted: {attempted}")
    print(f"  Updated: {updated}")
    print(f"  Still missing (local): {missing_after}")
    print(f"  Missing from remote ecoscore field count: {missing_remote}")
    print(f"  Saved: {catalog_path}")


if __name__ == "__main__":
    main()

