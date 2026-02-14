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
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left font-medium text-gray-600">Nutrient</th>
            <th className="px-4 py-2 text-right font-medium text-gray-600">Per 100g</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <td className="px-4 py-2 text-gray-700">{row.label}</td>
              <td className="px-4 py-2 text-right text-gray-900">
                {row.value != null ? `${row.value} ${row.unit}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
