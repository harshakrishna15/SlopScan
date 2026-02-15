const COLORS: Record<string, string> = {
  a: 'text-[#1E8F4E]',
  b: 'text-[#4DA924]',
  c: 'text-[#B78D00]',
  d: 'text-[#F6832A]',
  e: 'text-[#DC4A1F]',
};

export default function EcoScoreBadge({
  grade,
  score: _score,
  size = 'md',
  predicted: _predicted = false,
}: {
  grade: string | null;
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  predicted?: boolean;
}) {
  if (!grade) {
    return <span className="font-semibold text-[var(--ink-500)]">N/A</span>;
  }

  const g = grade.toLowerCase();
  const colorClass = COLORS[g] || 'text-gray-600';

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  return (
    <span className={`font-extrabold uppercase ${colorClass} ${sizeClasses[size]}`}>
      {g}
    </span>
  );
}
