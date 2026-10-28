import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AccessModule } from './common/access/access.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SearchModule } from './modules/search/search.module';
import { CartModule } from './modules/cart/cart.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { CmsModule } from './modules/cms/cms.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { SupportModule } from './modules/support/support.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { LocalizationModule } from './modules/localization/localization.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SeoModule } from './modules/seo/seo.module';
import { SupportAssistantModule } from './modules/support-assistant/support-assistant.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AccessModule,
    JobsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RbacModule,
    VendorsModule,
    CatalogModule,
    InventoryModule,
    SearchModule,
    CartModule,
    CheckoutModule,
    PricingModule,
    PromotionsModule,
    OrdersModule,
    PaymentsModule,
    ShippingModule,
    ReturnsModule,
    ReviewsModule,
    WishlistModule,
    LoyaltyModule,
    RecommendationsModule,
    CmsModule,
    MediaModule,
    NotificationsModule,
    MarketingModule,
    SupportModule,
    PayoutsModule,
    LocalizationModule,
    AnalyticsModule,
    SeoModule,
    SupportAssistantModule,
    SettingsModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
