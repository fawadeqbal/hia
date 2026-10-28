import { Module } from '@nestjs/common';
import {
  AdminLocalizationController,
  AdminTaxesController,
  PublicLocalizationController,
} from './localization.controller';
import { LocalizationService } from './localization.service';
import { TaxesService } from './taxes.service';

/** Taxes, currencies and storefront languages. */
@Module({
  controllers: [PublicLocalizationController, AdminTaxesController, AdminLocalizationController],
  providers: [TaxesService, LocalizationService],
  exports: [TaxesService, LocalizationService],
})
export class LocalizationModule {}
