/**
 * Recent searches, kept in this browser only (localStorage). Newest first, no duplicates
 * (case-insensitive), at most 8. Every call is safe in private mode / when storage is full.
 */
const KEY = 'recent-searches';
const MAX = 8;

export function readSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(list: string[]): string[] {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // not remembered — fine
  }
  return list;
}

export function rememberSearch(term: string): string[] {
  const q = term.trim().replace(/\s+/g, ' ');
  if (q.length < 2) return readSearches();
  const rest = readSearches().filter((t) => t.toLowerCase() !== q.toLowerCase());
  return write([q, ...rest].slice(0, MAX));
}

export function forgetSearch(term: string): string[] {
  return write(readSearches().filter((t) => t !== term));
}

export function clearSearches(): string[] {
  return write([]);
}
