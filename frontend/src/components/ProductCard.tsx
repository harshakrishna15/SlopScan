import { useNavigate } from 'react-router-dom';
import EcoScoreBadge from './EcoScoreBadge';

interface ProductCardProps {
  product_code: string;
  product_name: string;
  brands: string;
  ecoscore_grade: string | null;
  confidence?: number;
  image_url?: string | null;
}

export default function ProductCard({
  product_code,
  product_name,
  brands,
  ecoscore_grade,
  confidence,
  image_url,
}: ProductCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/product/${product_code}`)}
      className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
    >
      {image_url ? (
        <img
          src={image_url}
          alt={product_name}
          className="h-16 w-16 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-2xl">
          📦
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate font-semibold text-gray-900">{product_name}</p>
        {brands && <p className="truncate text-sm text-gray-500">{brands}</p>}
        {confidence != null && (
          <p className="text-xs text-gray-400">Match: {(confidence * 100).toFixed(0)}%</p>
        )}
      </div>
      <EcoScoreBadge grade={ecoscore_grade} size="sm" />
    </button>
  );
}
