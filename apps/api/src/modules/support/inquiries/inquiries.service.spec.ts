import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import { InquiriesService } from './inquiries.service';

const now = new Date('2026-10-28T10:00:00Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    number: 'INQ-261028-AB12',
    customerId: null,
    name: 'Ali Khan',
    phone: '0300 1234567',
    email: 'ali@example.com',
    topic: 'REPAIR',
    subject: 'Chair repair / maintenance — Ali Khan',
    status: 'OPEN',
    priority: 'MEDIUM',
    assigneeId: null,
    orderId: null,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: 'm1',
        ticketId: 't1',
        authorId: null,
        body: 'My chair keeps sinking.\nIt is 3 years old.',
        isInternal: false,
        attachments: [],
        createdAt: now,
        author: null,
      },
    ],
    ...overrides,
  };
}

function setup() {
  const tx = {
    ticketMessage: { create: jest.fn() },
    ticket: { update: jest.fn() },
  };
  const prisma = {
    ticket: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 't1', number: 'INQ-261028-AB12' }),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([row()]),
      count: jest.fn().mockResolvedValue(1),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'admin1', email: 'owner@example.com' }]),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const notifications = { sendEmail: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new InquiriesService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    notifications as unknown as NotificationsService,
    { get: jest.fn((_k: string, f?: unknown) => f) } as unknown as ConfigService,
  );
  return { prisma, tx, notifications, audit, service };
}

describe('InquiriesService', () => {
  it('creates a ticket with contact details and emails the shop and the customer', async () => {
    const { prisma, notifications, service } = setup();
    prisma.ticket.findUnique.mockResolvedValueOnce(null); // number is free

    const res = await service.create(
      {
        topic: 'QUOTE',
        name: ' Ayesha ',
        phone: '0300 1234567',
        email: 'Ayesha@Example.com',
        company: 'City School',
        message: 'We need 40 gas lifts and 200 wheels.',
      },
      null,
    );

    expect(res.number).toBe('INQ-261028-AB12');
    const data = prisma.ticket.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      topic: 'QUOTE',
      name: 'Ayesha',
      phone: '0300 1234567',
      email: 'ayesha@example.com',
      priority: 'HIGH',
      subject: 'Wholesale, bulk or institutional quote — City School',
    });
    expect(data.messages.create.body).toContain('Company / institution: City School');
    const templates = notifications.sendEmail.mock.calls.map((c) => c[0].template);
    expect(templates).toEqual(['admin.new-ticket', 'support.ticket-created']);
  });

  it('does not email the customer when no email was given', async () => {
    const { prisma, notifications, service } = setup();
    prisma.ticket.findUnique.mockResolvedValueOnce(null);
    await service.create(
      {
        topic: 'REPAIR',
        name: 'Bilal',
        phone: '03001234567',
        email: '',
        message: 'Broken armrest on my chair.',
      },
      null,
    );
    expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
    expect(notifications.sendEmail.mock.calls[0][0].to).toBe('owner@example.com');
  });

  it('a failing email never fails the inquiry', async () => {
    const { prisma, notifications, service } = setup();
    prisma.ticket.findUnique.mockResolvedValueOnce(null);
    notifications.sendEmail.mockRejectedValue(new Error('smtp down'));
    await expect(
      service.create(
        {
          topic: 'GENERAL',
          name: 'Sara',
          phone: '03001234567',
          message: 'Do you deliver to Lahore?',
        },
        null,
      ),
    ).resolves.toEqual({ number: 'INQ-261028-AB12' });
  });

  it('maps the first customer message and keeps staff notes separate', async () => {
    const { prisma, service } = setup();
    prisma.ticket.findUnique.mockResolvedValueOnce(
      row({
        messages: [
          ...row().messages,
          {
            id: 'm2',
            ticketId: 't1',
            authorId: 'admin1',
            body: 'Called him, visit on Monday.',
            isInternal: true,
            attachments: [],
            createdAt: now,
            author: { firstName: 'HIA', lastName: 'Admin' },
          },
        ],
      }),
    );
    const dto = await service.adminGet('t1');
    expect(dto.preview).toBe('My chair keeps sinking.');
    expect(dto.message).toContain('3 years old');
    expect(dto.notes).toEqual([
      expect.objectContaining({ body: 'Called him, visit on Monday.', authorName: 'HIA Admin' }),
    ]);
  });

  it('adding a note to a new inquiry moves it to In progress', async () => {
    const { prisma, tx, service } = setup();
    prisma.ticket.findUnique.mockResolvedValue(row());
    await service.addNote('t1', 'Quoted Rs 2,200 each.', 'admin1');
    expect(tx.ticketMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 't1', body: 'Quoted Rs 2,200 each.', authorId: 'admin1', isInternal: true },
    });
    expect(tx.ticket.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'PENDING' },
    });
  });

  it('404 for an unknown inquiry', async () => {
    const { prisma, service } = setup();
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(service.setStatus('nope', 'RESOLVED', 'admin1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
