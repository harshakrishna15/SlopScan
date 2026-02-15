import type { IdentifyResponse, Product, ExplanationResponse } from '../types';

export async function identifyProduct(imageFile: File): Promise<IdentifyResponse> {
  const formData = new FormData();
  formData.append('image', imageFile);
  const res = await fetch('/api/identify', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Identify failed: ${res.status}`);
  return res.json();
}

export async function getProduct(code: string): Promise<Product> {
  const res = await fetch(`/api/product/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`Product not found: ${res.status}`);
  return res.json();
}

export async function getRecommendations(code: string): Promise<Product[]> {
  const res = await fetch(`/api/recommend/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`Recommendations failed: ${res.status}`);
  return res.json();
}

export async function getRecommendationsFromProduct(product: Product): Promise<Product[]> {
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_code: product.product_code,
      product_name: product.product_name,
      brands: product.brands,
      categories: product.categories,
      ecoscore_grade: product.ecoscore_grade,
    }),
  });
  if (!res.ok) throw new Error(`Recommendations failed: ${res.status}`);
  return res.json();
}

function _parseExplanation(raw: Record<string, unknown>): ExplanationResponse {
  const normalizeGrade = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const g = value.trim().toLowerCase();
    return ['a', 'b', 'c', 'd', 'e'].includes(g) ? g : null;
  };

  return {
    nutrition_summary: typeof raw?.nutrition_summary === 'string' ? raw.nutrition_summary : 'No nutrition summary available.',
    eco_explanation: typeof raw?.eco_explanation === 'string' ? raw.eco_explanation : 'Eco explanation unavailable.',
    ingredient_flags: Array.isArray(raw?.ingredient_flags)
      ? raw.ingredient_flags.filter((f: unknown) => typeof f === 'string')
      : [],
    advice: typeof raw?.advice === 'string' ? raw.advice : 'No advice available.',
    predicted_nutriscore: normalizeGrade(raw?.predicted_nutriscore),
    predicted_ecoscore: normalizeGrade(raw?.predicted_ecoscore),
  };
}

export async function getExplanation(code: string): Promise<ExplanationResponse> {
  const res = await fetch(`/api/explain/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`Explanation failed: ${res.status}`);
  return _parseExplanation(await res.json());
}

export async function getExplanationFromProduct(product: Product): Promise<ExplanationResponse> {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) throw new Error(`Explanation failed: ${res.status}`);
  return _parseExplanation(await res.json());
}
