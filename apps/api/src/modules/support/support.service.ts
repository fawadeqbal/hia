import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SupportService — Tickets and dispute handling.
 *
 * Scope responsibilities:
 *  - Contact form → ticket + confirmation email
 *  - Ticket inbox: assign, prioritise, reply by email, internal notes
 *  - Customer–vendor disputes
 */
@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  status() {
    return { module: 'support', status: 'scaffolded' };
  }
}
