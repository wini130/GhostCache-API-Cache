import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
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
      "fetch is not defined. Install cross-fetch or another polyfill.",
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
      "Response is not defined. Install cross-fetch or another polyfill.",
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
  storage: new InMemoryStorageAdapter(),
};

let storageAdapter: IStorageAdapter | null = null;
let originalFetch: typeof globalObj.fetch | null = null;
let axiosInstances: AxiosInstance[] = [];

/**
 * Picks correct storage adapter based on config.
 */
function determineStorageAdapter(
  opt: GhostCacheOptions["storage"],
): IStorageAdapter {
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
 * Enable GhostCache: intercept fetch and (optionally) Axios requests.
 */
export function enableGhostCache(options: GhostCacheOptions = {}): void {
  // Merge user options into defaults
  Object.assign(defaultConfig, options);

  // Setup storage adapter if persistent
  storageAdapter = defaultConfig.persistent
    ? determineStorageAdapter(defaultConfig.storage)
    : null;

  // Intercept global fetch if we haven't already
  if (!originalFetch) {
    originalFetch = globalObj.fetch.bind(globalObj);
    globalObj.fetch = async (url: RequestInfo, config?: RequestInit) => {
      return handleRequest({ url, config });
    };
  }

  // Set up Axios interceptors
  axiosInstances.forEach((instance) => {
    instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const safeUrl: string = config.url ?? "";
        const cacheKey = JSON.stringify({
          url: safeUrl,
          params: config.params,
          method: config.method,
        });

        // Check in-memory cache
        if (inMemoryCache.has(cacheKey)) {
          const entry = inMemoryCache.get(cacheKey)!;
          if (Date.now() - entry.timestamp < defaultConfig.ttl) {
            console.log(
              `[GhostCache] Using in-memory cache for request: ${safeUrl}`,
            );
            return Promise.reject({
              __ghostCache__: true,
              data: JSON.parse(entry.data),
              config,
            });
          } else {
            inMemoryCache.delete(cacheKey);
          }
        }

        // Check persistent storage
        if (storageAdapter) {
          const stored = await storageAdapter.getItem(cacheKey);
          if (stored) {
            const parsed = JSON.parse(stored) as CacheEntry;
            if (Date.now() - parsed.timestamp < defaultConfig.ttl) {
              console.log(
                `[GhostCache] Using persistent cache for request: ${safeUrl}`,
              );
              return Promise.reject({
                __ghostCache__: true,
                data: JSON.parse(parsed.data),
                config,
              });
            } else {
              await storageAdapter.removeItem(cacheKey);
            }
          }
        }

        return config;
      },
      (err: unknown) => Promise.reject(err),
    );

    instance.interceptors.response.use(
      (res: AxiosResponse) => {
        const safeUrl: string = res.config.url ?? "";
        const cacheKey = JSON.stringify({
          url: safeUrl,
          params: res.config.params,
          method: res.config.method,
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
            config: e.config,
          } as AxiosResponse);
        }
        return Promise.reject(err);
      },
    );
  });
}

/**
 * Handle fetch() requests with caching.
 */
async function handleRequest(request: {
  url: RequestInfo;
  config?: RequestInit;
}): Promise<Response> {
  const cacheKey = JSON.stringify(request);

  // In-memory cache check
  if (inMemoryCache.has(cacheKey)) {
    const entry = inMemoryCache.get(cacheKey)!;
    if (Date.now() - entry.timestamp < defaultConfig.ttl) {
      console.log(
        `[GhostCache] (fetch) Using in-memory cache for: ${JSON.stringify(
          request,
        )}`,
      );
      return new globalObj.Response(entry.data, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      inMemoryCache.delete(cacheKey);
    }
  }

  // Persistent cache check
  if (storageAdapter) {
    const stored = await storageAdapter.getItem(cacheKey);
    if (stored) {
      const entry = JSON.parse(stored) as CacheEntry;
      if (Date.now() - entry.timestamp < defaultConfig.ttl) {
        console.log(
          `[GhostCache] (fetch) Using persistent cache for: ${JSON.stringify(
            request,
          )}`,
        );
        return new globalObj.Response(entry.data, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        await storageAdapter.removeItem(cacheKey);
      }
    }
  }

  console.log(
    `[GhostCache] (fetch) Fetching from network: ${JSON.stringify(request)}`,
  );
  // Network fetch
  if (!originalFetch) {
    throw new Error("GhostCache: original fetch is missing.");
  }
  const response = await originalFetch(request.url, request.config);
  const cloned = response.clone();
  const textData = await cloned.text();
  cacheResponse(cacheKey, textData);
  return response;
}

/**
 * Save to in-memory cache and persistent storage.
 */
function cacheResponse(cacheKey: string, data: string) {
  const entry: CacheEntry = { timestamp: Date.now(), data };
  inMemoryCache.set(cacheKey, entry);

  // Enforce maximum cache entries
  if (inMemoryCache.size > defaultConfig.maxEntries) {
    const firstKey = inMemoryCache.keys().next().value;
    if (firstKey) inMemoryCache.delete(firstKey);
  }

  if (storageAdapter) {
    storageAdapter.setItem(cacheKey, JSON.stringify(entry));
  }

  console.log(`[GhostCache] Cached response for key: ${cacheKey}`);
}

/**
 * Manually set a cache entry.
 */
export async function setCache(key: string, value: any): Promise<void> {
  const cacheKey = JSON.stringify(key);
  const entry: CacheEntry = {
    timestamp: Date.now(),
    data: JSON.stringify(value),
  };
  inMemoryCache.set(cacheKey, entry);
  if (storageAdapter) {
    await storageAdapter.setItem(cacheKey, JSON.stringify(entry));
  }
  console.log(`[GhostCache] Manually cached key: ${cacheKey}`);
}

/**
 * Retrieve a cache entry.
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const cacheKey = JSON.stringify(key);
  if (inMemoryCache.has(cacheKey)) {
    const entry = inMemoryCache.get(cacheKey)!;
    console.log(
      `[GhostCache] Retrieved from in-memory cache for key: ${cacheKey}`,
    );
    return JSON.parse(entry.data) as T;
  }
  if (storageAdapter) {
    const stored = await storageAdapter.getItem(cacheKey);
    if (stored) {
      const entry = JSON.parse(stored) as CacheEntry;
      console.log(
        `[GhostCache] Retrieved from persistent cache for key: ${cacheKey}`,
      );
      return JSON.parse(entry.data) as T;
    }
  }
  return null;
}

/**
 * Clear all cache entries.
 */
export function clearGhostCache(): void {
  inMemoryCache.clear();
  if (storageAdapter) {
    storageAdapter.clear();
  }
  console.log("[GhostCache] Cache cleared");
}

/**
 * Disable GhostCache and restore the original fetch.
 */
export function disableGhostCache(): void {
  if (originalFetch) {
    globalObj.fetch = originalFetch;
    originalFetch = null;
  }
  axiosInstances = [];
  clearGhostCache();
  console.log("[GhostCache] Disabled and restored original fetch");
}

/**
 * Register an Axios instance to intercept its requests.
 */
export function registerAxios(instance: AxiosInstance): void {
  axiosInstances.push(instance);
  console.log("[GhostCache] Registered an Axios instance");
}
