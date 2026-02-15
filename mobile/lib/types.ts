export interface Product {
  product_code: string;
  product_name: string;
  brands: string;
  categories: string;
  nutriscore_grade: string | null;
  ecoscore_grade: string | null;
  ecoscore_score: number | null;
  packaging_tags: string;
  labels_tags: string;
  ingredients_text: string;
  palm_oil_count: number;
  nutrition_json: string;
  image_url: string | null;
  similarity_score?: number;
}

export type CategoryIcon =
  | 'pizza' | 'cafe' | 'beer' | 'wine' | 'fish' | 'nutrition' | 'restaurant'
  | 'fast-food' | 'ice-cream' | 'water' | 'egg' | 'leaf' | 'flower' | 'basket' | 'cart';

export interface IdentifyResponse {
  gemini_guesses: string[];
  best_match: {
    product_code: string;
    product_name: string;
    brands: string;
    confidence: number;
    ecoscore_grade: string | null;
  } | null;
  best_match_explanation?: ExplanationResponse | null;
  candidates: Array<Product & { confidence: number }>;
  needs_confirmation: boolean;
  category_icon?: CategoryIcon;
}

export interface ExplanationResponse {
  nutrition_summary: string;
  eco_explanation: string;
  ingredient_flags: string[];
  advice: string;
  predicted_nutriscore?: string | null;
  predicted_ecoscore?: string | null;
}

export interface ScanHistoryEntry {
  id: string;
  saved_at: string;
  product_code: string;
  product_name: string;
  brands: string;
  nutriscore_grade: string | null;
  ecoscore_grade: string | null;
  ecoscore_score: number | null;
  product_image_url: string | null;
  product?: Product;
  category_icon?: CategoryIcon;
}
