import { BadRequestException } from '@nestjs/common';
import {
  buildMenuTree,
  groupFaqs,
  isBannerLive,
  parsePageContent,
  readPageContent,
} from './cms-rules';

describe('cms rules', () => {
  const now = new Date('2026-10-12T12:00:00Z');

  it('banner is live only when active and inside the schedule', () => {
    const base = { isActive: true, startsAt: null, endsAt: null };
    expect(isBannerLive(base, now)).toBe(true);
    expect(isBannerLive({ ...base, isActive: false }, now)).toBe(false);
    expect(isBannerLive({ ...base, startsAt: new Date('2026-10-13T00:00:00Z') }, now)).toBe(false);
    expect(isBannerLive({ ...base, endsAt: new Date('2026-10-12T12:00:00Z') }, now)).toBe(false);
    expect(isBannerLive({ ...base, endsAt: new Date('2026-10-20T00:00:00Z') }, now)).toBe(true);
  });

  it('builds a two-level menu ordered by position', () => {
    const tree = buildMenuTree([
      { id: 'b', parentId: null, label: 'B', url: '/b', position: 1 },
      { id: 'a', parentId: null, label: 'A', url: '/a', position: 0 },
      { id: 'a2', parentId: 'a', label: 'A2', url: '/a2', position: 1 },
      { id: 'a1', parentId: 'a', label: 'A1', url: '/a1', position: 0 },
      { id: 'x', parentId: 'gone', label: 'X', url: '/x', position: 0 },
    ]);
    expect(tree.map((t) => t.id)).toEqual(['a', 'b']);
    expect(tree[0].children.map((c) => c.id)).toEqual(['a1', 'a2']);
  });

  it('groups FAQs by category with a default group', () => {
    const groups = groupFaqs([
      { id: '1', question: 'Q1', answer: 'A1', category: 'Orders' },
      { id: '2', question: 'Q2', answer: 'A2', category: null },
      { id: '3', question: 'Q3', answer: 'A3', category: 'Orders' },
    ]);
    expect(groups.map((g) => g.category)).toEqual(['Orders', 'General']);
    expect(groups[0].items).toHaveLength(2);
  });

  it('rejects invalid page content and accepts valid blocks', () => {
    expect(() => parsePageContent({ blocks: [{ type: 'script', text: 'x' }] })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parsePageContent({ blocks: [{ type: 'button', label: 'Go', url: 'javascript:alert(1)' }] }),
    ).toThrow(BadRequestException);
    const ok = parsePageContent({
      blocks: [
        { type: 'heading', text: 'Hi', level: 2 },
        { type: 'button', label: 'Shop', url: '/products' },
      ],
    });
    expect(ok.blocks).toHaveLength(2);
  });

  it('reads broken stored content as empty instead of crashing', () => {
    expect(readPageContent('not json')).toEqual({ blocks: [] });
  });
});
