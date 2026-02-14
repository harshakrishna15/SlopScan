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

export async function getExplanation(code: string): Promise<ExplanationResponse> {
  const res = await fetch(`/api/explain/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`Explanation failed: ${res.status}`);
  return res.json();
}
