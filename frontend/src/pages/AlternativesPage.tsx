import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getRecommendations, getRecommendationsFromProduct } from '../lib/api';
import type { Product } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductCard from '../components/ProductCard';

export default function AlternativesPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [alternatives, setAlternatives] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const stateProduct = (location.state as { product?: Product } | null)?.product;
    const request = stateProduct
      ? getRecommendationsFromProduct(stateProduct)
      : getRecommendations(code);

    request
      .then(setAlternatives)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code, location.state]);

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <LoadingSpinner message="Finding greener alternatives..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <main className="app-shell flex flex-col items-center">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--ink-500)] transition hover:text-[var(--ink-700)]">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="glass-panel fade-up w-full max-w-4xl rounded-3xl p-5 md:p-6">
          <h2 className="hero-title text-center text-3xl text-[var(--ink-900)]">Greener Alternatives</h2>

          {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}

          {alternatives.length === 0 && !error ? (
            <p className="py-8 text-center text-[var(--ink-500)]">
              No greener alternatives found for this product category.
            </p>
          ) : (
            <div className="mt-5 flex flex-col items-center gap-3">
              {alternatives.map((alt) => (
                <ProductCard
                  key={alt.product_code}
                  product_code={alt.product_code}
                  product_name={alt.product_name}
                  brands={alt.brands}
                  ecoscore_grade={alt.ecoscore_grade}
                  confidence={alt.similarity_score}
                  image_url={alt.image_url}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
