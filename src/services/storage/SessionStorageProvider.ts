import { StorageProvider } from './StorageProvider';

/**
 * Wrapper around browser `sessionStorage` with SSR safety.
 */
export class SessionStorageProvider implements StorageProvider {
  private isBrowser = typeof window !== 'undefined';

  getItem<T = any>(key: string): T | null {
    if (!this.isBrowser) return null;
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  setItem<T = any>(key: string, value: T): void {
    if (!this.isBrowser) return;
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }

  removeItem(key: string): void {
    if (!this.isBrowser) return;
    window.sessionStorage.removeItem(key);
  }

  clear(): void {
    if (!this.isBrowser) return;
    window.sessionStorage.clear();
  }
}
