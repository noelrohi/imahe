import { describe, expect, it } from 'vitest';

import {
  exportInpaintPngs,
  type CanvasImageDataSource,
  type RgbaImageData,
} from './export';

const PNG_PREFIX = 'data:image/png;base64,';

type DecodedPng = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

describe('canvas PNG export helpers', () => {
  it('exports matching source and alpha-mask PNGs with painted and transparent regions', () => {
    const source = memoryCanvas({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        10, 20, 30, 255,
        40, 50, 60, 255,
        70, 80, 90, 255,
        100, 110, 120, 255,
      ]),
    });
    const mask = memoryCanvas({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        255, 255, 255, 0,
        255, 255, 255, 255,
        255, 255, 255, 0,
        255, 255, 255, 0,
      ]),
    });

    const exported = exportInpaintPngs(source, mask);

    expect(exported.sourcePng.startsWith(PNG_PREFIX)).toBe(true);
    expect(exported.maskPng.startsWith(PNG_PREFIX)).toBe(true);
    expect(exported.width).toBe(2);
    expect(exported.height).toBe(2);
    expect(exported.maskHasPaint).toBe(true);

    const decodedSource = decodePng(exported.sourcePng);
    const decodedMask = decodePng(exported.maskPng);

    expect(decodedSource.width).toBe(decodedMask.width);
    expect(decodedSource.height).toBe(decodedMask.height);
    expect(alphaAt(decodedMask, 1, 0)).toBeGreaterThan(0);
    expect(alphaAt(decodedMask, 0, 0)).toBe(0);
    expect(alphaAt(decodedMask, 0, 1)).toBe(0);
  });
});

function memoryCanvas(imageData: RgbaImageData): CanvasImageDataSource {
  return {
    width: imageData.width,
    height: imageData.height,
    getContext: () => ({
      getImageData: () => imageData,
    }),
  };
}

function alphaAt(png: DecodedPng, x: number, y: number): number {
  return png.pixels[(y * png.width + x) * 4 + 3];
}

function decodePng(dataUrl: string): DecodedPng {
  const bytes = new Uint8Array(Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64'));
  expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset < bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
    }

    if (type === 'IDAT') {
      idatChunks.push(data);
    }

    if (type === 'IEND') {
      break;
    }
  }

  const raw = inflateStoredZlib(concat(idatChunks));
  const rowBytes = width * 4;
  const pixels = new Uint8Array(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    const sourceStart = row * (rowBytes + 1);
    expect(raw[sourceStart]).toBe(0);
    pixels.set(raw.slice(sourceStart + 1, sourceStart + 1 + rowBytes), row * rowBytes);
  }

  return { width, height, pixels };
}

function inflateStoredZlib(bytes: Uint8Array): Uint8Array {
  expect(bytes[0]).toBe(0x78);
  expect(bytes[1]).toBe(0x01);

  const chunks: Uint8Array[] = [];
  let offset = 2;
  let finalBlock = false;

  while (!finalBlock) {
    const header = bytes[offset];
    finalBlock = (header & 0x01) === 1;
    expect((header >> 1) & 0x03).toBe(0);
    const length = bytes[offset + 1] | (bytes[offset + 2] << 8);
    const inverseLength = bytes[offset + 3] | (bytes[offset + 4] << 8);
    expect((length ^ inverseLength) & 0xffff).toBe(0xffff);
    offset += 5;
    chunks.push(bytes.slice(offset, offset + length));
    offset += length;
  }

  return concat(chunks);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}
