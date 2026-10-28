import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailProvider, OutgoingMail, SendResult } from './mail-provider.interface';

/** SMTP provider — Mailpit in development, any SMTP relay (SES SMTP, etc.) in production. */
@Injectable()
export class SmtpMailProvider implements MailProvider {
  readonly name = 'smtp';
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(config.get<string>('SMTP_PORT', '1025')),
      secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: user ? { user, pass: config.get<string>('SMTP_PASSWORD', '') } : undefined,
    });
    this.from = config.get<string>('MAIL_FROM', 'Ecommerce <no-reply@example.com>');
  }

  async send(mail: OutgoingMail): Promise<SendResult> {
    const info = await this.transporter.sendMail({ from: this.from, ...mail });
    return { messageId: info.messageId, provider: this.name };
  }
}
