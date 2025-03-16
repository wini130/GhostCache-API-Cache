// src/ghostCache.ts

import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig
} from "axios";
import { IStorageAdapter } from "./storage/IStorageAdapter.js";
import { LocalStorageAdapter } from "./storage/LocalStorageAdapter.js";
import { SessionStorageAdapter } from "./storage/SessionStorageAdapter.js";
import { InMemoryStorageAdapter } from "./storage/InMemoryStorageAdapter.js";

// For universal usage in Node or browser
const globalObj: any = globalThis;

// Polyfill fetch if not defined
if (typeof globalObj.fetch === "undefined") {
  try {
    const fetchPoly = require("cross-fetch").fetch;
    globalObj.fetch = fetchPoly;
  } catch (err) {
    throw new Error(
      "fetch is not defined. Install cross-fetch or another polyfill."
    );
  }
}

// Polyfill Response if not defined
if (typeof globalObj.Response === "undefined") {
  try {
    const { Response: FetchResponse } = require("cross-fetch");
    globalObj.Response = FetchResponse;
  } catch (err) {
    throw new Error(
      "Response is not defined. Install cross-fetch or another polyfill."
    );
  }
}

export interface GhostCacheOptions {
  ttl?: number;
  persistent?: boolean;
  maxEntries?: number;
  storage?: "localStorage" | "sessionStorage" | IStorageAdapter;
}

interface CacheEntry {
  timestamp: number;
  data: string;
}

const inMemoryCache = new Map<string, CacheEntry>();

const defaultConfig: Required<GhostCacheOptions> = {
  ttl: 60000,
  persistent: false,
  maxEntries: 100,
  storage: new InMemoryStorageAdapter()
};

let storageAdapter: IStorageAdapter | null = null;
let originalFetch: typeof globalObj.fetch | null = null;
let axiosInstances: AxiosInstance[] = [];

/**
 * Picks correct storage adapter
 */
function determineStorageAdapter(opt: GhostCacheOptions["storage"]): IStorageAdapter {
  if (typeof opt === "object") return opt;
  switch (opt) {
    case "localStorage":
      return new LocalStorageAdapter();
    case "sessionStorage":
      return new SessionStorageAdapter();
    default:
      return new InMemoryStorageAdapter();
  }
}

/**
 * Enable GhostCache
 */
export function enableGhostCache(options: GhostCacheOptions = {}): void {
  // Merge user options into defaults
  Object.assign(defaultConfig, options);

  // Setup storage adapter if persistent
  storageAdapter = defaultConfig.persistent
    ? determineStorageAdapter(defaultConfig.storage)
    : null;

  // Intercept fetch if not done
  if (!originalFetch) {
    originalFetch = globalObj.fetch.bind(globalObj);
    globalObj.fetch = async (url: RequestInfo, config?: RequestInit) => {
      return handleRequest({ url, config });
    };
  }

  // Setup Axios interceptors
  axiosInstances.forEach(instance => {
    instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const safeUrl = config.url ?? "";
        const cacheKey = JSON.stringify({
          url: safeUrl,
          params: config.params,
          method: config.method
        });

        // Check in-memory
        if (inMemoryCache.has(cacheKey)) {
          const entry = inMemoryCache.get(cacheKey)!;
          if (Date.now() - entry.timestamp < defaultConfig.ttl) {
            return Promise.reject({
              __ghostCache__: true,
              data: JSON.parse(entry.data),
              config
            });
          } else {
            inMemoryCache.delete(cacheKey);
          }
        }

        // Check persistent
        if (storageAdapter) {
          const stored = await storageAdapter.getItem(cacheKey);
          if (stored) {
            const parsed = JSON.parse(stored) as CacheEntry;
            if (Date.now() - parsed.timestamp < defaultConfig.ttl) {
              return Promise.reject({
                __ghostCache__: true,
                data: JSON.parse(parsed.data),
                config
              });
            } else {
              await storageAdapter.removeItem(cacheKey);
            }
          }
        }

        return config;
      },
      (err: unknown) => Promise.reject(err)
    );

    instance.interceptors.response.use(
      (res: AxiosResponse) => {
        const safeUrl = res.config.url ?? "";
        const cacheKey = JSON.stringify({
          url: safeUrl,
          params: res.config.params,
          method: res.config.method
        });
        cacheResponse(cacheKey, JSON.stringify(res.data));
        return res;
      },
      (err: unknown) => {
        const e: any = err;
        if (e && e.__ghostCache__ && e.data) {
          return Promise.resolve({
            data: e.data,
            status: 200,
            statusText: "OK",
            headers: {},
            config: e.config
          } as AxiosResponse);
        }
        return Promise.reject(err);
      }
    );
  });
}

