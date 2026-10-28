import { normalizePath } from '@ecommerce/types';
import { createsLoop, fromPathProblem, normalizeTarget, parseImport } from './seo-rules';

describe('seo rules', () => {
  it('normalises paths the same way for saving and matching', () => {
    expect(normalizePath(' old-page/ ')).toBe('/old-page');
    expect(normalizePath('/a//b/?utm=1#x')).toBe('/a/b');
    expect(normalizePath('https://shop.pk/Sale/')).toBe('/Sale');
    expect(normalizePath('/')).toBe('/');
  });

  it('protects the home page and app paths', () => {
    expect(fromPathProblem('/')).not.toBeNull();
    expect(fromPathProblem('/_next/static/x.js')).not.toBeNull();
    expect(fromPathProblem('/sitemap.xml')).not.toBeNull();
    expect(fromPathProblem('/old-page')).toBeNull();
  });

  it('keeps full URLs as targets', () => {
    expect(normalizeTarget('https://blog.example.com/a/')).toBe('https://blog.example.com/a/');
    expect(normalizeTarget('new-page/')).toBe('/new-page');
    expect(normalizeTarget('/products/?featured=true')).toBe('/products?featured=true');
  });

  it('detects loops through existing redirects', () => {
    const existing = new Map([
      ['/b', '/c'],
      ['/c', '/a'],
      ['/x', 'https://other.site/a'],
    ]);
    expect(createsLoop('/a', '/b', existing)).toBe(true);
    expect(createsLoop('/a', '/x', existing)).toBe(false);
    expect(createsLoop('/a', '/a', existing)).toBe(true);
    expect(createsLoop('/n', '/m', existing)).toBe(false);
  });

  it('parses an import list', () => {
    expect(parseImport('# comment\n/old /new\n\n/a,/b,302\n/c\t/d 301')).toEqual([
      { line: 2, from: '/old', to: '/new', status: 301 },
      { line: 4, from: '/a', to: '/b', status: 302 },
      { line: 5, from: '/c', to: '/d', status: 301 },
    ]);
  });
});
