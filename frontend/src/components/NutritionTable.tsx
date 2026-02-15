interface Nutrition {
  'energy-kcal_100g'?: number | null;
  sugars_100g?: number | null;
  fat_100g?: number | null;
  'saturated-fat_100g'?: number | null;
  proteins_100g?: number | null;
  salt_100g?: number | null;
}

export default function NutritionTable({ nutrition }: { nutrition: Nutrition }) {
  const rows = [
    { label: 'Energy', value: nutrition['energy-kcal_100g'], unit: 'kcal' },
    { label: 'Sugars', value: nutrition.sugars_100g, unit: 'g' },
    { label: 'Fat', value: nutrition.fat_100g, unit: 'g' },
    { label: 'Saturated Fat', value: nutrition['saturated-fat_100g'], unit: 'g' },
    { label: 'Protein', value: nutrition.proteins_100g, unit: 'g' },
    { label: 'Salt', value: nutrition.salt_100g, unit: 'g' },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#f4f8f2]">
            <th className="px-4 py-2.5 text-left font-semibold text-[var(--ink-700)]">Nutrient</th>
            <th className="px-4 py-2.5 text-right font-semibold text-[var(--ink-700)]">Per 100g</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-[#edf2ec]">
              <td className="px-4 py-2.5 text-[var(--ink-700)]">{row.label}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-[var(--ink-900)]">
                {row.value != null ? `${Math.round(row.value * 10) / 10} ${row.unit}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
