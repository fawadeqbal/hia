# @ecommerce/worker

Standalone NestJS process that consumes BullMQ queues produced by `apps/api`.

| Queue                                      | Processor              | Purpose                                                                                  |
| ------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------- |
| `email`                                    | `EmailProcessor`       | Render (React Email) + deliver every email, update `EmailLog`                            |
| `maintenance`                              | `MaintenanceProcessor` | Cron jobs: release reservations, abandoned carts, loyalty expiry, payouts, sales summary |
| `marketing`, `reports`, `imports`, `media` | _to add_               | Campaigns, report exports, CSV imports, image processing                                 |

Email providers implement `MailProvider` (`src/mail`). SMTP (Mailpit locally) is included; add SES/SendGrid/Resend by
implementing the interface and setting `MAIL_PROVIDER`.
