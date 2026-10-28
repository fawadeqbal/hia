import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BlogCategory, Prisma } from '@ecommerce/database';
import {
  parseTags,
  type BlogCategoryDto,
  type BlogPostDto,
  type BlogPostListItem,
  type Paginated,
  type PublicBlogCard,
  type PublicBlogPost,
  type SitemapEntries,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { uniqueSlug } from '../../common/utils/unique-slug';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  postInclude,
  toCategoryDto,
  toPostDto,
  toPostListItem,
  toPublicCard,
  toPublicPost,
  type PostRow,
} from './blog.mapper';
import { parsePageContent } from './cms-rules';
import type {
  BlogQueryDto,
  CreateBlogCategoryDto,
  CreateBlogPostDto,
  UpdateBlogCategoryDto,
  UpdateBlogPostDto,
} from './dto/blog.dto';

type BlogListParams = Pick<BlogQueryDto, 'page' | 'limit' | 'category' | 'tag'>;

/** Visible on the storefront: published and dated now or earlier. */
export const livePostWhere = (now = new Date()): Prisma.BlogPostWhereInput => ({
  status: 'PUBLISHED',
  publishedAt: { lte: now },
});

/**
 * Blog posts & categories. Rules: unique slugs, content validated like pages, a future publish date
 * schedules the post, categories with posts cannot be deleted.
 */
