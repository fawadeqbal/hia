export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendResult {
  messageId?: string;
  provider: string;
}

/**
 * Provider-agnostic email interface (scope 6.1).
 * Add SES / SendGrid / Resend / Postmark by implementing this and switching MAIL_PROVIDER.
 */
export interface MailProvider {
  readonly name: string;
  send(mail: OutgoingMail): Promise<SendResult>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
