// index.d.ts

export interface IStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface GhostCacheOptions {
  ttl?: number;
  persistent?: boolean;
  maxEntries?: number;
  storage?: "localStorage" | "sessionStorage" | IStorageAdapter;
}

export declare function enableGhostCache(options?: GhostCacheOptions): void;
export declare function disableGhostCache(): void;
export declare function clearGhostCache(): void;
export declare function setCache(key: string, value: any): Promise<void>;
export declare function getCache<T = any>(key: string): Promise<T | null>;
export declare function registerAxios(instance: any): void;
