import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { PagesService } from './pages.service';

const now = new Date('2026-10-12T00:00:00Z');
const page = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  title: 'About us',
  slug: 'about-us',
  locale: 'en',
  content: { blocks: [] },
  status: 'DRAFT',
  seoTitle: null,
  seoDescription: null,
  publishedAt: null,
  createdAt: now,
  updatedAt: now,
  ...over,
});

function setup() {
  const prisma = {
    page: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const service = new PagesService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, audit, service };
}

describe('PagesService', () => {
  it('generates the slug, validates content and sets publishedAt when created published', async () => {
    const { prisma, audit, service } = setup();
    prisma.page.findFirst.mockResolvedValue(null);
    prisma.page.create.mockImplementation(({ data }) => Promise.resolve(page(data)));

    const result = await service.create(
      {
        title: 'About us',
        status: 'PUBLISHED',
        content: { blocks: [{ type: 'paragraph', text: 'Hi' }] },
      },
      'admin',
    );

    const data = prisma.page.create.mock.calls[0][0].data;
    expect(data.slug).toBe('about-us');
    expect(data.locale).toBe('en');
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(result.content.blocks).toHaveLength(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'cms.page.create' }));
  });

  it('rejects a slug already used in the same locale', async () => {
    const { prisma, service } = setup();
    prisma.page.findFirst.mockResolvedValue({ id: 'other' });
    await expect(
      service.create({ title: 'About', slug: 'about', status: 'DRAFT', content: { blocks: [] } }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unsafe content', async () => {
    const { service } = setup();
    await expect(
      service.create({
        title: 'X',
        status: 'DRAFT',
        content: { blocks: [{ type: 'html', text: '<script>' }] } as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets publishedAt only on the first publish and keeps the slug when unchanged', async () => {
    const { prisma, service } = setup();
    prisma.page.findUnique.mockResolvedValue(page());
    prisma.page.update.mockImplementation(({ data }) =>
      Promise.resolve(page({ ...data, status: 'PUBLISHED' })),
    );

    await service.update('p1', { status: 'PUBLISHED', title: 'About' });
    const first = prisma.page.update.mock.calls[0][0].data;
    expect(first.publishedAt).toBeInstanceOf(Date);
    expect(first.slug).toBeUndefined();

    prisma.page.findUnique.mockResolvedValue(page({ status: 'PUBLISHED', publishedAt: now }));
    await service.update('p1', { status: 'PUBLISHED' });
    expect(prisma.page.update.mock.calls[1][0].data.publishedAt).toBeUndefined();
  });
});
