import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_PROVIDER } from './mail-provider.interface';
import { SmtpMailProvider } from './smtp.provider';

@Module({
  providers: [
    SmtpMailProvider,
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService, SmtpMailProvider],
      useFactory: (config: ConfigService, smtp: SmtpMailProvider) => {
        const provider = config.get<string>('MAIL_PROVIDER', 'smtp');
        switch (provider) {
          case 'smtp':
            return smtp;
          // case 'ses': return new SesMailProvider(config);
          default:
            throw new Error(`Unsupported MAIL_PROVIDER: ${provider}`);
        }
      },
    },
  ],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}
