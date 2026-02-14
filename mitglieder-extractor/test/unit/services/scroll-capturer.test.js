import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import ScrollCapturer from '../../../src/scroll-capturer.js';

/** Create a solid-color 10x10 PNG buffer. */
async function createColorImage(r, g, b) {
  return sharp({
    create: { width: 10, height: 10, channels: 3, background: { r, g, b } },
  }).png().toBuffer();
}

describe('ScrollCapturer.compareBuffers (static)', () => {
  it('returns 1.0 for identical images', async () => {
    const img = await createColorImage(128, 128, 128);
    const similarity = await ScrollCapturer.compareBuffers(img, img);
    expect(similarity).toBe(1);
  });

  it('returns 1.0 for similar images within tolerance', async () => {
    const imgA = await createColorImage(100, 100, 100);
    const imgB = await createColorImage(103, 103, 103); // within default tolerance 5
    const similarity = await ScrollCapturer.compareBuffers(imgA, imgB);
    expect(similarity).toBe(1);
  });

  it('returns 0 for completely different images', async () => {
    const imgA = await createColorImage(0, 0, 0);
    const imgB = await createColorImage(255, 255, 255);
    const similarity = await ScrollCapturer.compareBuffers(imgA, imgB);
    expect(similarity).toBe(0);
  });

  it('returns 0 for different sized images', async () => {
    const imgA = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();
    const imgB = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();
    const similarity = await ScrollCapturer.compareBuffers(imgA, imgB);
    expect(similarity).toBe(0);
  });

  it('returns 0 for invalid buffers', async () => {
    const similarity = await ScrollCapturer.compareBuffers(
      Buffer.from('not-a-png'),
      Buffer.from('also-not-a-png'),
    );
    expect(similarity).toBe(0);
  });

  it('respects custom pixel tolerance', async () => {
    const imgA = await createColorImage(100, 100, 100);
    const imgB = await createColorImage(110, 110, 110);
    // Default tolerance (5) should report mismatch
    const sim5 = await ScrollCapturer.compareBuffers(imgA, imgB, 5);
    expect(sim5).toBe(0);
    // Higher tolerance (15) should match
    const sim15 = await ScrollCapturer.compareBuffers(imgA, imgB, 15);
    expect(sim15).toBe(1);
  });
});

describe('ScrollCapturer constructor defaults', () => {
  it('sets default options', () => {
    const capturer = new ScrollCapturer(null, { info: () => {} });
    expect(capturer.scrollDistance).toBe(500);
    expect(capturer.maxScreenshots).toBe(50);
    expect(capturer.similarityThreshold).toBe(0.98);
  });

  it('accepts custom options', () => {
    const capturer = new ScrollCapturer(null, { info: () => {} }, {
      scrollDistance: 350,
      maxScreenshots: 100,
      similarityThreshold: 0.95,
    });
    expect(capturer.scrollDistance).toBe(350);
    expect(capturer.maxScreenshots).toBe(100);
    expect(capturer.similarityThreshold).toBe(0.95);
  });
});
