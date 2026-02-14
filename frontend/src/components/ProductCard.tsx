import { useNavigate } from 'react-router-dom';
import type { Product } from '../types';
import EcoScoreBadge from './EcoScoreBadge';

interface ProductCardProps {
  product_code: string;
  product_name: string;
  brands: string;
  ecoscore_grade: string | null;
  confidence?: number;
  image_url?: string | null;
  fullProduct?: Product;
}

export default function ProductCard({
  product_code,
  product_name,
  brands,
  ecoscore_grade,
  confidence,
  image_url,
  fullProduct,
}: ProductCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/product/${product_code}`, { state: { product: fullProduct } })}
      className="surface-card mx-auto flex w-full max-w-2xl items-center gap-4 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {image_url ? (
        <img
          src={image_url}
          alt={product_name}
          className="h-16 w-16 rounded-xl border border-[var(--line-soft)] object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--line-soft)] bg-[#f6f8f4] text-lg font-bold text-[var(--ink-500)]">
          P
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate font-semibold text-[var(--ink-900)]">{product_name}</p>
        {brands && <p className="truncate text-sm text-[var(--ink-500)]">{brands}</p>}
        {confidence != null && (
          <p className="mt-1 text-xs font-medium text-[var(--ink-500)]">Match: {(confidence * 100).toFixed(0)}%</p>
        )}
      </div>
      <EcoScoreBadge grade={ecoscore_grade} size="sm" />
    </button>
  );
}
