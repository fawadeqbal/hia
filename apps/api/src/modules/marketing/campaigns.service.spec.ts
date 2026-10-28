import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { CustomersService } from '../users/customers.service';
import { CampaignsService } from './campaigns.service';
import type { NewsletterService } from './newsletter.service';

const content = {
  heading: 'Sale',
  body: 'Everything 10 % off',
  ctaLabel: 'Shop',
  ctaUrl: '/products',
};
const campaign = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Oct sale',
  subject: 'Sale!',
  templateKey: 'marketing.campaign',
  content,
  segment: { audience: 'everyone', segment: null },
  status: 'SCHEDULED',
  scheduledAt: new Date(0),
  sentAt: null,
  stats: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...over,
});

function setup() {
  const prisma = {
    campaign: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    subscriber: {
      findMany: jest.fn().mockResolvedValue([
        { email: 'A@x.com', userId: null },
        { email: 'b@x.com', userId: null },
      ]),
    },
    emailSuppression: { findMany: jest.fn().mockResolvedValue([{ email: 'b@x.com' }]) },
    user: { findMany: jest.fn().mockResolvedValue([{ email: 'opted@x.com' }]) },
  };
  const customers = {
    marketingAudience: jest.fn().mockResolvedValue([
      { userId: 'u1', email: 'a@x.com', firstName: 'A' },
      { userId: 'u2', email: 'opted@x.com', firstName: 'O' },
      { userId: 'u3', email: 'c@x.com', firstName: 'C' },
    ]),
  };
  const notifications = { sendEmail: jest.fn() };
  const service = new CampaignsService(
    prisma as unknown as PrismaService,
    { get: jest.fn(() => 'http://shop.pk') } as unknown as ConfigService,
    notifications as unknown as NotificationsService,
    { log: jest.fn() } as unknown as AuditService,
    customers as unknown as CustomersService,
    {
      unsubscribeUrl: (e: string) => `http://shop.pk/unsubscribe?email=${e}`,
    } as unknown as NewsletterService,
  );
  return { prisma, customers, notifications, service };
}

describe('CampaignsService', () => {
  it('merges subscribers and customers, dedupes and drops suppressed / opted-out addresses', async () => {
    const { service } = setup();
    const list = await service.recipients('everyone', null);
    expect(list.map((r) => r.email).sort()).toEqual(['a@x.com', 'c@x.com']);
    expect(list.find((r) => r.email === 'a@x.com')?.userId).toBe('u1');
  });

  it('subscribers audience does not load customers', async () => {
    const { service, customers } = setup();
    await service.recipients('subscribers', null);
    expect(customers.marketingAudience).not.toHaveBeenCalled();
  });

  it('sends a due campaign once, with absolute links and unsubscribe', async () => {
    const { prisma, notifications, service } = setup();
    prisma.campaign.findMany.mockResolvedValue([campaign()]);
    prisma.campaign.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await service.dispatchDue()).toBe(1);
    expect(notifications.sendEmail).toHaveBeenCalledTimes(2);
    const data = notifications.sendEmail.mock.calls[0][0].data;
    expect(data.ctaUrl).toBe('http://shop.pk/products');
    expect(data.unsubscribeUrl).toContain('/unsubscribe?email=');
    const final = prisma.campaign.update.mock.calls[0][0].data;
    expect(final).toMatchObject({
      status: 'SENT',
      stats: { recipients: 2, queued: 2, skipped: 0 },
    });
  });

  it('skips a campaign another worker already claimed', async () => {
    const { prisma, notifications, service } = setup();
    prisma.campaign.findMany.mockResolvedValue([campaign()]);
    prisma.campaign.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await service.dispatchDue()).toBe(0);
    expect(notifications.sendEmail).not.toHaveBeenCalled();
  });

  it('refuses to edit a sent campaign', async () => {
    const { prisma, service } = setup();
    prisma.campaign.findUnique.mockResolvedValue(campaign({ status: 'SENT' }));
    await expect(
      service.update('c1', {
        name: 'x',
        subject: 'xyz',
        content,
        audience: 'everyone',
        segment: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
