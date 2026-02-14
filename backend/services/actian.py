from cortex import CortexClient, DistanceMetric
from cortex.filters import Filter, Field
from config import ACTIAN_ADDRESS, EMBEDDING_DIM


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

    def count(self) -> int:
        return self._client.count("products")

    def close(self):
        if self._client:
            self._client.close()
            self._client = None


actian_client = ActianClient(ACTIAN_ADDRESS)
