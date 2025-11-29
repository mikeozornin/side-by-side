import { describe, it, expect } from 'bun:test';
import { createPolygonMask, resizeToFill } from '../../src/utils/previewGenerator.js';
import Jimp from 'jimp';

describe('Preview Generator Utils', () => {
  describe('createPolygonMask', () => {
    it('should create a mask image with correct dimensions', async () => {
      const points: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];
      const width = 100;
      const height = 100;

      const mask = await createPolygonMask(points, width, height);

      expect(mask.bitmap.width).toBe(width);
      expect(mask.bitmap.height).toBe(height);
    });

    it('should create white pixels inside the polygon', async () => {
      // Simple square polygon
      const points: Array<[number, number]> = [[10, 10], [90, 10], [90, 90], [10, 90]];
      const width = 100;
      const height = 100;

      const mask = await createPolygonMask(points, width, height);

      // Check a point inside the polygon (center)
      const centerX = 50;
      const centerY = 50;
      const idx = (centerY * width + centerX) * 4;

      expect(mask.bitmap.data[idx]).toBe(255);     // R
      expect(mask.bitmap.data[idx + 1]).toBe(255); // G
      expect(mask.bitmap.data[idx + 2]).toBe(255); // B
      expect(mask.bitmap.data[idx + 3]).toBe(255); // A
    });

    it('should create transparent pixels outside the polygon', async () => {
      // Simple square polygon
      const points: Array<[number, number]> = [[10, 10], [90, 10], [90, 90], [10, 90]];
      const width = 100;
      const height = 100;

      const mask = await createPolygonMask(points, width, height);

      // Check a point outside the polygon (corner)
      const cornerX = 5;
      const cornerY = 5;
      const idx = (cornerY * width + cornerX) * 4;

      expect(mask.bitmap.data[idx]).toBe(0);     // R
      expect(mask.bitmap.data[idx + 1]).toBe(0); // G
      expect(mask.bitmap.data[idx + 2]).toBe(0); // B
      expect(mask.bitmap.data[idx + 3]).toBe(0); // A
    });
  });

  describe('resizeToFill', () => {
    it('should resize image to exact target dimensions', async () => {
      // Create a test image
      const testImage = new Jimp(200, 100, 0xFF0000FF); // Red image, 200x100
      const buffer = await testImage.getBufferAsync(Jimp.MIME_PNG);

      // Resize to 100x100
      const resizedBuffer = await resizeToFill(buffer, 100, 100);

      // Check that result has correct dimensions
      const resultImage = await Jimp.read(resizedBuffer);
      expect(resultImage.bitmap.width).toBe(100);
      expect(resultImage.bitmap.height).toBe(100);
    });

    it('should maintain aspect ratio when upscaling wide image to square', async () => {
      // Create a wide image (2:1 aspect ratio)
      const testImage = new Jimp(200, 100, 0xFF0000FF); // 200x100
      const buffer = await testImage.getBufferAsync(Jimp.MIME_PNG);

      // Resize to square (1:1 aspect ratio)
      const resizedBuffer = await resizeToFill(buffer, 100, 100);

      // Result should be 100x100
      const resultImage = await Jimp.read(resizedBuffer);
      expect(resultImage.bitmap.width).toBe(100);
      expect(resultImage.bitmap.height).toBe(100);

      // The original aspect ratio was 2:1, target is 1:1
      // Function should scale by max(scaleX, scaleY) = max(100/200, 100/100) = max(0.5, 1.0) = 1.0
      // So new dimensions: 200*1.0 = 200, 100*1.0 = 100, then crop to 100x100
    });

    it('should maintain aspect ratio when upscaling tall image to square', async () => {
      // Create a tall image (1:2 aspect ratio)
      const testImage = new Jimp(100, 200, 0x00FF00FF); // 100x200, green
      const buffer = await testImage.getBufferAsync(Jimp.MIME_PNG);

      // Resize to square (1:1 aspect ratio)
      const resizedBuffer = await resizeToFill(buffer, 100, 100);

      // Result should be 100x100
      const resultImage = await Jimp.read(resizedBuffer);
      expect(resultImage.bitmap.width).toBe(100);
      expect(resultImage.bitmap.height).toBe(100);

      // The original aspect ratio was 1:2, target is 1:1
      // Function should scale by max(scaleX, scaleY) = max(100/100, 100/200) = max(1.0, 0.5) = 1.0
      // So new dimensions: 100*1.0 = 100, 200*1.0 = 200, then crop to 100x100
    });
  });
});