@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ================================================================ admin: posts

  async listPosts(): Promise<BlogPostListItem[]> {
    const posts = await this.prisma.blogPost.findMany({
      include: postInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const now = new Date();
    return posts.map((p) => toPostListItem(p, now));
  }

  async getPost(id: string): Promise<BlogPostDto> {
    return toPostDto(await this.findPost(id));
  }

  async createPost(dto: CreateBlogPostDto, actorId?: string): Promise<BlogPostDto> {
    const content = parsePageContent(dto.content);
    if (dto.categoryId) await this.findCategory(dto.categoryId);
    const created = await this.prisma.blogPost.create({
      data: {
        title: dto.title,
        slug: await this.postSlug(dto.slug, dto.title),
        excerpt: dto.excerpt ?? null,
        content: content as unknown as Prisma.InputJsonValue,
        categoryId: dto.categoryId ?? null,
        tags: parseTags(dto.tags ?? []),
        coverImageUrl: dto.coverImageUrl ?? null,
        status: dto.status,
        publishedAt: resolvePublishedAt(dto.status, dto.publishedAt, null),
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        authorId: actorId ?? null,
      },
      include: postInclude,
    });
    await this.audit.log({
      actorId,
      action: 'cms.blog.create',
      entityType: 'BlogPost',
      entityId: created.id,
      after: created,
    });
    return toPostDto(created);
  }

  async updatePost(id: string, dto: UpdateBlogPostDto, actorId?: string): Promise<BlogPostDto> {
    const existing = await this.findPost(id);
    if (dto.categoryId) await this.findCategory(dto.categoryId);
    const status = dto.status ?? existing.status;
    const updated = await this.prisma.blogPost.update({
      where: { id },
      data: {
        title: dto.title,
        slug:
          dto.slug !== undefined && dto.slug !== existing.slug
            ? await this.postSlug(dto.slug, dto.title ?? existing.title, id)
            : undefined,
        excerpt: dto.excerpt,
        content:
          dto.content !== undefined
            ? (parsePageContent(dto.content) as unknown as Prisma.InputJsonValue)
            : undefined,
        categoryId: dto.categoryId,
        tags: dto.tags !== undefined ? parseTags(dto.tags) : undefined,
        coverImageUrl: dto.coverImageUrl,
        status: dto.status,
        publishedAt: resolvePublishedAt(status, dto.publishedAt, existing.publishedAt),
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
      include: postInclude,
    });
    await this.audit.log({
      actorId,
      action: 'cms.blog.update',
      entityType: 'BlogPost',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toPostDto(updated);
  }

  async removePost(id: string, actorId?: string): Promise<void> {
    const existing = await this.findPost(id);
    await this.prisma.blogPost.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'cms.blog.delete',
      entityType: 'BlogPost',
      entityId: id,
      before: existing,
    });
  }

  // ================================================================ admin: categories

  async listCategories(): Promise<BlogCategoryDto[]> {
    const cats = await this.prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    });
    return cats.map((c) => toCategoryDto(c, c._count.posts));
  }

  async createCategory(dto: CreateBlogCategoryDto, actorId?: string): Promise<BlogCategoryDto> {
    const created = await this.prisma.blogCategory.create({
      data: { name: dto.name, slug: await this.categorySlug(dto.slug, dto.name) },
    });
    await this.audit.log({
      actorId,
      action: 'cms.blogCategory.create',
      entityType: 'BlogCategory',
      entityId: created.id,
      after: created,
    });
    return toCategoryDto(created, 0);
  }

  async updateCategory(
    id: string,
    dto: UpdateBlogCategoryDto,
    actorId?: string,
  ): Promise<BlogCategoryDto> {
    const existing = await this.findCategory(id);
    const updated = await this.prisma.blogCategory.update({
      where: { id },
      data: {
        name: dto.name,
        slug:
          dto.slug !== undefined && dto.slug !== existing.slug
            ? await this.categorySlug(dto.slug, dto.name ?? existing.name, id)
            : undefined,
      },
      include: { _count: { select: { posts: true } } },
    });
    await this.audit.log({
      actorId,
      action: 'cms.blogCategory.update',
      entityType: 'BlogCategory',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toCategoryDto(updated, updated._count.posts);
  }

  async removeCategory(id: string, actorId?: string): Promise<void> {
    const existing = await this.findCategory(id);
    const posts = await this.prisma.blogPost.count({ where: { categoryId: id } });
    if (posts > 0) {
      throw new ConflictException(
        `This category has ${posts} post${posts === 1 ? '' : 's'} — move them to another category first`,
      );
    }
    await this.prisma.blogCategory.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'cms.blogCategory.delete',
      entityType: 'BlogCategory',
      entityId: id,
      before: existing,
    });
  }

  // ================================================================ storefront

  async publicPosts(q: BlogListParams): Promise<Paginated<PublicBlogCard>> {
    const where: Prisma.BlogPostWhereInput = {
      ...livePostWhere(),
      ...(q.category ? { category: { slug: q.category } } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        include: postInclude,
        orderBy: { publishedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return paginate(rows.map(toPublicCard), total, q.page, q.limit);
  }

  async publicPost(slug: string): Promise<PublicBlogPost> {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, ...livePostWhere() },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Post not found');
    const related = post.categoryId
      ? await this.prisma.blogPost.findMany({
          where: { ...livePostWhere(), categoryId: post.categoryId, NOT: { id: post.id } },
          include: postInclude,
          orderBy: { publishedAt: 'desc' },
          take: 3,
        })
      : [];
    return toPublicPost(post, related);
  }

  /** Categories that have at least one live post. */
  async publicCategories(): Promise<BlogCategoryDto[]> {
    const cats = await this.prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: { where: livePostWhere() } } } },
    });
    return cats.filter((c) => c._count.posts > 0).map((c) => toCategoryDto(c, c._count.posts));
  }

  async sitemap(): Promise<SitemapEntries> {
    const [pages, posts] = await Promise.all([
      this.prisma.page.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.blogPost.findMany({
        where: livePostWhere(),
        select: { slug: true, updatedAt: true },
      }),
    ]);
    const iso = (r: { slug: string; updatedAt: Date }) => ({
      slug: r.slug,
      updatedAt: r.updatedAt.toISOString(),
    });
    return { pages: pages.map(iso), posts: posts.map(iso) };
  }

  // ================================================================ helpers

  private async findPost(id: string): Promise<PostRow> {
    const post = await this.prisma.blogPost.findUnique({ where: { id }, include: postInclude });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async findCategory(id: string): Promise<BlogCategory> {
    const cat = await this.prisma.blogCategory.findUnique({ where: { id } });
    if (!cat) throw new BadRequestException('Category not found');
    return cat;
  }

  private postSlug(requested: string | undefined, source: string, excludeId?: string) {
    return uniqueSlug({
      requested,
      source,
      entity: 'post',
      isTaken: async (slug) =>
        (await this.prisma.blogPost.findFirst({
          where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
          select: { id: true },
        })) !== null,
    });
  }

  private categorySlug(requested: string | undefined, source: string, excludeId?: string) {
    return uniqueSlug({
      requested,
      source,
      entity: 'category',
      isTaken: async (slug) =>
        (await this.prisma.blogCategory.findFirst({
          where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
          select: { id: true },
        })) !== null,
    });
  }
}

/**
 * Publish date rules: an explicit date wins (future = scheduled); otherwise keep the existing date,
 * or stamp "now" the first time a post is published. Drafts keep whatever date they had.
 */
export function resolvePublishedAt(
  status: 'DRAFT' | 'PUBLISHED',
  requested: string | null | undefined,
  existing: Date | null,
  now = new Date(),
): Date | null {
  if (requested) return new Date(requested);
  if (requested === null && status === 'DRAFT') return null;
  if (status === 'PUBLISHED') return existing ?? now;
  return existing;
}
