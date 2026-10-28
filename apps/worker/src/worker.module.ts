import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@ecommerce/types';
import { redisConnectionFromUrl } from './config/redis';
import { PrismaService } from './prisma.service';
import { MailModule } from './mail/mail.module';
import { EmailProcessor } from './processors/email.processor';
import { MaintenanceProcessor } from './processors/maintenance.processor';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionFromUrl(
          config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        ),
      }),
    }),
    BullModule.registerQueue(...Object.values(QUEUE_NAMES).map((name) => ({ name }))),
    MailModule,
  ],
  providers: [PrismaService, EmailProcessor, MaintenanceProcessor, SchedulerService],
})
export class WorkerModule {}
