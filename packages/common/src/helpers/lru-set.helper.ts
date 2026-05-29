/**
 * Tiny in-memory LRU set — tracks up to `capacity` keys, evicting the oldest
 * on overflow. Useful for at-least-once dedup in event consumers.
 */
export class LruSet {
  private readonly set = new Set<string>();

  constructor(private readonly capacity: number) {}

  has(key: string): boolean {
    return this.set.has(key);
  }

  add(key: string): void {
    if (this.set.has(key)) {
      // Move to end (most recent)
      this.set.delete(key);
      this.set.add(key);
      return;
    }
    if (this.set.size >= this.capacity) {
      const oldest = this.set.values().next().value;
      if (oldest !== undefined) this.set.delete(oldest);
    }
    this.set.add(key);
  }

  get size(): number {
    return this.set.size;
  }

  clear(): void {
    this.set.clear();
  }
}
