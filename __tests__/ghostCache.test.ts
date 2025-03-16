import {
  enableGhostCache,
  clearGhostCache,
  disableGhostCache,
  getCache,
  setCache,
  registerAxios,
} from "../src/index.js";
import axios from "axios";

// Increase Jest timeout to allow for slower network requests.
jest.setTimeout(10000);

describe("GhostCache - API Caching Tests", () => {
  const POKEMON_API = "https://pokeapi.co/api/v2/pokemon/ditto";

  beforeAll(() => {
    enableGhostCache({ ttl: 5000, persistent: false });
  });

  afterEach(() => {
    clearGhostCache();
  });

  afterAll(() => {
    disableGhostCache();
  });

  it("fetches data from the Pokémon API via fetch", async () => {
    const res = await fetch(POKEMON_API);
    const data = await res.json();
    expect(data).toHaveProperty("name", "ditto");
  });

  it("returns cached data on subsequent fetch calls", async () => {
    const startTime = Date.now();
    const r1 = await fetch(POKEMON_API);
    const d1 = await r1.json();
    const networkTime = Date.now() - startTime;
    expect(d1.name).toBe("ditto");

    const cStart = Date.now();
    const r2 = await fetch(POKEMON_API);
    const d2 = await r2.json();
    const cacheTime = Date.now() - cStart;
    expect(d2.name).toBe("ditto");
    expect(cacheTime).toBeLessThan(networkTime);
  });

  it("expires cache after TTL for fetch", async () => {
    const r1 = await fetch(POKEMON_API);
    const d1 = await r1.json();
    expect(d1).toHaveProperty("name", "ditto");

    // Wait 6 seconds to exceed the TTL of 5 seconds.
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const r2 = await fetch(POKEMON_API);
    const d2 = await r2.json();
    expect(d2).toHaveProperty("name", "ditto");
  });

  it("allows manual cache set and get", async () => {
    await setCache("test-key", { foo: "bar" });
    const cached = await getCache("test-key");
    expect(cached).toEqual({ foo: "bar" });
  });

  it("works with Axios", async () => {
    const api = axios.create();
    registerAxios(api);

    const resp1 = await api.get(POKEMON_API);
    expect(resp1.data).toHaveProperty("name", "ditto");

    // Second request should come from cache.
    const resp2 = await api.get(POKEMON_API);
    expect(resp2.data).toHaveProperty("name", "ditto");
  });
});
