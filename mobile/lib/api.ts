import type { IdentifyResponse, Product, ExplanationResponse } from './types';

// ngrok tunnel to backend. Re-run `ngrok http 8000` and update if URL changes.
const API_BASE_URL = 'https://unjuvenile-disillusive-maryrose.ngrok-free.dev';

export function setApiBaseUrl(url: string) {
  (globalThis as any).__shelfscan_api_url = url;
}

function getBaseUrl(): string {
  return (globalThis as any).__shelfscan_api_url || API_BASE_URL;
}

export async function identifyProduct(imageUri: string): Promise<IdentifyResponse> {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'capture.jpg',
  } as any);

  const res = await fetch(`${getBaseUrl()}/api/identify?skip_explanation=true`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  if (!res.ok) throw new Error(`Identify failed: ${res.status}`);
  return res.json();
}

export async function getProduct(code: string): Promise<Product> {
  const res = await fetch(`${getBaseUrl()}/api/product/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`Product not found: ${res.status}`);
  return res.json();
}

export async function getRecommendations(code: string): Promise<Product[]> {
  const res = await fetch(`${getBaseUrl()}/api/recommend/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`Recommendations failed: ${res.status}`);
  return res.json();
}

export async function getRecommendationsFromProduct(product: Product): Promise<Product[]> {
  const res = await fetch(`${getBaseUrl()}/api/recommend`, {
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
  return {
    nutrition_summary:
      typeof raw?.nutrition_summary === 'string' ? raw.nutrition_summary : 'No nutrition summary available.',
    eco_explanation:
      typeof raw?.eco_explanation === 'string' ? raw.eco_explanation : 'Eco explanation unavailable.',
    ingredient_flags: Array.isArray(raw?.ingredient_flags)
      ? raw.ingredient_flags.filter((f: unknown) => typeof f === 'string')
      : [],
    advice: typeof raw?.advice === 'string' ? raw.advice : 'No advice available.',
    predicted_nutriscore:
      typeof raw?.predicted_nutriscore === 'string' ? raw.predicted_nutriscore : null,
    predicted_ecoscore:
      typeof raw?.predicted_ecoscore === 'string' ? raw.predicted_ecoscore : null,
  };
}

export async function getExplanation(code: string): Promise<ExplanationResponse> {
  const res = await fetch(`${getBaseUrl()}/api/explain/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`Explanation failed: ${res.status}`);
  return _parseExplanation(await res.json());
}

export async function getExplanationFromProduct(product: Product): Promise<ExplanationResponse> {
  const res = await fetch(`${getBaseUrl()}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) throw new Error(`Explanation failed: ${res.status}`);
  return _parseExplanation(await res.json());
}
