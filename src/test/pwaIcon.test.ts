import { describe, expect, it } from 'vitest';
import { encodePng, renderIconPixels } from '../pwa/iconArt';

function pixel(buf: Uint8Array, size: number, x: number, y: number): number[] {
  const i = (y * size + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}

describe('pwa icon', () => {
  it('paints a teal circle on the dark chrome', () => {
    const size = 192;
    const buf = renderIconPixels(size);
    expect(buf).toHaveLength(size * size * 4);
    expect(pixel(buf, size, 0, 0)).toEqual([12, 13, 12, 255]);
    expect(pixel(buf, size, 96, 96)).toEqual([46, 155, 143, 255]);
    expect(pixel(buf, size, 0, 96)).toEqual([12, 13, 12, 255]);
  });

  it('encodes a PNG whose header matches the pixel buffer', () => {
    const size = 192;
    const png = encodePng(size, size, renderIconPixels(size));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });
});
