import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('reports ok when the database responds', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([1]) } },
      ],
    }).compile();

    const result = await moduleRef.get(HealthController).check();
    expect(result.status).toBe('ok');
  });
});