/**
 * Internal fetch handler
 */
async function handleRequest(request: { url: RequestInfo; config?: RequestInit }): Promise<Response> {
  const cacheKey = JSON.stringify(request);

  // in-memory check
  if (inMemoryCache.has(cacheKey)) {
    const entry = inMemoryCache.get(cacheKey)!;
    if (Date.now() - entry.timestamp < defaultConfig.ttl) {
      return new globalObj.Response(entry.data, {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      inMemoryCache.delete(cacheKey);
    }
  }

  // storage check
  if (storageAdapter) {
    const stored = await storageAdapter.getItem(cacheKey);
    if (stored) {
      const entry = JSON.parse(stored) as CacheEntry;
      if (Date.now() - entry.timestamp < defaultConfig.ttl) {
        return new globalObj.Response(entry.data, {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        await storageAdapter.removeItem(cacheKey);
      }
    }
  }

  if (!originalFetch) {
    throw new Error("GhostCache: original fetch is missing.");
  }
  // network fetch
  const response = await originalFetch(request.url, request.config);
  const cloned = response.clone();
  const textData = await cloned.text();
  cacheResponse(cacheKey, textData);
  return response;
}

function cacheResponse(cacheKey: string, data: string) {
  const entry = { timestamp: Date.now(), data };
  inMemoryCache.set(cacheKey, entry);

  if (inMemoryCache.size > defaultConfig.maxEntries) {
    const firstKey = inMemoryCache.keys().next().value;
    if (firstKey) inMemoryCache.delete(firstKey);
  }

  if (storageAdapter) {
    storageAdapter.setItem(cacheKey, JSON.stringify(entry));
  }
}

/**
 * Manually set a cache
 */
export async function setCache(key: string, value: any): Promise<void> {
  const cacheKey = JSON.stringify(key);
  const entry = { timestamp: Date.now(), data: JSON.stringify(value) };
  inMemoryCache.set(cacheKey, entry);

  if (storageAdapter) {
    await storageAdapter.setItem(cacheKey, JSON.stringify(entry));
  }
}

/**
 * Get a cached item
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const cacheKey = JSON.stringify(key);
  if (inMemoryCache.has(cacheKey)) {
    const entry = inMemoryCache.get(cacheKey)!;
    return JSON.parse(entry.data) as T;
  }
  if (storageAdapter) {
    const stored = await storageAdapter.getItem(cacheKey);
    if (stored) {
      const entry = JSON.parse(stored) as CacheEntry;
      return JSON.parse(entry.data) as T;
    }
  }
  return null;
}

/**
 * Clear all caches
 */
export function clearGhostCache(): void {
  inMemoryCache.clear();
  if (storageAdapter) {
    storageAdapter.clear();
  }
}

/**
 * Disable GhostCache
 */
export function disableGhostCache(): void {
  if (originalFetch) {
    globalObj.fetch = originalFetch;
    originalFetch = null;
  }
  axiosInstances = [];
  clearGhostCache();
}

/**
 * Register an Axios instance
 */
export function registerAxios(instance: AxiosInstance): void {
  axiosInstances.push(instance);
}
