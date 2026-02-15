import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Leaf, AlertTriangle } from 'lucide-react';
import { getProduct, getExplanation, getExplanationFromProduct } from '../lib/api';
import type { Product, ExplanationResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import EcoScoreBadge from '../components/EcoScoreBadge';
import NutritionTable from '../components/NutritionTable';
import { saveScanHistory } from '../lib/history';

export default function ProductDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const historySavedRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    historySavedRef.current = false;
    setLoading(true);
    setError(null);
    setExplanation(null);
    setProduct(null);

    // Use product data passed via router state (from search results) to avoid
    // re-querying by product_code which can return the wrong record if codes are duplicated.
    const stateProduct = (location.state as { product?: Product })?.product;
    if (stateProduct) {
      setProduct(stateProduct);
      setLoading(false);
      return;
    }

    getProduct(code)
      .then((data) => setProduct(data))
      .catch((e) => {
        setError(e.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [code, location.state]);

  useEffect(() => {
    if (!code || !product) return;

    // Check if explanation was already fetched (passed from ResultsPage)
    const stateExplanation = (location.state as { explanation?: ExplanationResponse })?.explanation;
    if (stateExplanation) {
      console.log('[ProductDetailPage] Using pre-fetched explanation from state');
      setExplanation(stateExplanation);
      return;
    }

    // Otherwise fetch it
    const request = product
      ? getExplanationFromProduct(product)
      : getExplanation(code);

    request
      .then((data) => {
        console.log('[ProductDetailPage] Explanation received:', data);
        console.log('[ProductDetailPage] Predicted scores:', {
          nutriscore: data.predicted_nutriscore,
          ecoscore: data.predicted_ecoscore
        });
        setExplanation(data);
      })
      .catch(() => {
        // Keep product/nutrition visible even if explanation fails.
        setExplanation(null);
      });
  }, [code, product, location.state]);

  useEffect(() => {
    if (!product || historySavedRef.current) return;

    const pendingSave = sessionStorage.getItem('pendingScanHistorySave');

    if (pendingSave === '1') {
      saveScanHistory(product);
      historySavedRef.current = true;
      sessionStorage.removeItem('pendingScanHistorySave');
      sessionStorage.removeItem('capturedImage');
      sessionStorage.removeItem('capturedImageName');
    }
  }, [product]);

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <LoadingSpinner message="Loading product..." />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error || 'Product not found'}</p>
        <button
          onClick={() => navigate('/scan')}
          className="ui-btn btn-primary"
        >
          Back to Scanner
        </button>
      </div>
    );
  }

  let nutrition = {};
  if (typeof product.nutrition_json === 'string') {
    try {
      nutrition = JSON.parse(product.nutrition_json || '{}');
    } catch {
      nutrition = {};
    }
  } else {
    nutrition = product.nutrition_json || {};
  }

  return (
    <div className="min-h-screen px-4 py-8 pb-24">
      <main className="app-shell space-y-5">
        <section className="glass-panel fade-up mx-auto w-full max-w-4xl rounded-3xl p-5 md:p-6">
          <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--ink-500)] transition hover:text-[var(--ink-700)]">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-start gap-4">
            {product.image_url ? (
              <img src={product.image_url} alt={product.product_name} className="h-20 w-20 rounded-2xl border border-white/60 object-cover shadow-sm" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-100)] text-3xl">🛒</div>
            )}
            <div className="flex-1">
              <h1 className="hero-title text-3xl leading-tight text-[var(--ink-900)]">{product.product_name}</h1>
              {product.brands && <p className="mt-1 text-sm text-[var(--ink-500)]">{product.brands}</p>}
            </div>
          </div>
        </section>

        <section className="surface-card fade-up mx-auto w-full max-w-4xl rounded-2xl p-4 md:p-5">
          <h2 className="mb-3 text-lg font-semibold text-[var(--ink-900)]">Nutri-Score</h2>
          <EcoScoreBadge
            grade={product.nutriscore_grade || explanation?.predicted_nutriscore || null}
            size="md"
            predicted={!product.nutriscore_grade && !!explanation?.predicted_nutriscore}
          />
        </section>

        <section className="surface-card fade-up mx-auto w-full max-w-4xl rounded-2xl p-4 md:p-5">
          <h2 className="mb-3 text-lg font-semibold text-[var(--ink-900)]">Eco-Score</h2>
          <EcoScoreBadge
            grade={product.ecoscore_grade || explanation?.predicted_ecoscore || null}
            score={product.ecoscore_score}
            size="md"
            predicted={!product.ecoscore_grade && !!explanation?.predicted_ecoscore}
          />
        </section>

        <section className="surface-card fade-up mx-auto w-full max-w-4xl rounded-2xl p-4 md:p-5">
          <h2 className="mb-3 text-lg font-semibold text-[var(--ink-900)]">Nutrition per 100g</h2>
          <NutritionTable nutrition={nutrition} />
        </section>

        {explanation && (
          <>
            <section className="surface-card fade-up mx-auto w-full max-w-4xl rounded-2xl p-4 md:p-5">
              <h2 className="mb-2 text-lg font-semibold text-[var(--ink-900)]">Nutrition Summary</h2>
              <p className="text-sm leading-6 text-[var(--ink-700)]">{explanation.nutrition_summary}</p>
            </section>

            <section className="surface-card fade-up mx-auto w-full max-w-4xl rounded-2xl p-4 md:p-5">
              <h2 className="mb-2 text-lg font-semibold text-[var(--ink-900)]">Eco-Score Explained</h2>
              <p className="text-sm leading-6 text-[var(--ink-700)]">{explanation.eco_explanation}</p>
            </section>

            {Array.isArray(explanation.ingredient_flags) && explanation.ingredient_flags.length > 0 && (
              <section className="fade-up mx-auto w-full max-w-4xl rounded-2xl border border-amber-200 bg-amber-50/90 p-4 md:p-5">
                <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-amber-900">
                  <AlertTriangle className="h-5 w-5" />
                  Ingredient Flags
                </h2>
                <ul className="list-disc pl-5 text-sm leading-6 text-amber-800">
                  {explanation.ingredient_flags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="fade-up mx-auto w-full max-w-4xl rounded-2xl border border-green-200 bg-green-50/90 p-4 md:p-5">
              <h2 className="mb-1 text-lg font-semibold text-green-900">Advice</h2>
              <p className="text-sm leading-6 text-green-800">{explanation.advice}</p>
            </section>
          </>
        )}

        {!explanation && (
          <div className="surface-card mx-auto w-full max-w-4xl rounded-2xl py-4">
            <LoadingSpinner message="Generating AI analysis..." />
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={() => navigate(`/alternatives/${code}`, { state: { product } })}
            className="ui-btn btn-primary fade-up w-full max-w-4xl py-3.5 text-base"
          >
            <Leaf className="h-5 w-5" />
            Find Greener Alternatives
          </button>
        </div>
      </main>
    </div>
  );
}
