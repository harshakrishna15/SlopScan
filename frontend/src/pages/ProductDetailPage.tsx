import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, AlertTriangle } from 'lucide-react';
import { getProduct, getExplanation } from '../lib/api';
import type { Product, ExplanationResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import EcoScoreBadge from '../components/EcoScoreBadge';
import NutritionTable from '../components/NutritionTable';

export default function ProductDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    getProduct(code)
      .then((data) => {
        setProduct(data);
        setLoading(false);
        // Load explanation async
        return getExplanation(code);
      })
      .then(setExplanation)
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner message="Loading product..." />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4">
        <p className="text-red-600">{error || 'Product not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-full bg-green-600 px-6 py-2 text-white hover:bg-green-700"
        >
          Back to Scanner
        </button>
      </div>
    );
  }

  const nutrition = typeof product.nutrition_json === 'string'
    ? JSON.parse(product.nutrition_json || '{}')
    : product.nutrition_json || {};

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 shadow-sm">
        <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-start gap-4">
          {product.image_url ? (
            <img src={product.image_url} alt={product.product_name} className="h-20 w-20 rounded-xl object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gray-100 text-3xl">📦</div>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{product.product_name}</h1>
            {product.brands && <p className="text-sm text-gray-500">{product.brands}</p>}
            <div className="mt-2">
              <EcoScoreBadge grade={product.ecoscore_grade} score={product.ecoscore_score} size="md" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Nutrition */}
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">Nutrition per 100g</h2>
          <NutritionTable nutrition={nutrition} />
        </section>

        {/* AI Explanation */}
        {explanation && (
          <>
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-gray-800">Nutrition Summary</h2>
              <p className="text-sm text-gray-600">{explanation.nutrition_summary}</p>
            </section>

            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-gray-800">Eco-Score Explained</h2>
              <p className="text-sm text-gray-600">{explanation.eco_explanation}</p>
            </section>

            {explanation.ingredient_flags.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-amber-800">
                  <AlertTriangle className="h-5 w-5" />
                  Ingredient Flags
                </h2>
                <ul className="list-disc pl-5 text-sm text-amber-700">
                  {explanation.ingredient_flags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-xl bg-green-50 p-4">
              <h2 className="mb-1 text-lg font-semibold text-green-800">Advice</h2>
              <p className="text-sm text-green-700">{explanation.advice}</p>
            </section>
          </>
        )}

        {!explanation && (
          <div className="py-4">
            <LoadingSpinner message="Generating AI analysis..." />
          </div>
        )}

        {/* Greener Alternatives CTA */}
        <button
          onClick={() => navigate(`/alternatives/${code}`)}
          className="flex items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-green-700"
        >
          <Leaf className="h-5 w-5" />
          Find Greener Alternatives
        </button>
      </div>
    </div>
  );
}
