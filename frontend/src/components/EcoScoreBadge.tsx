const COLORS: Record<string, string> = {
  a: 'bg-[#1E8F4E] text-white',
  b: 'bg-[#60AC0E] text-white',
  c: 'bg-[#EEAE0E] text-gray-900',
  d: 'bg-[#FF6F1E] text-white',
  e: 'bg-[#E63E11] text-white',
};

export default function EcoScoreBadge({
  grade,
  score,
  size = 'md',
}: {
  grade: string | null;
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!grade) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        N/A
      </span>
    );
  }

  const g = grade.toLowerCase();
  const colorClass = COLORS[g] || 'bg-gray-200 text-gray-600';

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold uppercase ${colorClass} ${sizeClasses[size]}`}>
      {g}
      {score != null && <span className="font-normal opacity-80">({score})</span>}
    </span>
  );
}
