import { useNavigate } from 'react-router-dom';
import type { Product } from '../types';
import EcoScoreBadge from './EcoScoreBadge';
import { getUnifiedCategory } from '../lib/categoryIcon';

interface ProductCardProps {
  product_code: string;
  product_name: string;
  brands: string;
  nutriscore_grade?: string | null;
  ecoscore_grade: string | null;
  confidence?: number;
  fullProduct?: Product;
}

export default function ProductCard({
  product_code,
  product_name,
  brands,
  nutriscore_grade,
  ecoscore_grade,
  confidence,
  fullProduct,
}: ProductCardProps) {
  const navigate = useNavigate();
  const capturedImage = sessionStorage.getItem('capturedImage') || undefined;
  const { Icon } = getUnifiedCategory(fullProduct?.categories || '', product_name);

  return (
    <button
      onClick={() => navigate(`/product/${product_code}`, { state: { product: fullProduct, capturedImage } })}
      className="surface-card mx-auto flex w-full max-w-2xl items-center gap-4 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--line-soft)] bg-[var(--surface-100)]">
        <Icon className="h-7 w-7 text-[var(--ink-700)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-semibold text-[var(--ink-900)]">{product_name}</p>
        {brands && <p className="truncate text-sm text-[var(--ink-500)]">{brands}</p>}
        {confidence != null && (
          <p className="mt-1 text-xs font-medium text-[var(--ink-500)]">Match: {(confidence * 100).toFixed(0)}%</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--ink-400)]">Nutri</span>
          <EcoScoreBadge grade={nutriscore_grade ?? null} size="sm" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--ink-400)]">Eco</span>
          <EcoScoreBadge grade={ecoscore_grade} size="sm" />
        </div>
      </div>
    </button>
  );
}
