import { Cookie, CupSoda, UtensilsCrossed, LeafyGreen, type LucideIcon } from 'lucide-react';

export interface CategoryInfo {
  label: string;
  Icon: LucideIcon;
}

export function getUnifiedCategory(categories: string, productName: string): CategoryInfo {
  const text = `${categories || ''} ${productName || ''}`.toLowerCase();

  if (/(drink|beverage|soda|juice|water|tea|coffee|smoothie)/.test(text)) {
    return { label: 'Drinks', Icon: CupSoda };
  }
  if (/(meal|dinner|lunch|breakfast|pasta|rice|entree|pizza|sandwich|ready meal|frozen)/.test(text)) {
    return { label: 'Meals', Icon: UtensilsCrossed };
  }
  if (/(fruit|fruits|vegetable|vegetables|veggie|produce|salad)/.test(text)) {
    return { label: 'Fruits & Veg', Icon: LeafyGreen };
  }

  return { label: 'Snacks', Icon: Cookie };
}
