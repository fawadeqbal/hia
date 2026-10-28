import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { MediaService } from './media.service';
import type { StorageService } from './storage.service';

function pngBuffer(): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(200, 16);
  buf.writeUInt32BE(100, 20);
  return buf;
}

function setup() {
  const prisma = {
    media: {
      create: jest.fn(({ data }) => Promise.resolve({ id: 'm1', createdAt: new Date(), ...data })),
    },
  };
  const storage = {
    put: jest.fn((key: string, _body: Buffer, _contentType: string) =>
      Promise.resolve(`http://cdn/${key}`),
    ),
    delete: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const service = new MediaService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
    audit as unknown as AuditService,
  );
  return { prisma, storage, service };
}

describe('MediaService.uploadImage', () => {
  it('stores a real image under its folder with the detected type and size', async () => {
    const { storage, service } = setup();
    const file = {
      buffer: pngBuffer(),
      size: 33,
      originalname: 'logo.jpg',
      mimetype: 'image/jpeg',
    };

    const media = await service.uploadImage(file, 'brands', 'u1');

    const [key, , contentType] = storage.put.mock.calls[0];
    expect(key).toMatch(/^brands\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(contentType).toBe('image/png'); // detected from bytes, not the .jpg name
    expect(media).toMatchObject({
      mimeType: 'image/png',
      width: 200,
      height: 100,
      url: `http://cdn/${key}`,
    });
  });

  it('rejects a non-image disguised as one', async () => {
    const { storage, service } = setup();
    const file = {
      buffer: Buffer.from('<html>not an image</html>'),
      size: 25,
      originalname: 'x.png',
      mimetype: 'image/png',
    };

    await expect(service.uploadImage(file, 'general')).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects a missing file', async () => {
    const { service } = setup();
    await expect(service.uploadImage(undefined, 'general')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
