import type { Banner, Faq, Page } from '@ecommerce/database';
import type {
  BannerDto,
  BannerPlacement,
  FaqDto,
  PageDto,
  PageListItem,
  PublicBannerDto,
  PublicPageDto,
} from '@ecommerce/types';
import { isBannerLive, readPageContent } from './cms-rules';

export function toPageListItem(p: Page): PageListItem {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    locale: p.locale,
    status: p.status,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toPageDto(p: Page): PageDto {
  return {
    ...toPageListItem(p),
    content: readPageContent(p.content),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
  };
}

export function toPublicPage(p: Page): PublicPageDto {
  return {
    title: p.title,
    slug: p.slug,
    content: readPageContent(p.content),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toBannerDto(b: Banner, now = new Date()): BannerDto {
  return {
    id: b.id,
    title: b.title,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl,
    linkUrl: b.linkUrl,
    placement: b.placement as BannerPlacement,
    position: b.position,
    startsAt: b.startsAt?.toISOString() ?? null,
    endsAt: b.endsAt?.toISOString() ?? null,
    isActive: b.isActive,
    isLive: isBannerLive(b, now),
    createdAt: b.createdAt.toISOString(),
  };
}

export function toPublicBanner(b: Banner): PublicBannerDto {
  return {
    id: b.id,
    title: b.title,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl,
    linkUrl: b.linkUrl,
  };
}

export function toFaqDto(f: Faq): FaqDto {
  return {
    id: f.id,
    question: f.question,
    answer: f.answer,
    category: f.category,
    position: f.position,
    isActive: f.isActive,
  };
}
