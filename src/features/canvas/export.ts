import { MAX_EDIT_MASK_BYTES, PNG_DATA_URL_PREFIX } from './constants';

export type RgbaPixelData = Uint8Array | Uint8ClampedArray | number[];

export type RgbaImageData = {
  width: number;
  height: number;
  data: RgbaPixelData;
};

type CanvasImageDataReader = {
  getImageData: (sx: number, sy: number, sw: number, sh: number) => RgbaImageData;
};

export type CanvasImageDataSource = {
  width: number;
  height: number;
  getContext: (
    contextId: '2d',
    options?: CanvasRenderingContext2DSettings,
  ) => CanvasImageDataReader | null;
  toDataURL?: (type?: string) => string;
};

export type InpaintPngExport = {
  sourcePng: string;
  maskPng: string;
  width: number;
  height: number;
  maskHasPaint: boolean;
};

export type CanvasRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export type CanvasPoint = {
  x: number;
  y: number;
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const IHDR_TYPE = asciiBytes('IHDR');
const IDAT_TYPE = asciiBytes('IDAT');
const IEND_TYPE = asciiBytes('IEND');
const MAX_DEFLATE_STORED_BLOCK_SIZE = 65_535;

let crcTable: Uint32Array | undefined;

export function exportInpaintPngs(
  sourceCanvas: CanvasImageDataSource,
  maskCanvas: CanvasImageDataSource,
): InpaintPngExport {
  const source = readCanvasImageData(sourceCanvas);
  const mask = readCanvasImageData(maskCanvas);

  if (source.width !== mask.width || source.height !== mask.height) {
    throw new Error('Source and mask canvases must have matching dimensions.');
  }

  const sourcePng = canvasToPngDataUrl(sourceCanvas, source);
  const maskPng = canvasToPngDataUrl(maskCanvas, mask);

  if (base64DataUrlBytes(maskPng) > MAX_EDIT_MASK_BYTES) {
    throw new Error("Mask PNG exceeds ima2's 16 MiB limit. Use a smaller source image.");
  }

  return {
    sourcePng,
    maskPng,
    width: source.width,
    height: source.height,
    maskHasPaint: hasNonTransparentPixel(mask),
  };
}

export function readCanvasImageData(canvas: CanvasImageDataSource): RgbaImageData {
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('2D canvas context is unavailable.');
  }

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function hasNonTransparentPixel(imageData: RgbaImageData): boolean {
  assertValidRgbaImageData(imageData);

  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] > 0) {
      return true;
    }
  }

  return false;
}

export function clientPointToCanvasPoint(
  clientPoint: CanvasPoint,
  rect: CanvasRect,
  canvasSize: { width: number; height: number },
): CanvasPoint {
  if (rect.width <= 0 || rect.height <= 0 || canvasSize.width <= 0 || canvasSize.height <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: clamp(((clientPoint.x - rect.left) / rect.width) * canvasSize.width, 0, canvasSize.width),
    y: clamp(((clientPoint.y - rect.top) / rect.height) * canvasSize.height, 0, canvasSize.height),
  };
}

export function encodePngDataUrl(imageData: RgbaImageData): string {
  return `${PNG_DATA_URL_PREFIX}${bytesToBase64(encodePngRgba(imageData))}`;
}

function canvasToPngDataUrl(canvas: CanvasImageDataSource, imageData: RgbaImageData): string {
  if (typeof canvas.toDataURL === 'function') {
    const dataUrl = canvas.toDataURL('image/png');

    if (dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
      return dataUrl;
    }
  }

  return encodePngDataUrl(imageData);
}

export function encodePngRgba(imageData: RgbaImageData): Uint8Array {
  assertValidRgbaImageData(imageData);

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, imageData.width);
  writeUint32(ihdr, 4, imageData.height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate compression
  ihdr[11] = 0; // adaptive filter
  ihdr[12] = 0; // no interlace

  const scanlines = createUnfilteredScanlines(imageData);
  const idat = zlibStore(scanlines);

  return concatBytes(
    PNG_SIGNATURE,
    pngChunk(IHDR_TYPE, ihdr),
    pngChunk(IDAT_TYPE, idat),
    pngChunk(IEND_TYPE, new Uint8Array(0)),
  );
}

function createUnfilteredScanlines(imageData: RgbaImageData): Uint8Array {
  const rowBytes = imageData.width * 4;
  const scanlines = new Uint8Array((rowBytes + 1) * imageData.height);

  for (let row = 0; row < imageData.height; row += 1) {
    const sourceStart = row * rowBytes;
    const destinationStart = row * (rowBytes + 1);
    scanlines[destinationStart] = 0;

    for (let index = 0; index < rowBytes; index += 1) {
      scanlines[destinationStart + 1 + index] = imageData.data[sourceStart + index];
    }
  }

  return scanlines;
}

function zlibStore(payload: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];

  for (let offset = 0; offset < payload.length; offset += MAX_DEFLATE_STORED_BLOCK_SIZE) {
    const chunk = payload.subarray(offset, offset + MAX_DEFLATE_STORED_BLOCK_SIZE);
    const isFinal = offset + MAX_DEFLATE_STORED_BLOCK_SIZE >= payload.length;
    const header = new Uint8Array(5);
    header[0] = isFinal ? 0x01 : 0x00;
    header[1] = chunk.length & 0xff;
    header[2] = (chunk.length >> 8) & 0xff;
    const inverseLength = (~chunk.length) & 0xffff;
    header[3] = inverseLength & 0xff;
    header[4] = (inverseLength >> 8) & 0xff;
    blocks.push(header, chunk);
  }

  const checksum = new Uint8Array(4);
  writeUint32(checksum, 0, adler32(payload));
  blocks.push(checksum);

  return concatBytes(...blocks);
}

function pngChunk(type: Uint8Array, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(concatBytes(type, data)));
  return chunk;
}

function assertValidRgbaImageData(imageData: RgbaImageData): void {
  if (!Number.isInteger(imageData.width) || imageData.width <= 0) {
    throw new Error('PNG width must be a positive integer.');
  }

  if (!Number.isInteger(imageData.height) || imageData.height <= 0) {
    throw new Error('PNG height must be a positive integer.');
  }

  const expectedLength = imageData.width * imageData.height * 4;

  if (imageData.data.length < expectedLength) {
    throw new Error('RGBA image data is shorter than width × height × 4.');
  }
}

function adler32(payload: Uint8Array): number {
  let a = 1;
  let b = 0;

  for (const byte of payload) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }

  return ((b << 16) | a) >>> 0;
}

function crc32(payload: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (const byte of payload) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getCrcTable(): Uint32Array {
  if (crcTable) {
    return crcTable;
  }

  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  crcTable = table;
  return table;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes;
}

function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }

  return bytes;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function base64DataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  const payload = (commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1)).replace(/\s+/g, '');
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';

    for (let offset = 0; offset < bytes.length; offset += 32_768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    }

    return btoa(binary);
  }

  const globalWithBuffer = globalThis as typeof globalThis & {
    Buffer?: { from: (input: Uint8Array) => { toString: (encoding: 'base64') => string } };
  };

  if (globalWithBuffer.Buffer) {
    return globalWithBuffer.Buffer.from(bytes).toString('base64');
  }

  throw new Error('No base64 encoder is available in this environment.');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
