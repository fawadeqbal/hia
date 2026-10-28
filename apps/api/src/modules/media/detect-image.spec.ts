import { detectImage } from './detect-image';

function png(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function gif(width: number, height: number): Buffer {
  const buf = Buffer.alloc(16);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function jpeg(width: number, height: number): Buffer {
  // SOI, APP0 (length 16), SOF0 (length 17)
  const app0 = Buffer.alloc(18);
  app0.writeUInt16BE(0xffe0, 0);
  app0.writeUInt16BE(16, 2);
  const sof = Buffer.alloc(19);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

describe('detectImage', () => {
  it('reads PNG dimensions', () => {
    expect(detectImage(png(640, 480))).toEqual({
      mime: 'image/png',
      ext: 'png',
      width: 640,
      height: 480,
    });
  });

  it('reads GIF dimensions', () => {
    expect(detectImage(gif(32, 16))).toMatchObject({ mime: 'image/gif', width: 32, height: 16 });
  });

  it('reads JPEG dimensions from the SOF segment', () => {
    expect(detectImage(jpeg(1200, 800))).toMatchObject({
      mime: 'image/jpeg',
      ext: 'jpg',
      width: 1200,
      height: 800,
    });
  });

  it('rejects files that are not images, whatever their name says', () => {
    expect(detectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImage(Buffer.from('%PDF-1.7 fake pdf content'))).toBeNull();
    expect(detectImage(Buffer.alloc(4))).toBeNull();
  });
});
