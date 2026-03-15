type CacheEntry<Value> = {
  value: Value;
  expiresAt: number;
};

export class TtlCache<Key, Value> {
  private entries = new Map<Key, CacheEntry<Value>>();

  constructor(private maxEntries = 500) {}

  get(key: Key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: Key, value: Value, ttlMs: number) {
    if (ttlMs <= 0) {
      this.delete(key);
      return;
    }

    this.pruneExpired();

    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.entries.delete(oldestKey);
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: Key) {
    this.entries.delete(key);
  }

  deleteWhere(predicate: (key: Key, value: Value) => boolean) {
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= Date.now()) {
        this.entries.delete(key);
        continue;
      }

      if (predicate(key, entry.value)) {
        this.entries.delete(key);
      }
    }
  }

  clear() {
    this.entries.clear();
  }

  private pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
