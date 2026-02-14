import type { ScanHistoryEntry, Product } from '../types';

const SCAN_HISTORY_KEY = 'shelfscan_scan_history';
const MAX_HISTORY_ITEMS = 30;

export function getScanHistory(): ScanHistoryEntry[] {
  const raw = localStorage.getItem(SCAN_HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

export function saveScanHistory(product: Product, capturedImage: string, imageName: string): void {
  const current = getScanHistory();
  const entry: ScanHistoryEntry = {
    id: `${product.product_code}-${Date.now()}`,
    saved_at: new Date().toISOString(),
    captured_image: capturedImage,
    captured_image_name: imageName,
    product_code: product.product_code,
    product_name: product.product_name,
    brands: product.brands,
    ecoscore_grade: product.ecoscore_grade,
    ecoscore_score: product.ecoscore_score,
    product_image_url: product.image_url,
  };

  const next = [entry, ...current].slice(0, MAX_HISTORY_ITEMS);
  localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next));
}

export function clearScanHistory(): void {
  localStorage.removeItem(SCAN_HISTORY_KEY);
}
