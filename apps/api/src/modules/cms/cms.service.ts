import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BannerPlacement,
  PublicBannerDto,
  PublicFaqGroup,
  PublicMenuItem,
  PublicPageDto,
} from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { buildMenuTree, groupFaqs } from './cms-rules';
import { toPublicBanner, toPublicPage } from './cms.mapper';
import { assertHandle } from './menus.service';
import { DEFAULT_LOCALE } from './pages.service';

const MAX_BANNERS = 10;

/** Storefront reads: published pages, live banners, menus, active FAQs. */
@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  async page(slug: string, locale = DEFAULT_LOCALE): Promise<PublicPageDto> {
    const page = await this.prisma.page.findFirst({ where: { slug, locale, status: 'PUBLISHED' } });
    if (!page) throw new NotFoundException('Page not found');
    return toPublicPage(page);
  }

  async banners(placement: BannerPlacement, now = new Date()): Promise<PublicBannerDto[]> {
    const banners = await this.prisma.banner.findMany({
      where: {
        placement,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      take: MAX_BANNERS,
    });
    return banners.map(toPublicBanner);
  }

  async menu(handleParam: string): Promise<PublicMenuItem[]> {
    const handle = assertHandle(handleParam);
    const menu = await this.prisma.menu.findUnique({ where: { handle }, include: { items: true } });
    if (!menu) return [];
    return buildMenuTree(menu.items).map((i) => ({
      label: i.label,
      url: i.url,
      children: i.children.map((c) => ({ label: c.label, url: c.url })),
    }));
  }

  async faqs(): Promise<PublicFaqGroup[]> {
    const faqs = await this.prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }],
      select: { id: true, question: true, answer: true, category: true },
    });
    return groupFaqs(faqs);
  }
}
