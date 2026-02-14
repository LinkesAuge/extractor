import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { preprocessImage } from '../../../src/ocr/image-preprocessor.js';

/** Create a simple 20x20 test image. */
async function createTestImage() {
  return sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 128, g: 128, b: 128 } },
  }).png().toBuffer();
}

describe('preprocessImage', () => {
  it('returns a buffer', async () => {
    const input = await createTestImage();
    const result = await preprocessImage(input, {
      scale: 1, greyscale: false, sharpen: 0, contrast: 1.0, threshold: 0,
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('scales the image when scale > 1', async () => {
    const input = await createTestImage();
    const result = await preprocessImage(input, {
      scale: 2, greyscale: false, sharpen: 0, contrast: 1.0, threshold: 0,
    });
    const meta = await sharp(result).metadata();
    // 20px * 2 + 20px border on each side
    expect(meta.width).toBe(20 * 2 + 40);
  });

  it('adds white border padding', async () => {
    const input = await createTestImage();
    const result = await preprocessImage(input, {
      scale: 1, greyscale: false, sharpen: 0, contrast: 1.0, threshold: 0,
    });
    const meta = await sharp(result).metadata();
    // 20px original + 20px border on each side
    expect(meta.width).toBe(60);
    expect(meta.height).toBe(60);
  });

  it('converts to greyscale when enabled', async () => {
    const input = await createTestImage();
    const result = await preprocessImage(input, {
      scale: 1, greyscale: true, sharpen: 0, contrast: 1.0, threshold: 0,
    });
    const meta = await sharp(result).metadata();
    // Should be a valid image buffer
    expect(meta.width).toBeGreaterThan(0);
  });

  it('applies all preprocessing in combination', async () => {
    const input = await createTestImage();
    const result = await preprocessImage(input, {
      scale: 3, greyscale: true, sharpen: 0.3, contrast: 1.5, threshold: 152,
    });
    expect(Buffer.isBuffer(result)).toBe(true);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(20 * 3 + 40);
  });
});
