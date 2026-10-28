import type { AcceptedImageType } from '@ecommerce/types';

export interface DetectedImage {
  mime: AcceptedImageType;
  ext: 'jpg' | 'png' | 'webp' | 'gif' | 'avif';
  width: number | null;
  height: number | null;
}

/**
 * Identifies an image from its first bytes (magic numbers) and reads its dimensions.
 * The client-supplied MIME type / file name is never trusted.
 * Returns null for anything that is not a supported image.
 */
export function detectImage(buf: Buffer): DetectedImage | null {
  if (buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width/height at 16/20
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    return {
      mime: 'image/png',
      ext: 'png',
      width: buf.length >= 24 ? buf.readUInt32BE(16) : null,
      height: buf.length >= 24 ? buf.readUInt32BE(20) : null,
    };
  }

  // GIF87a / GIF89a, logical screen size at 6/8 (little-endian)
  const head6 = buf.toString('ascii', 0, 6);
  if (head6 === 'GIF87a' || head6 === 'GIF89a') {
    return {
      mime: 'image/gif',
      ext: 'gif',
      width: buf.readUInt16LE(6),
      height: buf.readUInt16LE(8),
    };
  }

  // JPEG: FF D8 FF, dimensions in the first SOFn segment
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    const size = jpegSize(buf);
    return {
      mime: 'image/jpeg',
      ext: 'jpg',
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  }

  // WebP: "RIFF" .... "WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const size = webpSize(buf);
    return {
      mime: 'image/webp',
      ext: 'webp',
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  }

  // AVIF: ISO-BMFF "ftyp" box with avif/avis brand
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis')
      return { mime: 'image/avif', ext: 'avif', width: null, height: null };
  }

  return null;
}

function jpegSize(buf: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function webpSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (chunk === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  return null;
}
