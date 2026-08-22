import { StorageProvider } from './StorageProvider';

/**
 * Wrapper around browser `localStorage` that safely checks for SSR.
 */
export class LocalStorageProvider implements StorageProvider {
  private isBrowser = typeof window !== 'undefined';

  getItem<T = any>(key: string): T | null {
    if (!this.isBrowser) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  setItem<T = any>(key: string, value: T): void {
    if (!this.isBrowser) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  removeItem(key: string): void {
    if (!this.isBrowser) return;
    window.localStorage.removeItem(key);
  }

  clear(): void {
    if (!this.isBrowser) return;
    window.localStorage.clear();
  }
}
