import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import type { AttributeDto, AttributeType, AttributeValueDto } from '@ecommerce/types';
import { uniqueSlug } from '../../../common/utils/unique-slug';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type {
  AttributeValueInputDto,
  CreateAttributeDto,
  UpdateAttributeDto,
} from './dto/attribute.dto';

const withValues = {
  values: {
    orderBy: { position: 'asc' },
    include: { _count: { select: { variants: true } } },
  },
} satisfies Prisma.AttributeInclude;

type AttributeWithValues = Prisma.AttributeGetPayload<{ include: typeof withValues }>;

/**
 * Attributes (Color, Size, Storage…) and their values. Product variants link to values.
 * Rules: unique code; unique value keys per attribute; values used by variants cannot be removed;
 * an attribute whose values are used cannot be deleted.
 */
@Injectable()
export class AttributesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AttributeDto[]> {
    const rows = await this.prisma.attribute.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: withValues,
    });
    return rows.map(toAttributeDto);
  }

  /** Public: attributes shown as storefront filters. */
  async listFilterable(): Promise<AttributeDto[]> {
    const rows = await this.prisma.attribute.findMany({
      where: { isFilterable: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: withValues,
    });
    return rows.map(toAttributeDto);
  }

  async get(id: string): Promise<AttributeDto> {
    return toAttributeDto(await this.findOrThrow(id));
  }

  async create(dto: CreateAttributeDto, actorId?: string): Promise<AttributeDto> {
    const values = dto.values ?? [];
    assertUniqueValueKeys(values);
    if (values.some((v) => v.id))
      throw new BadRequestException('New attributes cannot reference existing value ids');

    const created = await this.prisma.attribute.create({
      data: {
        name: dto.name,
        code: await this.resolveCode(dto.code, dto.name),
        type: dto.type ?? 'select',
        isFilterable: dto.isFilterable ?? true,
        position: dto.position ?? 0,
        values: { create: values.map((v, i) => valueData(v, i)) },
      },
      include: withValues,
    });

    await this.audit.log({
      actorId,
      action: 'catalog.attribute.create',
      entityType: 'Attribute',
      entityId: created.id,
      after: created,
    });
    return toAttributeDto(created);
  }

  async update(id: string, dto: UpdateAttributeDto, actorId?: string): Promise<AttributeDto> {
    const existing = await this.findOrThrow(id);
    const code =
      dto.code !== undefined && dto.code !== existing.code
        ? await this.resolveCode(dto.code, dto.name ?? existing.name, id)
        : undefined;

    if (dto.values) this.assertValueChanges(existing, dto.values);

    await this.prisma.$transaction(async (tx) => {
      await tx.attribute.update({
        where: { id },
        data: {
          name: dto.name,
          code,
          type: dto.type,
          isFilterable: dto.isFilterable,
          position: dto.position,
        },
      });
      if (dto.values) await syncValues(tx, existing, dto.values);
    });

    const updated = await this.findOrThrow(id);
    await this.audit.log({
      actorId,
      action: 'catalog.attribute.update',
      entityType: 'Attribute',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toAttributeDto(updated);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const attribute = await this.findOrThrow(id);
    const used = attribute.values.reduce((sum, v) => sum + v._count.variants, 0);
    if (used > 0) {
      throw new ConflictException(
        `"${attribute.name}" is used by ${used} product variants. Remove it from those products first.`,
      );
    }
    await this.prisma.attribute.delete({ where: { id } }); // values cascade
    await this.audit.log({
      actorId,
      action: 'catalog.attribute.delete',
      entityType: 'Attribute',
      entityId: id,
      before: attribute,
    });
  }

  // ---------------------------------------------------------------- helpers

  private async findOrThrow(id: string): Promise<AttributeWithValues> {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: withValues,
    });
    if (!attribute) throw new NotFoundException('Attribute not found');
    return attribute;
  }

  /** Validates a desired value list against the current one before touching the database. */
  private assertValueChanges(existing: AttributeWithValues, values: AttributeValueInputDto[]) {
    assertUniqueValueKeys(values);
    const current = new Map(existing.values.map((v) => [v.id, v]));
    for (const v of values) {
      if (v.id && !current.has(v.id))
        throw new BadRequestException(`Value ${v.id} does not belong to this attribute`);
    }
    const kept = new Set(values.map((v) => v.id).filter(Boolean));
    const removedInUse = existing.values.filter((v) => !kept.has(v.id) && v._count.variants > 0);
    if (removedInUse.length > 0) {
      const names = removedInUse.map((v) => `"${v.label ?? v.value}"`).join(', ');
      throw new ConflictException(`Cannot remove ${names}: used by product variants`);
    }
  }

  private resolveCode(
    requested: string | undefined,
    name: string,
    excludeId?: string,
  ): Promise<string> {
    return uniqueSlug({
      requested,
      source: name,
      entity: 'attribute',
      label: 'Code',
      isTaken: async (code) =>
        Boolean(
          await this.prisma.attribute.findFirst({
            where: { code, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
            select: { id: true },
          }),
        ),
    });
  }
}

// ------------------------------------------------------------------ pure helpers

function assertUniqueValueKeys(values: AttributeValueInputDto[]) {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v.value)) throw new BadRequestException(`Duplicate value "${v.value}"`);
    seen.add(v.value);
  }
}

function valueData(v: AttributeValueInputDto, index: number) {
  return {
    value: v.value,
    label: v.label ?? null,
    swatch: v.swatch ? v.swatch.toLowerCase() : null,
    position: v.position ?? index,
  };
}

/**
 * Applies the desired value list: delete removed, then update/create.
 * Existing values are first moved to temporary keys so swaps/renames never hit the
 * (attributeId, value) unique constraint mid-way.
 */
async function syncValues(
  tx: Prisma.TransactionClient,
  existing: AttributeWithValues,
  values: AttributeValueInputDto[],
) {
  const kept = new Set(values.map((v) => v.id).filter((id): id is string => Boolean(id)));
  const removed = existing.values.filter((v) => !kept.has(v.id)).map((v) => v.id);
  if (removed.length > 0) await tx.attributeValue.deleteMany({ where: { id: { in: removed } } });

  for (const id of kept) {
    await tx.attributeValue.update({ where: { id }, data: { value: `__tmp__${id}` } });
  }

  for (const [index, v] of values.entries()) {
    const data = valueData(v, index);
    if (v.id) await tx.attributeValue.update({ where: { id: v.id }, data });
    else await tx.attributeValue.create({ data: { ...data, attributeId: existing.id } });
  }
}

function toValueDto(v: AttributeWithValues['values'][number]): AttributeValueDto {
  return {
    id: v.id,
    value: v.value,
    label: v.label,
    swatch: v.swatch,
    position: v.position,
    usageCount: v._count.variants,
  };
}

export function toAttributeDto(a: AttributeWithValues): AttributeDto {
  return {
    id: a.id,
    name: a.name,
    code: a.code,
    type: a.type as AttributeType,
    isFilterable: a.isFilterable,
    position: a.position,
    values: a.values.map(toValueDto),
  };
}
