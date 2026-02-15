import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Persistent explanation cache (AsyncStorage)
const EXPLANATION_PREFIX = 'explanation:';

export async function storeExplanation(code: string, explanation: ExplanationResponse): Promise<void> {
  // In-memory for current session
  set(`explanation:${code}`, explanation);
  // Persist to disk
  try {
    await AsyncStorage.setItem(`${EXPLANATION_PREFIX}${code}`, JSON.stringify(explanation));
  } catch { /* silent */ }
}

export function getStoredExplanation(code: string): ExplanationResponse | undefined {
  return get<ExplanationResponse>(`explanation:${code}`);
}

export async function getPersistedExplanation(code: string): Promise<ExplanationResponse | null> {
  // Check in-memory first
  const mem = getStoredExplanation(code);
  if (mem) return mem;

  // Fall back to AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(`${EXPLANATION_PREFIX}${code}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExplanationResponse;
    // Warm in-memory cache
    set(`explanation:${code}`, parsed);
    return parsed;
  } catch {
    return null;
  }
}
