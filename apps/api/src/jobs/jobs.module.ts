import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@ecommerce/types';
import { redisConnectionFromUrl } from '../config/redis';

/**
 * Registers BullMQ queues (producers). Consumers live in apps/worker.
 * Inject a queue anywhere with @InjectQueue(QUEUE_NAMES.EMAIL).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionFromUrl(config.getOrThrow<string>('REDIS_URL')),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    }),
    BullModule.registerQueue(...Object.values(QUEUE_NAMES).map((name) => ({ name }))),
  ],
  exports: [BullModule],
})
export class JobsModule {}
