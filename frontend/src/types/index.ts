export interface Product {
  product_code: string;
  product_name: string;
  brands: string;
  categories: string;
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

export interface IdentifyResponse {
  gemini_guesses: string[];
  best_match: {
    product_code: string;
    product_name: string;
    brands: string;
    confidence: number;
    ecoscore_grade: string | null;
  } | null;
  candidates: Array<{
    product_code: string;
    product_name: string;
    brands: string;
    confidence: number;
    ecoscore_grade: string | null;
  }>;
  needs_confirmation: boolean;
}

export interface ExplanationResponse {
  nutrition_summary: string;
  eco_explanation: string;
  ingredient_flags: string[];
  advice: string;
}
