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
      navigate('/');
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
        if (!data.needs_confirmation && data.best_match) {
          navigate(`/product/${data.best_match.product_code}`, { replace: true });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <LoadingSpinner message="Identifying product..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-full bg-green-600 px-6 py-2 text-white hover:bg-green-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!result || !result.candidates.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4">
        <p className="text-center text-gray-600">
          Product not found. Try a clearer photo or a different product.
        </p>
        <button
          onClick={() => navigate('/')}
          className="rounded-full bg-green-600 px-6 py-2 text-white hover:bg-green-700"
        >
          Retake Photo
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <button onClick={() => navigate('/')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Retake Photo
      </button>

      <h2 className="mb-2 text-xl font-bold text-gray-900">Select Your Product</h2>

      {result.gemini_guesses.length > 0 && (
        <p className="mb-4 text-sm text-gray-500">
          We think it might be: {result.gemini_guesses[0]}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {result.candidates.map((c) => (
          <ProductCard
            key={c.product_code}
            product_code={c.product_code}
            product_name={c.product_name}
            brands={c.brands}
            ecoscore_grade={c.ecoscore_grade}
            confidence={c.confidence}
          />
        ))}
      </div>
    </div>
  );
}
