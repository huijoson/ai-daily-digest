export function buildDigestMessage(count: number): { title: string; body: string } {
  const noun = count === 1 ? 'summary' : 'summaries';
  return { title: 'AI Daily Digest', body: `${count} new ${noun} ready` };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
