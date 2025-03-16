import { IStorageAdapter } from "./IStorageAdapter.js";

export class SessionStorageAdapter implements IStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return Promise.resolve(sessionStorage.getItem(key));
  }

  async setItem(key: string, value: string): Promise<void> {
    sessionStorage.setItem(key, value);
    return Promise.resolve();
  }

  async removeItem(key: string): Promise<void> {
    sessionStorage.removeItem(key);
    return Promise.resolve();
  }

  async clear(): Promise<void> {
    sessionStorage.clear();
    return Promise.resolve();
  }
}
