import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Leaf, AlertTriangle } from 'lucide-react';
import { getProduct, getExplanation, getExplanationFromProduct } from '../lib/api';
import type { Product, ExplanationResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import EcoScoreBadge from '../components/EcoScoreBadge';
import NutritionTable from '../components/NutritionTable';
import { saveScanHistory } from '../lib/history';
import { getUnifiedCategory } from '../lib/categoryIcon';

function explanationCacheKey(code: string) {
  return `slopscan_explanation_${code}`;
}

function readCachedExplanation(code: string): ExplanationResponse | null {
  try {
    const raw = sessionStorage.getItem(explanationCacheKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ExplanationResponse;
  } catch {
    return null;
  }
}

function writeCachedExplanation(code: string, value: ExplanationResponse) {
  try {
    sessionStorage.setItem(explanationCacheKey(code), JSON.stringify(value));
  } catch {
    // Ignore quota/storage failures.
  }
}

function cleanExplanationText(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Remove common model-added section labels so body text reads naturally.
  return trimmed
    .replace(/^(nutrition\s*summary|eco[-\s]*score\s*explained|eco\s*explanation)\s*[:\-]\s*/i, '')
    .trim();
}

export default function ProductDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [lockedSummaryText, setLockedSummaryText] = useState('');
  const [lockedEcoText, setLockedEcoText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const historySavedRef = useRef(false);
  const explanationCodeRef = useRef<string | undefined>(code);
  const explanationLockedToStateRef = useRef(false);
  const explanationTextFinalizedRef = useRef(false);
  const routeStateRef = useRef<{ product?: Product; explanation?: ExplanationResponse } | null>(null);

  useEffect(() => {
    if (!code) return;
    let canceled = false;
    historySavedRef.current = false;
    explanationCodeRef.current = code;
    const state = location.state as { product?: Product; explanation?: ExplanationResponse } | null;
    routeStateRef.current = state;
    const stateProduct = state?.product;
    const stateExplanation = state?.explanation;
    const cachedExplanation = readCachedExplanation(code);
    const initialExplanation = stateExplanation || cachedExplanation;

    setLoading(true);
    setError(null);
    explanationLockedToStateRef.current = !!initialExplanation;
    explanationTextFinalizedRef.current = !!initialExplanation;
    setExplanation(initialExplanation || null);
    const initialSummary = cleanExplanationText(initialExplanation?.nutrition_summary);
    const initialEco = cleanExplanationText(initialExplanation?.eco_explanation);
    setLockedSummaryText(initialSummary);
    setLockedEcoText(initialEco);
    setProduct(null);

    if (stateExplanation) {
      writeCachedExplanation(code, stateExplanation);
    }

    // Use product data passed via router state (from search results) to avoid
    // re-querying by product_code which can return the wrong record if codes are duplicated.
    if (stateProduct) {
      setProduct(stateProduct);
      setLoading(false);
      return () => {
        canceled = true;
      };
    }

    getProduct(code)
      .then((data) => {
        if (canceled) return;
        setProduct(data);
      })
      .catch((e) => {
        if (canceled) return;
        setError(e.message);
      })
      .finally(() => {
        if (canceled) return;
        setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!code || !product) return;
    let canceled = false;

    // Check if explanation was already fetched (passed from ResultsPage)
    const stateExplanation = routeStateRef.current?.explanation;
    if (stateExplanation) {
      console.log('[ProductDetailPage] Using pre-fetched explanation from state');
      explanationLockedToStateRef.current = true;
      explanationTextFinalizedRef.current = true;
      writeCachedExplanation(code, stateExplanation);
      setExplanation(stateExplanation);
      setLockedSummaryText(cleanExplanationText(stateExplanation.nutrition_summary));
      setLockedEcoText(cleanExplanationText(stateExplanation.eco_explanation));
      return () => {
        canceled = true;
      };
    }

    if (explanationLockedToStateRef.current || explanationTextFinalizedRef.current) {
      return () => {
        canceled = true;
      };
    }

    // Otherwise fetch it
    const request = product
      ? getExplanationFromProduct(product)
      : getExplanation(code);

    request
      .then((data) => {
        if (canceled) return;
        if (explanationCodeRef.current !== code) return;
        if (explanationLockedToStateRef.current) return;
        if (explanationTextFinalizedRef.current) return;
        console.log('[ProductDetailPage] Explanation received:', data);
        console.log('[ProductDetailPage] Predicted scores:', {
          nutriscore: data.predicted_nutriscore,
          ecoscore: data.predicted_ecoscore
        });
        writeCachedExplanation(code, data);
        explanationLockedToStateRef.current = true;
        explanationTextFinalizedRef.current = true;
        setExplanation(data);
        setLockedSummaryText(cleanExplanationText(data.nutrition_summary));
        setLockedEcoText(cleanExplanationText(data.eco_explanation));
      })
      .catch(() => {
        if (canceled) return;
        if (explanationCodeRef.current !== code) return;
        // Keep product/nutrition visible even if explanation fails.
        setExplanation(null);
      });

    return () => {
      canceled = true;
    };
  }, [code, product]);

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

  const currentExplanation = explanationCodeRef.current === code ? explanation : null;
  const nutritionSummaryText = lockedSummaryText;
  const ecoExplanationText = lockedEcoText;
  const { Icon: CategoryIcon } = getUnifiedCategory(
    product.categories || '',
    product.categories_tags,
    product.product_name,
  );

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
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-100)] text-[var(--ink-600)]">
                <CategoryIcon className="h-9 w-9" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="hero-title text-3xl leading-tight text-[var(--ink-900)]">{product.product_name}</h1>
              {product.brands && <p className="mt-1 text-sm text-[var(--ink-500)]">{product.brands}</p>}
            </div>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
          <section className="surface-card fade-up rounded-2xl p-4 md:p-5">
            {(() => {
              const dbGrade = product.nutriscore_grade === 'unknown' ? null : product.nutriscore_grade;
              const grade = dbGrade || currentExplanation?.predicted_nutriscore || null;
              const predicted = !dbGrade && !!currentExplanation?.predicted_nutriscore;
              return (
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[var(--ink-900)]">Nutri-Score</h2>
                  <EcoScoreBadge grade={grade} size="md" predicted={predicted} />
                </div>
              );
            })()}
          </section>

          <section className="surface-card fade-up rounded-2xl p-4 md:p-5">
            {(() => {
              const dbGrade = product.ecoscore_grade === 'unknown' ? null : product.ecoscore_grade;
              const grade = dbGrade || currentExplanation?.predicted_ecoscore || null;
              const predicted = !dbGrade && !!currentExplanation?.predicted_ecoscore;
              return (
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[var(--ink-900)]">Eco-Score</h2>
                  <EcoScoreBadge
                    grade={grade}
                    score={product.ecoscore_score}
                    size="md"
                    predicted={predicted}
                  />
                </div>
              );
            })()}
          </section>
        </div>

        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
          <section className="surface-card fade-up rounded-2xl p-4 md:p-5">
            <h2 className="mb-2 text-lg font-semibold text-[var(--ink-900)]">Nutrition Summary</h2>
            <p
              className="text-fade-in text-sm leading-6 text-[var(--ink-700)]"
            >
              {nutritionSummaryText || 'Generating nutrition summary...'}
            </p>
          </section>

          <section className="surface-card fade-up rounded-2xl p-4 md:p-5">
            <h2 className="mb-2 text-lg font-semibold text-[var(--ink-900)]">Eco-Score Explained</h2>
            <p
              className="text-fade-in text-sm leading-6 text-[var(--ink-700)]"
            >
              {ecoExplanationText || 'Generating eco-score explanation...'}
            </p>
          </section>
        </div>

        {currentExplanation && Array.isArray(currentExplanation.ingredient_flags) && currentExplanation.ingredient_flags.length > 0 && (
          <section className="fade-up mx-auto w-full max-w-4xl rounded-2xl border border-amber-200 bg-amber-50/90 p-4 md:p-5">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              Ingredient Flags
            </h2>
            <ul className="list-disc pl-5 text-sm leading-6 text-amber-800">
              {currentExplanation.ingredient_flags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="surface-card fade-up mx-auto w-full max-w-4xl rounded-2xl p-4 md:p-5">
          <h2 className="mb-3 text-lg font-semibold text-[var(--ink-900)]">Nutrition per 100g</h2>
          <NutritionTable nutrition={nutrition} />
        </section>

        {currentExplanation && (
          <>
            <section className="fade-up mx-auto w-full max-w-4xl rounded-2xl border border-green-200 bg-green-50/90 p-4 md:p-5">
              <h2 className="mb-1 text-lg font-semibold text-green-900">Advice</h2>
              <p className="text-sm leading-6 text-green-800">{currentExplanation.advice}</p>
            </section>
          </>
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
