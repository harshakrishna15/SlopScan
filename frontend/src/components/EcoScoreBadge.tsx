const COLORS: Record<string, string> = {
  a: 'bg-[#1E8F4E] text-white',
  b: 'bg-[#4DA924] text-white',
  c: 'bg-[#DEB314] text-[#3f3200]',
  d: 'bg-[#F6832A] text-white',
  e: 'bg-[#DC4A1F] text-white',
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
      <span className="inline-flex items-center rounded-full border border-[var(--line-soft)] bg-[#f0f4ef] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink-500)]">
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
    <span className={`inline-flex items-center gap-1 rounded-full border border-black/5 font-extrabold uppercase shadow-sm ${colorClass} ${sizeClasses[size]}`}>
      {g}
      {score != null && <span className="font-normal opacity-80">({score})</span>}
    </span>
  );
}
