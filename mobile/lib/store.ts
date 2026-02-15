import type { Product, ExplanationResponse } from './types';

// Simple in-memory store for passing objects between screens.
// Router params should be serializable strings; complex objects go here.

const store: Record<string, unknown> = {};

export function set(key: string, value: unknown) {
  store[key] = value;
}

export function get<T>(key: string): T | undefined {
  return store[key] as T | undefined;
}

export function remove(key: string) {
  delete store[key];
}

// Convenience helpers
export function storeProduct(code: string, product: Product) {
  set(`product:${code}`, product);
}

export function getStoredProduct(code: string): Product | undefined {
  return get<Product>(`product:${code}`);
}

export function storeExplanation(code: string, explanation: ExplanationResponse) {
  set(`explanation:${code}`, explanation);
}

export function getStoredExplanation(code: string): ExplanationResponse | undefined {
  return get<ExplanationResponse>(`explanation:${code}`);
}
