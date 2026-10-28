/** Trims, collapses whitespace and caps the length of a search query. */
export function normalizeQuery(q: string | undefined | null, max = 100): string {
  return (q ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Groups attribute value ids by attribute: OR inside a group, AND across groups. */
export function groupValueIds(rows: { id: string; attributeId: string }[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const r of rows) groups.set(r.attributeId, [...(groups.get(r.attributeId) ?? []), r.id]);
  return [...groups.values()];
}

/** Ids sorted by score (desc), ties keep their original order. */
export function orderByScore(ids: string[], scores: Map<string, number>): string[] {
  return ids
    .map((id, i) => ({ id, i, s: scores.get(id) ?? 0 }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.id);
}
