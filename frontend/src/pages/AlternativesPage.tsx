import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getRecommendations } from '../lib/api';
import type { Product } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductCard from '../components/ProductCard';

export default function AlternativesPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [alternatives, setAlternatives] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    getRecommendations(code)
      .then(setAlternatives)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner message="Finding greener alternatives..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <h2 className="mb-4 text-xl font-bold text-gray-900">Greener Alternatives</h2>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {alternatives.length === 0 && !error ? (
        <p className="text-center text-gray-500 py-8">
          No greener alternatives found for this product category.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
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
    </div>
  );
}
