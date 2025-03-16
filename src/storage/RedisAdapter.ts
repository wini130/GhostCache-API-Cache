import { IStorageAdapter } from "./IStorageAdapter.js";

export class RedisAdapter implements IStorageAdapter {
  private client: any;

  constructor(client: any) {
    if (!client) {
      throw new Error("A valid Redis client must be provided.");
    }
    this.client = client;
  }

  async getItem(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this.client.del(key);
  }

  async clear(): Promise<void> {
    // WARNING: flushAll clears the entire Redis database!
    await this.client.flushAll();
  }
}
