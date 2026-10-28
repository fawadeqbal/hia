import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { BlogService, resolvePublishedAt } from './blog.service';

const now = new Date('2026-10-12T10:00:00Z');

describe('resolvePublishedAt', () => {
  it('uses an explicit date (future = scheduled)', () => {
    expect(
      resolvePublishedAt('PUBLISHED', '2026-11-01T09:00:00.000Z', null, now)?.toISOString(),
    ).toBe('2026-11-01T09:00:00.000Z');
  });

  it('stamps now on first publish and keeps the original date afterwards', () => {
    expect(resolvePublishedAt('PUBLISHED', undefined, null, now)).toEqual(now);
    const original = new Date('2026-01-01T00:00:00Z');
    expect(resolvePublishedAt('PUBLISHED', undefined, original, now)).toEqual(original);
  });

  it('clearing the date on a draft removes it', () => {
    expect(resolvePublishedAt('DRAFT', null, new Date(), now)).toBeNull();
  });
});

describe('BlogService', () => {
  function setup() {
    const prisma = {
      blogCategory: { findUnique: jest.fn(), delete: jest.fn() },
      blogPost: { count: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    const audit = { log: jest.fn() };
    const service = new BlogService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
    return { prisma, service };
  }

  it('refuses to delete a category that still has posts', async () => {
    const { prisma, service } = setup();
    prisma.blogCategory.findUnique.mockResolvedValue({ id: 'c1', name: 'News', slug: 'news' });
    prisma.blogPost.count.mockResolvedValue(2);
    await expect(service.removeCategory('c1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.blogCategory.delete).not.toHaveBeenCalled();
  });

  it('storefront only lists published posts dated now or earlier', async () => {
    const { prisma, service } = setup();
    prisma.blogPost.count.mockResolvedValue(0);
    await service.publicPosts({ page: 1, limit: 12, tag: 'guides' });
    const where = prisma.blogPost.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PUBLISHED');
    expect(where.publishedAt.lte).toBeInstanceOf(Date);
    expect(where.tags).toEqual({ has: 'guides' });
  });
});
