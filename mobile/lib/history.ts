import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanHistoryEntry, Product } from './types';

const SCAN_HISTORY_KEY = 'shelfscan_scan_history';
const MAX_HISTORY_ITEMS = 30;

export async function getScanHistory(): Promise<ScanHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

export async function saveScanHistory(product: Product): Promise<void> {
  const current = await getScanHistory();
  // Remove existing entry for same product to avoid duplicates
  const filtered = current.filter((e) => e.product_code !== product.product_code);
  const entry: ScanHistoryEntry = {
    id: `${product.product_code}-${Date.now()}`,
    saved_at: new Date().toISOString(),
    product_code: product.product_code,
    product_name: product.product_name,
    brands: product.brands,
    ecoscore_grade: product.ecoscore_grade,
    ecoscore_score: product.ecoscore_score,
    nutriscore_grade: product.nutriscore_grade,
    product_image_url: product.image_url,
    product,
  };
  const next = [entry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next));
}

export async function deleteScanHistoryItem(id: string): Promise<void> {
  const current = await getScanHistory();
  const next = current.filter((item) => item.id !== id);
  await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next));
}

export async function clearScanHistory(): Promise<void> {
  await AsyncStorage.removeItem(SCAN_HISTORY_KEY);
}
