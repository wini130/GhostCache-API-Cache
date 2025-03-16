"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const axios_1 = __importDefault(require("axios"));
jest.setTimeout(10000);
describe("GhostCache - API Caching Tests", () => {
    const POKEMON_API = "https://pokeapi.co/api/v2/pokemon/ditto";
    beforeAll(() => {
        // Enable caching with a TTL of 5 seconds, no persistent storage for testing
        (0, src_1.enableGhostCache)({ ttl: 5000, persistent: false });
    });
    afterEach(() => {
        (0, src_1.clearGhostCache)();
    });
    afterAll(() => {
        (0, src_1.disableGhostCache)();
    });
    it("fetches data from the Pokémon API via fetch", () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield fetch(POKEMON_API);
        const data = yield response.json();
        expect(data).toHaveProperty("name", "ditto");
    }));
    it("returns cached data on subsequent fetch calls", () => __awaiter(void 0, void 0, void 0, function* () {
        const startTime = Date.now();
        const response1 = yield fetch(POKEMON_API);
        const data1 = yield response1.json();
        const networkTime = Date.now() - startTime;
        expect(data1).toHaveProperty("name", "ditto");
        const cacheStartTime = Date.now();
        const response2 = yield fetch(POKEMON_API);
        const data2 = yield response2.json();
        const cacheTime = Date.now() - cacheStartTime;
        expect(data2).toHaveProperty("name", "ditto");
        expect(cacheTime).toBeLessThan(networkTime);
    }));
    it("expires cache after TTL for fetch", () => __awaiter(void 0, void 0, void 0, function* () {
        const response1 = yield fetch(POKEMON_API);
        const data1 = yield response1.json();
        expect(data1).toHaveProperty("name", "ditto");
        // Wait 6 seconds (beyond the 5-second TTL)
        yield new Promise(resolve => setTimeout(resolve, 6000));
        const response2 = yield fetch(POKEMON_API);
        const data2 = yield response2.json();
        expect(data2).toHaveProperty("name", "ditto");
    }));
    it("allows manual cache set and get", () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, src_1.setCache)("test-key", { foo: "bar" });
        const cached = yield (0, src_1.getCache)("test-key");
        expect(cached).toEqual({ foo: "bar" });
    }));
    it("works with Axios", () => __awaiter(void 0, void 0, void 0, function* () {
        const api = axios_1.default.create();
        (0, src_1.registerAxios)(api);
        const response1 = yield api.get(POKEMON_API);
        expect(response1.data).toHaveProperty("name", "ditto");
        // Second request should come from cache
        const response2 = yield api.get(POKEMON_API);
        expect(response2.data).toHaveProperty("name", "ditto");
    }));
});
