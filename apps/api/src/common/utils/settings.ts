import type { PrismaService } from '../../prisma/prisma.service';

/** Reads a value from the Setting table (seeded defaults), falling back when missing or of the wrong type. */
export async function readSetting<T extends string | number | boolean>(
  prisma: PrismaService,
  key: string,
  fallback: T,
): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const value = row?.value as unknown;
  return typeof value === typeof fallback ? (value as T) : fallback;
}
