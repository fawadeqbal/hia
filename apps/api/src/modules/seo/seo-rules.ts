import { RESERVED_PATH_PREFIXES, normalizePath } from '@ecommerce/types';

/** Problem with a redirect's old address, or null. */
export function fromPathProblem(fromPath: string): string | null {
  if (fromPath === '/') return 'The home page cannot be redirected';
  if (
    RESERVED_PATH_PREFIXES.some(
      (p) => fromPath === p || fromPath.startsWith(`${p}/`) || fromPath.startsWith(p),
    )
  )
    return `${fromPath} is used by the app and cannot be redirected`;
  return null;
}

/** Target: a full URL is kept; a site path is normalised but keeps its query string / hash. */
export function normalizeTarget(toPath: string): string {
  const t = toPath.trim();
  if (/^https?:\/\//i.test(t)) return t;
  const cut = t.search(/[?#]/);
  return cut === -1 ? normalizePath(t) : `${normalizePath(t.slice(0, cut))}${t.slice(cut)}`;
}

/**
 * Would adding / changing `from → to` create a loop? Follows existing redirects from `to` (site paths only).
 * `existing` maps fromPath → toPath (without the redirect being edited).
 */
export function createsLoop(
  from: string,
  to: string,
  existing: Map<string, string>,
  maxHops = 20,
): boolean {
  let current = to;
  for (let i = 0; i < maxHops; i++) {
    if (current === from) return true;
    const next = existing.get(current);
    if (!next || /^https?:\/\//i.test(next)) return false;
    current = next;
  }
  return true;
}

/** "old new [301|302]" per line (space, tab or comma). Blank lines and # comments are skipped. */
export function parseImport(
  text: string,
): { line: number; from: string; to: string; status: number }[] {
  return text
    .split(/\r?\n/)
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter((l) => l.raw && !l.raw.startsWith('#'))
    .map(({ raw, line }) => {
      const [from = '', to = '', status = '301'] = raw.split(/[\s,]+/);
      return { line, from, to, status: Number(status) };
    });
}
