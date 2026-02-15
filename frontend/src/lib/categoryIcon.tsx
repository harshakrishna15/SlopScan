import { Cookie, CupSoda, LeafyGreen, Package, UtensilsCrossed, type LucideIcon } from 'lucide-react';

export interface CategoryInfo {
  label: string;
  Icon: LucideIcon;
}

function parseCategoryTags(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).toLowerCase());
  if (typeof raw !== 'string') return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((t) => String(t).toLowerCase());
  } catch {
    // Not JSON; treat as CSV-ish fallback.
  }

  return raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

export function getUnifiedCategory(
  categories: string,
  categoriesTags?: string | string[] | null,
  productName?: string,
): CategoryInfo {
  const tags = parseCategoryTags(categoriesTags);
  const text = `${categories || ''} ${productName || ''}`.toLowerCase();

  const hasTagPrefix = (prefixes: string[]) =>
    tags.some((tag) => prefixes.some((prefix) => tag.startsWith(prefix)));

  if (
    hasTagPrefix(['en:beverages', 'en:waters', 'en:soft-drinks', 'en:juices', 'en:teas', 'en:coffees']) ||
    /(drink|beverage|water|soda|juice|tea|coffee|energy drink)/.test(text)
  ) {
    return { label: 'Drinks', Icon: CupSoda };
  }

  if (
    hasTagPrefix(['en:fruits', 'en:vegetables', 'en:salads', 'en:produce']) ||
    /(fruit|vegetable|veggie|salad|produce)/.test(text)
  ) {
    return { label: 'Fruits & Veg', Icon: LeafyGreen };
  }

  if (
    hasTagPrefix(['en:snacks', 'en:chips', 'en:biscuits', 'en:candies', 'en:chocolates']) ||
    /(snack|chips|cookie|cracker|candy|chocolate)/.test(text)
  ) {
    return { label: 'Snacks', Icon: Cookie };
  }

  if (
    hasTagPrefix(['en:prepared-meals', 'en:pizzas', 'en:sandwiches', 'en:frozen-foods', 'en:pastas', 'en:noodles', 'en:soups']) ||
    /(meal|dinner|lunch|breakfast|pizza|sandwich|pasta|noodle|soup)/.test(text)
  ) {
    return { label: 'Meals', Icon: UtensilsCrossed };
  }

  return { label: 'Other', Icon: Package };
}

