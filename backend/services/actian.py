from cortex import CortexClient, DistanceMetric
from cortex.filters import Filter, Field
from config import ACTIAN_ADDRESS, EMBEDDING_DIM

_DUMMY_PRODUCTS = [
    {
        "product_code": "dummy-path-water",
        "product_name": "PATH Purified Water",
        "brands": "PATH",
        "categories": "Beverages, Water, Bottled Water",
        "categories_tags": '["en:beverages","en:waters","en:bottled-waters"]',
        "ecoscore_grade": "a",
        "ecoscore_score": 85,
        "packaging_tags": '["en:aluminum-bottle","en:reusable-packaging"]',
        "labels_tags": '["en:recyclable"]',
        "ingredients_text": "Purified water, electrolytes.",
        "palm_oil_count": 0,
        "nutrition_json": '{"energy-kcal_100g":0,"sugars_100g":0,"fat_100g":0,"saturated-fat_100g":0,"proteins_100g":0,"salt_100g":0}',
        "image_url": None,
    },
    {
        "product_code": "dummy-coke",
        "product_name": "Coca-Cola Original Taste",
        "brands": "Coca-Cola",
        "categories": "Beverages, Soft Drinks, Sodas",
        "categories_tags": '["en:beverages","en:soft-drinks","en:sodas"]',
        "ecoscore_grade": "d",
        "ecoscore_score": 35,
        "packaging_tags": '["en:plastic-bottle"]',
        "labels_tags": "[]",
        "ingredients_text": "Carbonated water, sugar, caramel color, phosphoric acid, natural flavors, caffeine.",
        "palm_oil_count": 0,
        "nutrition_json": '{"energy-kcal_100g":42,"sugars_100g":10.6,"fat_100g":0,"saturated-fat_100g":0,"proteins_100g":0,"salt_100g":0.01}',
        "image_url": None,
    },
    {
        "product_code": "dummy-la-croix",
        "product_name": "LaCroix Sparkling Water Lime",
        "brands": "LaCroix",
        "categories": "Beverages, Sparkling Water",
        "categories_tags": '["en:beverages","en:sparkling-waters"]',
        "ecoscore_grade": "a",
        "ecoscore_score": 82,
        "packaging_tags": '["en:can","en:aluminum"]',
        "labels_tags": "[]",
        "ingredients_text": "Carbonated water, natural flavor.",
        "palm_oil_count": 0,
        "nutrition_json": '{"energy-kcal_100g":0,"sugars_100g":0,"fat_100g":0,"saturated-fat_100g":0,"proteins_100g":0,"salt_100g":0}',
        "image_url": None,
    },
    {
        "product_code": "dummy-nutella",
        "product_name": "Nutella Hazelnut Spread",
        "brands": "Ferrero",
        "categories": "Spreads, Chocolate Spreads",
        "categories_tags": '["en:spreads","en:chocolate-spreads"]',
        "ecoscore_grade": "e",
        "ecoscore_score": 20,
        "packaging_tags": '["en:glass-jar"]',
        "labels_tags": "[]",
        "ingredients_text": "Sugar, palm oil, hazelnuts, cocoa, skim milk powder, lecithin, vanillin.",
        "palm_oil_count": 1,
        "nutrition_json": '{"energy-kcal_100g":539,"sugars_100g":56.3,"fat_100g":30.9,"saturated-fat_100g":10.6,"proteins_100g":6.3,"salt_100g":0.11}',
        "image_url": None,
    },
    {
        "product_code": "dummy-peanut-butter",
        "product_name": "Skippy Natural Peanut Butter",
        "brands": "Skippy",
        "categories": "Spreads, Peanut Butters",
        "categories_tags": '["en:spreads","en:peanut-butters"]',
        "ecoscore_grade": "c",
        "ecoscore_score": 58,
        "packaging_tags": '["en:plastic-jar"]',
        "labels_tags": '["en:vegetarian"]',
        "ingredients_text": "Roasted peanuts, sugar, palm oil, salt.",
        "palm_oil_count": 1,
        "nutrition_json": '{"energy-kcal_100g":588,"sugars_100g":8.2,"fat_100g":50.4,"saturated-fat_100g":10.4,"proteins_100g":22.0,"salt_100g":1.0}',
        "image_url": None,
    },
]


class ActianClient:
    def __init__(self, address: str):
        self._address = address
        self._client: CortexClient | None = None

    def connect(self):
        self._client = CortexClient(self._address)
        self._client.connect()
        version, uptime = self._client.health_check()
        print(f"Actian VectorDB: {version}, uptime={uptime}s")

    def ensure_collection(self):
        self._client.get_or_create_collection(
            name="products",
            dimension=EMBEDDING_DIM,
            distance_metric=DistanceMetric.COSINE,
        )

    def search_similar(self, embedding: list[float], top_k: int = 5) -> list[dict]:
        results = self._client.search(
            "products",
            query=embedding,
            top_k=top_k,
            with_payload=True,
        )
        return [
            {**r.payload, "similarity_score": r.score}
            for r in results
        ]

    def search_greener_alternatives(
        self,
        embedding: list[float],
        category: str,
        min_ecoscore: str = "b",
        top_k: int = 5,
    ) -> list[dict]:
        grade_set = []
        for g in ["a", "b", "c", "d", "e"]:
            grade_set.append(g)
            if g == min_ecoscore:
                break

        f = Filter().must(Field("ecoscore_grade").is_in(grade_set))

        results = self._client.search(
            "products",
            query=embedding,
            top_k=top_k,
            filter=f,
            with_payload=True,
        )
        return [
            {**r.payload, "similarity_score": r.score}
            for r in results
        ]

    def get_product(self, product_code: str) -> dict | None:
        f = Filter().must(Field("product_code").eq(product_code))
        records = self._client.query("products", filter=f, limit=1)
        if not records:
            return None
        return records[0].payload

    def get_product_with_vector(self, product_code: str) -> tuple[dict | None, list[float] | None]:
        f = Filter().must(Field("product_code").eq(product_code))
        records = self._client.query("products", filter=f, limit=1, with_vectors=True)
        if not records:
            return None, None
        return records[0].payload, records[0].vector

    def batch_upsert(self, ids: list[int], vectors: list[list[float]], payloads: list[dict]):
        self._client.batch_upsert("products", ids=ids, vectors=vectors, payloads=payloads)

    def seed_dummy_products_if_empty(self) -> bool:
        if self.count() > 0:
            return False

        from services.embeddings import embed_texts_batch

        texts = [p["product_name"] for p in _DUMMY_PRODUCTS]
        vectors = embed_texts_batch(texts)
        ids = list(range(len(_DUMMY_PRODUCTS)))
        self.batch_upsert(ids=ids, vectors=vectors, payloads=_DUMMY_PRODUCTS)
        return True

    def count(self) -> int:
        return self._client.count("products")

    def close(self):
        if self._client:
            self._client.close()
            self._client = None


actian_client = ActianClient(ACTIAN_ADDRESS)
