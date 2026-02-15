"""
Backfill missing Nutri-Score / Eco-Score directly in the existing Actian collection.

This updates payloads in-place (no collection rebuild).

Usage:
  python scripts/backfill_scores_db.py
  python scripts/backfill_scores_db.py --concurrency 16 --limit 3000
  python scripts/backfill_scores_db.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cortex import CortexClient
from config import ACTIAN_ADDRESS

COLLECTION = "products"
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


def _record_id(record: Any) -> int | None:
    # SDK objects usually expose .id
    rid = getattr(record, "id", None)
    if rid is not None:
        try:
            return int(rid)
        except (TypeError, ValueError):
            pass

    # Fallback for dict-like variants.
    if isinstance(record, dict):
        for key in ("id", "point_id"):
            if key in record:
                try:
                    return int(record[key])
                except (TypeError, ValueError):
                    continue
    return None


def _record_payload(record: Any) -> dict[str, Any]:
    payload = getattr(record, "payload", None)
    if isinstance(payload, dict):
        return payload
    if isinstance(record, dict):
        maybe = record.get("payload")
        if isinstance(maybe, dict):
            return maybe
        # Some SDK variants flatten payload keys.
        return record
    return {}


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
            # Compatibility fallback
            r = await client.get(OFF_V0_URL.format(code=code))
            if r.status_code == 200:
                data = r.json()
                product = data.get("product")
                if isinstance(product, dict):
                    return product
        except httpx.HTTPError:
            await asyncio.sleep(0.25)
    return None


def _iter_collection_records(db_client: CortexClient, limit: int | None) -> list[tuple[int, dict[str, Any]]]:
    records_out: list[tuple[int, dict[str, Any]]] = []
    cursor = None
    page_size = 500

    while True:
        records, cursor = db_client.scroll(COLLECTION, limit=page_size, cursor=cursor)
        if not records:
            break
        for r in records:
            rid = _record_id(r)
            payload = _record_payload(r)
            if rid is None or not isinstance(payload, dict):
                continue
            records_out.append((rid, payload))
            if limit is not None and len(records_out) >= limit:
                return records_out
        if cursor is None:
            break

    return records_out


async def _run_backfill(
    targets: list[tuple[int, dict[str, Any]]],
    concurrency: int,
) -> list[tuple[int, dict[str, Any]]]:
    semaphore = asyncio.Semaphore(concurrency)
    updates: list[tuple[int, dict[str, Any]]] = []
    processed = 0
    progress_every = 200
    lock = asyncio.Lock()

    timeout = httpx.Timeout(20.0, connect=10.0)
    headers = {"User-Agent": "sfhacks2026-db-score-backfill/1.0"}

    async with httpx.AsyncClient(timeout=timeout, headers=headers) as http_client:
        async def process(item: tuple[int, dict[str, Any]]) -> None:
            nonlocal processed
            rid, payload = item
            code = str(payload.get("product_code") or "").strip()
            if not code:
                async with lock:
                    processed += 1
                return

            missing_nutri = _is_missing_grade(payload.get("nutriscore_grade"))
            missing_eco = _is_missing_grade(payload.get("ecoscore_grade"))
            if not (missing_nutri or missing_eco):
                async with lock:
                    processed += 1
                return

            async with semaphore:
                remote = await _fetch_product_scores(http_client, code)
            if not remote:
                async with lock:
                    processed += 1
                    if processed % progress_every == 0 or processed == len(targets):
                        pct = (processed / len(targets)) * 100 if targets else 100
                        print(
                            f"  Backfill progress: {processed}/{len(targets)} "
                            f"({pct:.1f}%), updates found={len(updates)}"
                        )
                return

            patch: dict[str, Any] = {}
            if missing_nutri:
                g = remote.get("nutriscore_grade")
                if not _is_missing_grade(g):
                    patch["nutriscore_grade"] = str(g).strip().lower()
                if payload.get("nutriscore_score") is None:
                    s = _safe_int(remote.get("nutriscore_score"))
                    if s is not None:
                        patch["nutriscore_score"] = s

            if missing_eco:
                g = remote.get("ecoscore_grade")
                if not _is_missing_grade(g):
                    patch["ecoscore_grade"] = str(g).strip().lower()
                if payload.get("ecoscore_score") is None:
                    s = _safe_int(remote.get("ecoscore_score"))
                    if s is not None:
                        patch["ecoscore_score"] = s

            if patch:
                async with lock:
                    updates.append((rid, patch))

            async with lock:
                processed += 1
                if processed % progress_every == 0 or processed == len(targets):
                    pct = (processed / len(targets)) * 100 if targets else 100
                    print(
                        f"  Backfill progress: {processed}/{len(targets)} "
                        f"({pct:.1f}%), updates found={len(updates)}"
                    )

        await asyncio.gather(*(process(t) for t in targets))

    return updates


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill missing scores directly in Actian DB payloads")
    parser.add_argument("--concurrency", type=int, default=12, help="Concurrent OFF requests (default: 12)")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N records from collection")
    parser.add_argument("--dry-run", action="store_true", help="Show counts but do not write updates")
    args = parser.parse_args()

    print(f"Connecting to Actian at {ACTIAN_ADDRESS}...")
    with CortexClient(ACTIAN_ADDRESS) as db:
        version, uptime = db.health_check()
        print(f"Connected: {version}, uptime={uptime}s")

        print("Scanning collection via scroll...")
        items = _iter_collection_records(db, limit=args.limit)
        print(f"Loaded {len(items)} records from collection '{COLLECTION}'")

        targets = []
        for rid, payload in items:
            if _is_missing_grade(payload.get("nutriscore_grade")) or _is_missing_grade(
                payload.get("ecoscore_grade")
            ):
                targets.append((rid, payload))
        print(f"Records needing score backfill: {len(targets)}")

        updates = asyncio.run(_run_backfill(targets, concurrency=max(1, args.concurrency)))
        print(f"Resolved updates from OpenFoodFacts: {len(updates)}")

        if args.dry_run:
            print("Dry run enabled. No DB writes performed.")
            return

        applied = 0
        for rid, patch in updates:
            # set_payload merges these keys into existing payload.
            db.set_payload(COLLECTION, rid, patch)
            applied += 1
            if applied % 500 == 0:
                print(f"  Applied {applied}/{len(updates)} payload updates")

        print(f"Done. Applied {applied} payload updates in-place.")


if __name__ == "__main__":
    main()
