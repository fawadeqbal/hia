import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type CurrencyDto,
  type LanguageDto,
  type PublicLocalizationDto,
  type TaxRateDto,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrencyDto as CurrencyBody,
  LanguageDto as LanguageBody,
  TaxRateDto as TaxRateBody,
} from './dto/localization.dto';
import { LocalizationService } from './localization.service';
import { TaxesService } from './taxes.service';

@ApiTags('Localization')
@Controller('localization')
export class PublicLocalizationController {
  constructor(private readonly localization: LocalizationService) {}

  @Public()
  @Get()
  info(): Promise<PublicLocalizationDto> {
    return this.localization.publicInfo();
  }
}

/** Settings area: SUPER_ADMIN, or custom roles with the settings permission. */
@ApiTags('Admin · Taxes')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin/settings/taxes')
export class AdminTaxesController {
  constructor(private readonly taxes: TaxesService) {}

  @Get()
  list(): Promise<TaxRateDto[]> {
    return this.taxes.list();
  }

  @Post()
  create(@Body() dto: TaxRateBody, @CurrentUser('sub') actorId: string): Promise<TaxRateDto> {
    return this.taxes.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: TaxRateBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<TaxRateDto> {
    return this.taxes.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.taxes.remove(id, actorId);
  }
}

@ApiTags('Admin · Localization')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin/settings')
export class AdminLocalizationController {
  constructor(private readonly localization: LocalizationService) {}

  @Get('currencies')
  currencies(): Promise<CurrencyDto[]> {
    return this.localization.currencies();
  }

  @Post('currencies')
  createCurrency(
    @Body() dto: CurrencyBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<CurrencyDto> {
    return this.localization.createCurrency(dto, actorId);
  }

  @Patch('currencies/:code')
  updateCurrency(
    @Param('code') code: string,
    @Body() dto: CurrencyBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<CurrencyDto> {
    return this.localization.updateCurrency(code, dto, actorId);
  }

  @Post('currencies/:code/default')
  defaultCurrency(
    @Param('code') code: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<CurrencyDto[]> {
    return this.localization.makeDefaultCurrency(code, actorId);
  }

  @Delete('currencies/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCurrency(@Param('code') code: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.localization.removeCurrency(code, actorId);
  }

  @Get('languages')
  languages(): Promise<LanguageDto[]> {
    return this.localization.languages();
  }

  @Post('languages')
  createLanguage(
    @Body() dto: LanguageBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<LanguageDto> {
    return this.localization.createLanguage(dto, actorId);
  }

  @Patch('languages/:code')
  updateLanguage(
    @Param('code') code: string,
    @Body() dto: LanguageBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<LanguageDto> {
    return this.localization.updateLanguage(code, dto, actorId);
  }

  @Post('languages/:code/default')
  defaultLanguage(
    @Param('code') code: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<LanguageDto[]> {
    return this.localization.makeDefaultLanguage(code, actorId);
  }

  @Delete('languages/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLanguage(@Param('code') code: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.localization.removeLanguage(code, actorId);
  }
}
