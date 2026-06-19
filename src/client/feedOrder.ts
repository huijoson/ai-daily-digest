// In-memory, module-level store for the current feed ordering (article ids).
// The Today screen sets this from its flattened sections; the article detail
// screen reads it to compute prev/next neighbors.
let order: string[] = [];

export function setFeedOrder(ids: string[]): void {
  order = [...ids];
}

export function getFeedOrder(): string[] {
  return order;
}
