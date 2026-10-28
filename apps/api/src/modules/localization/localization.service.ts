import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Currency, Language } from '@ecommerce/database';
import type { CurrencyDto, LanguageDto, PublicLocalizationDto } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type {
  CurrencyDto as CurrencyBody,
  LanguageDto as LanguageBody,
} from './dto/localization.dto';

/**
 * Currencies (display conversion only: orders are charged in the default currency) and storefront languages.
 * Rules: exactly one default of each, the default is always active and cannot be deleted;
 * the store currency can only change before the first order.
 */
@Injectable()
export class LocalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async publicInfo(): Promise<PublicLocalizationDto> {
    const [currencies, languages] = await Promise.all([
      this.prisma.currency.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
      }),
      this.prisma.language.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      }),
    ]);
    const base = currencies.find((c) => c.isDefault);
    return {
      baseCurrency: base?.code ?? 'USD',
      currencies: currencies.map((c) => ({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        exchangeRate: c.isDefault ? 1 : Number(c.exchangeRate),
      })),
      defaultLanguage: languages.find((l) => l.isDefault)?.code ?? 'en',
      languages: languages.map((l) => ({ code: l.code, name: l.name, isRtl: l.isRtl })),
    };
  }

  // ---------------------------------------------------------------- currencies
  async currencies(): Promise<CurrencyDto[]> {
    const rows = await this.prisma.currency.findMany({
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    return rows.map(toCurrencyDto);
  }

  async createCurrency(dto: CurrencyBody, actorId?: string): Promise<CurrencyDto> {
    if (!dto.code) throw new BadRequestException('Enter the currency code');
    if (await this.prisma.currency.findUnique({ where: { code: dto.code } }))
      throw new ConflictException(`${dto.code} already exists`);
    const created = await this.prisma.currency.create({
      data: {
        code: dto.code,
        name: dto.name,
        symbol: dto.symbol,
        exchangeRate: dto.exchangeRate,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId,
      action: 'currency.create',
      entityType: 'Currency',
      entityId: created.code,
      after: created,
    });
    return toCurrencyDto(created);
  }

  async updateCurrency(code: string, dto: CurrencyBody, actorId?: string): Promise<CurrencyDto> {
    const before = await this.currencyOrThrow(code);
    if (before.isDefault && !dto.isActive)
      throw new BadRequestException('The store currency must stay active');
    const updated = await this.prisma.currency.update({
      where: { code },
      data: {
        name: dto.name,
        symbol: dto.symbol,
        // The store currency is the reference: always 1.
        exchangeRate: before.isDefault ? 1 : dto.exchangeRate,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId,
      action: 'currency.update',
      entityType: 'Currency',
      entityId: code,
      before,
      after: updated,
    });
    return toCurrencyDto(updated);
  }

  /** Switch the store currency (before the first order only); other rates are re-based on it. */
  async makeDefaultCurrency(code: string, actorId?: string): Promise<CurrencyDto[]> {
    const next = await this.currencyOrThrow(code);
    if (next.isDefault) return this.currencies();
    if ((await this.prisma.order.count()) > 0)
      throw new BadRequestException(
        'The store currency can only be changed before the first order. Prices, orders and payouts are stored in it.',
      );
    const factor = Number(next.exchangeRate);
    const all = await this.prisma.currency.findMany();
    await this.prisma.$transaction([
      ...all.map((c) =>
        this.prisma.currency.update({
          where: { code: c.code },
          data: {
            isDefault: c.code === code,
            isActive: c.code === code ? true : c.isActive,
            exchangeRate:
              c.code === code ? 1 : Math.round((Number(c.exchangeRate) / factor) * 1e6) / 1e6,
          },
        }),
      ),
      this.prisma.product.updateMany({ data: { currency: code } }),
    ]);
    await this.audit.log({
      actorId,
      action: 'currency.default',
      entityType: 'Currency',
      entityId: code,
    });
    return this.currencies();
  }

  async removeCurrency(code: string, actorId?: string): Promise<void> {
    const before = await this.currencyOrThrow(code);
    if (before.isDefault) throw new BadRequestException('The store currency cannot be deleted');
    await this.prisma.currency.delete({ where: { code } });
    await this.audit.log({
      actorId,
      action: 'currency.delete',
      entityType: 'Currency',
      entityId: code,
      before,
    });
  }

  // ---------------------------------------------------------------- languages
  async languages(): Promise<LanguageDto[]> {
    const rows = await this.prisma.language.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toLanguageDto);
  }

  async createLanguage(dto: LanguageBody, actorId?: string): Promise<LanguageDto> {
    if (!dto.code) throw new BadRequestException('Enter the language code');
    if (await this.prisma.language.findUnique({ where: { code: dto.code } }))
      throw new ConflictException(`${dto.code} already exists`);
    const created = await this.prisma.language.create({
      data: { code: dto.code, name: dto.name, isRtl: dto.isRtl, isActive: dto.isActive },
    });
    await this.audit.log({
      actorId,
      action: 'language.create',
      entityType: 'Language',
      entityId: created.code,
      after: created,
    });
    return toLanguageDto(created);
  }

  async updateLanguage(code: string, dto: LanguageBody, actorId?: string): Promise<LanguageDto> {
    const before = await this.languageOrThrow(code);
    if (before.isDefault && !dto.isActive)
      throw new BadRequestException('The default language must stay active');
    const updated = await this.prisma.language.update({
      where: { code },
      data: { name: dto.name, isRtl: dto.isRtl, isActive: dto.isActive },
    });
    await this.audit.log({
      actorId,
      action: 'language.update',
      entityType: 'Language',
      entityId: code,
      before,
      after: updated,
    });
    return toLanguageDto(updated);
  }

  async makeDefaultLanguage(code: string, actorId?: string): Promise<LanguageDto[]> {
    const next = await this.languageOrThrow(code);
    if (!next.isActive) throw new BadRequestException('Activate the language first');
    await this.prisma.$transaction([
      this.prisma.language.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.language.update({ where: { code }, data: { isDefault: true } }),
    ]);
    await this.audit.log({
      actorId,
      action: 'language.default',
      entityType: 'Language',
      entityId: code,
    });
    return this.languages();
  }

  async removeLanguage(code: string, actorId?: string): Promise<void> {
    const before = await this.languageOrThrow(code);
    if (before.isDefault) throw new BadRequestException('The default language cannot be deleted');
    await this.prisma.language.delete({ where: { code } });
    await this.audit.log({
      actorId,
      action: 'language.delete',
      entityType: 'Language',
      entityId: code,
      before,
    });
  }

  private async currencyOrThrow(code: string): Promise<Currency> {
    const row = await this.prisma.currency.findUnique({ where: { code: code.toUpperCase() } });
    if (!row) throw new NotFoundException('Currency not found');
    return row;
  }

  private async languageOrThrow(code: string): Promise<Language> {
    const row = await this.prisma.language.findUnique({ where: { code } });
    if (!row) throw new NotFoundException('Language not found');
    return row;
  }
}

export const toCurrencyDto = (c: Currency): CurrencyDto => ({
  code: c.code,
  name: c.name,
  symbol: c.symbol,
  exchangeRate: c.isDefault ? 1 : Number(c.exchangeRate),
  isDefault: c.isDefault,
  isActive: c.isActive,
});

export const toLanguageDto = (l: Language): LanguageDto => ({
  code: l.code,
  name: l.name,
  isDefault: l.isDefault,
  isActive: l.isActive,
  isRtl: l.isRtl,
});
