import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { identifyProduct } from '../lib/api';
import type { IdentifyResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductCard from '../components/ProductCard';

export default function ResultsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IdentifyResponse | null>(null);

  useEffect(() => {
    const imageData = sessionStorage.getItem('capturedImage');
    const imageName = sessionStorage.getItem('capturedImageName') || 'capture.jpg';

    if (!imageData) {
      navigate('/scan');
      return;
    }

    // Convert base64 back to File
    fetch(imageData)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], imageName, { type: blob.type || 'image/jpeg' });
        return identifyProduct(file);
      })
      .then((data) => {
        setResult(data);
        // Auto-navigate if confident match
        if (!data.needs_confirmation && data.best_match && data.candidates.length > 0) {
          navigate(`/product/${data.best_match.product_code}`, {
            replace: true,
            state: { product: data.candidates[0] },
          });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <LoadingSpinner message="Identifying product..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>
        <button
          onClick={() => navigate('/scan')}
          className="ui-btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!result || !result.candidates.length) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="max-w-md text-center text-[var(--ink-700)]">
          Product not found. Try a clearer photo or a different product.
        </p>
        <button
          onClick={() => navigate('/scan')}
          className="ui-btn btn-primary"
        >
          Retake Photo
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <main className="app-shell flex flex-col items-center">
        <button onClick={() => navigate('/scan')} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--ink-500)] transition hover:text-[var(--ink-700)]">
          <ArrowLeft className="h-4 w-4" />
          Retake Photo
        </button>

        <section className="glass-panel fade-up w-full max-w-4xl rounded-3xl p-5 md:p-6">
          <h2 className="hero-title text-center text-3xl text-[var(--ink-900)]">Select your product</h2>

          {result.gemini_guesses.length > 0 && (
            <p className="mt-1 text-center text-sm text-[var(--ink-500)]">
              Likely match: {result.gemini_guesses[0]}
            </p>
          )}

          <div className="mt-5 flex flex-col items-center gap-3">
            {result.candidates.map((c) => (
              <ProductCard
                key={c.product_code}
                product_code={c.product_code}
                product_name={c.product_name}
                brands={c.brands}
                nutriscore_grade={c.nutriscore_grade}
                ecoscore_grade={c.ecoscore_grade}
                confidence={c.confidence}
                fullProduct={c}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
