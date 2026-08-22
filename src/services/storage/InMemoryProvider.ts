import { StorageProvider } from './StorageProvider';

/**
 * Simple fallback when the browser storage API is unavailable (e.g., during SSR).
 */
export class InMemoryProvider implements StorageProvider {
  private store = new Map<string, any>();

  getItem<T = any>(key: string): T | null {
    return this.store.has(key) ? (this.store.get(key) as T) : null;
  }
  setItem<T = any>(key: string, value: T): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}
