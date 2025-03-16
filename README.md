# GhostCache API Cache Library

**GhostCache** is a lightweight, auto-caching wrapper for HTTP requests made with `fetch()` and `Axios`. It improves performance and reduces redundant network requests by automatically caching API responses. GhostCache supports multiple storage backends including:

- **In-Memory Storage** (default)
- **localStorage**
- **sessionStorage**
- **IndexedDB**
- **Redis** (via a provided adapter)

GhostCache is ideal for web applications, React apps, Node.js projects, and any environment that makes HTTP requests.

Currently available as a Node.js package on NPM. **NPM Page:** [https://www.npmjs.com/package/ghost-cache](https://www.npmjs.com/package/ghost-cache)

[![NPM version](https://img.shields.io/npm/v/ghost-cache.svg?style=flat&logo=npm)](https://www.npmjs.com/package/ghost-cache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat&logo=opensource)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node-%3E%3D14-brightgreen.svg?style=flat&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Axios](https://img.shields.io/badge/Axios-1.3.0-blue.svg?style=flat&logo=axios)](https://github.com/axios/axios)
[![Jest](https://img.shields.io/badge/Jest-29.0.0-red.svg?style=flat&logo=jest)](https://jestjs.io/)
[![Redis](https://img.shields.io/badge/Redis-4.0.0-green.svg?style=flat&logo=redis)](https://redis.io/)
[![cross-fetch](https://img.shields.io/badge/cross--fetch-4.1.0-blue.svg?style=flat&logo=cross-fetch)](https://github.com/lquixada/cross-fetch)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration Options](#configuration-options)
- [Usage Examples](#usage-examples)
  - [Basic Usage with Fetch](#basic-usage-with-fetch)
  - [Using GhostCache with Axios](#using-ghostcache-with-axios)
  - [Manual Cache API](#manual-cache-api)
- [Storage Adapters](#storage-adapters)
  - [localStorage](#localstorage)
  - [sessionStorage](#sessionstorage)
  - [IndexedDB](#indexeddb)
  - [Redis](#redis)
- [Advanced Examples](#advanced-examples)
  - [React Application Example](#react-application-example)
  - [Node.js Example](#nodejs-example)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Building & Publishing](#building--publishing)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Automatic Caching**: Intercepts requests via `fetch()` and Axios.
- **Multiple Storage Options**: Choose your preferred storage backend.
- **Configurable TTL**: Set cache expiry time in milliseconds.
- **Cache Size Limiting**: Limit the number of in-memory entries.
- **Manual Cache API**: Set and retrieve cache entries manually.
- **Pluggable**: Easily integrate with any HTTP client.

## Installation

Install GhostCache via npm or Yarn:

```bash
npm install ghost-cache
# or
yarn add ghost-cache
```

**(Optional, but encouraged)**: Install `cross-fetch` for better compatibility across environments:

```bash
npm install --save-dev cross-fetch
```

## Configuration Options

When enabling GhostCache, you can pass an options object to customize its behavior:

- **ttl**: Time-to-live for cache entries in milliseconds (default: 60000).
- **persistent**: Boolean to enable persistent storage (default: false).
- **maxEntries**: Maximum number of in-memory cache entries (default: 100).
- **storage**: Choose storage adapter. Options:
  - `'localStorage'`
  - `'sessionStorage'`
  - `'indexedDB'`
  - `'redis'` (requires a valid RedisAdapter instance)
  - _Or provide a custom storage adapter object that implements the IStorageAdapter interface (for your flexibility and convenience)._

Example:

```ts
import { enableGhostCache } from "ghost-cache";

enableGhostCache({
  ttl: 120000,          // Cache entries expire in 2 minutes
  persistent: true,       // Enable persistent caching
  maxEntries: 200,        // Allow up to 200 in-memory entries
  storage: "localStorage" // Use localStorage for persistence
});
```

## Usage Examples

### Basic Usage with Fetch

Enable caching and make HTTP requests using the native fetch API. GhostCache will intercept and cache the responses.

```ts
import { enableGhostCache, disableGhostCache } from "ghost-cache";

// Enable GhostCache with default options (TTL: 60 sec, in-memory caching)
enableGhostCache();

// Regular fetch calls remain unchanged
fetch("https://pokeapi.co/api/v2/pokemon/ditto")
  .then(res => res.json())
  .then(data => console.log("Fetched data:", data));

// Disable GhostCache to restore original fetch behavior
// disableGhostCache();
```

### Using GhostCache with Axios

You can also integrate GhostCache with Axios by registering your Axios instance.

```ts
import axios from "axios";
import { enableGhostCache, registerAxios } from "ghost-cache";

// Enable caching with 30 seconds TTL and persistent localStorage
enableGhostCache({ ttl: 30000, persistent: true, storage: "localStorage" });

// Create an Axios instance and register it with GhostCache
const api = axios.create({ baseURL: "https://pokeapi.co/api/v2" });
registerAxios(api);

// Make requests using Axios. Subsequent calls will be served from the cache.
api.get("/pokemon/ditto")
  .then(response => console.log("Axios fetched:", response.data));
```

### Manual Cache API

GhostCache provides methods to manually set and retrieve cache entries.

```ts
import { setCache, getCache } from "ghost-cache";

// Manually store a cache entry
await setCache("user-profile", { name: "Alice", age: 30 });

// Retrieve the manually stored cache entry
const profile = await getCache("user-profile");
console.log("Manual cache:", profile);
```

---

## Storage Adapters

### localStorage

Enable persistent caching using the browser's localStorage:

```ts
enableGhostCache({
  persistent: true,
  storage: "localStorage"
});
```

### sessionStorage

Use sessionStorage for caching that lasts only for the browser session:

```ts
enableGhostCache({
  persistent: true,
  storage: "sessionStorage"
});
```

### IndexedDB

Use IndexedDB for structured, persistent storage:

```ts
enableGhostCache({
  persistent: true,
  storage: "indexedDB"
});
```

### Redis

For server-side caching, you can use Redis by providing a RedisAdapter instance. Ensure you have a valid Redis client (for example, using the `redis` package):

```ts
import { createClient } from "redis";
import { RedisAdapter } from "ghost-cache/dist/storage/RedisAdapter";

const redisClient = createClient();
await redisClient.connect();

enableGhostCache({
  persistent: true,
  storage: new RedisAdapter(redisClient)
});
```

---

## Advanced Examples

### React Application Example

Integrate GhostCache in a React app to cache API responses automatically.

```tsx
// App.tsx
import React, { useEffect, useState } from "react";
import { enableGhostCache } from "ghost-cache";

enableGhostCache({ ttl: 60000, persistent: true, storage: "localStorage" });

const App: React.FC = () => {
  const [pokemon, setPokemon] = useState<any>(null);

  useEffect(() => {
    fetch("https://pokeapi.co/api/v2/pokemon/ditto")
      .then(res => res.json())
      .then(setPokemon);
  }, []);

  return (
    <div>
      <h1>GhostCache Example in React</h1>
      {pokemon ? (
        <pre>{JSON.stringify(pokemon, null, 2)}</pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default App;
```

### Node.js Example

If you use GhostCache in a Node.js environment (using Axios), you can enable caching similarly. Note that persistent caching may require a server-side storage adapter like Redis.

```ts
// node-example.ts
import axios from "axios";
import { enableGhostCache, registerAxios } from "ghost-cache";

// Enable caching (TTL: 60 sec, in-memory caching)
enableGhostCache({ ttl: 60000 });

// Create and register an Axios instance
const api = axios.create({ baseURL: "https://pokeapi.co/api/v2" });
registerAxios(api);

// Use Axios to make requests
api.get("/pokemon/ditto")
  .then(response => {
    console.log("Node.js Axios fetched:", response.data);
  })
  .catch(error => {
    console.error("Error:", error);
  });
```

---

## API Reference

- **enableGhostCache(options?: GhostCacheOptions): void**  
  Enables GhostCache. Automatically intercepts HTTP requests made with `fetch()` and Axios.

- **clearGhostCache(): void**  
  Clears all cache entries from memory (and persistent storage if enabled).

- **disableGhostCache(): void**  
  Disables GhostCache and restores the original HTTP request methods.

- **setCache(key: string, value: any): Promise<void>**  
  Manually sets a cache entry.

- **getCache<T = any>(key: string): Promise<T | null>**  
  Retrieves a manually set cache entry.

- **registerAxios(instance: AxiosInstance): void**  
  Registers an Axios instance so that its requests are intercepted and cached.

---

## Testing

GhostCache comes with a comprehensive Jest test suite. To run tests:

1. Ensure you have installed dependencies:

   ```bash
   npm install
   ```

2. Run tests with:

   ```bash
   npm test
   ```

Tests use the Pokémon API (`https://pokeapi.co/api/v2/pokemon/ditto`) to verify that caching works for both `fetch()` and Axios requests.

---

## Building & Publishing

### Building

Compile the TypeScript source:

```bash
npm run build
```

### Publishing

1. Login to npm:

   ```bash
   npm login
   ```

2. Publish the package:

   ```bash
   npm publish --access public
   ```

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the Repository**
2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Commit Your Changes**
4. **Submit a Pull Request**

For major changes, please open an issue first to discuss what you would like to change.

---

## License

GhostCache is released under the MIT License.

---

## Final Remarks

GhostCache is designed to be a simple yet powerful tool for improving the performance of your web applications by reducing unnecessary network calls. With support for multiple storage adapters and both `fetch()` and Axios, it adapts to a wide range of project needs.

Happy caching!
