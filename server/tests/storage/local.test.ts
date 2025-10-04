import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalStorageDriver } from '../../src/storage/local.js';

describe('LocalStorageDriver', () => {
  let tempDir: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'side-by-side-test-'));
    driver = new LocalStorageDriver(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should put and get object', async () => {
    const key = 'test-file.jpg';
    const data = Buffer.from('test image data');
    const contentType = 'image/jpeg';
    const cacheControl = 'public, max-age=3600';

    await driver.putObject(key, data, contentType, cacheControl, 'test-voting');

    const stream = await driver.getObjectStream(key);
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const result = Buffer.concat(chunks);
    expect(result).toEqual(data);
  });

  it('should get object headers', async () => {
    const key = 'test-file.jpg';
    const data = Buffer.from('test image data');
    const contentType = 'image/jpeg';

    await driver.putObject(key, data, contentType, undefined, 'test-voting');

    const headers = await driver.getObjectHeaders(key);
    expect(headers['Content-Length']).toBe(data.length.toString());
    expect(headers['Last-Modified']).toBeDefined();
  });

  it('should delete object', async () => {
    const key = 'test-file.jpg';
    const data = Buffer.from('test image data');
    const contentType = 'image/jpeg';

    await driver.putObject(key, data, contentType, undefined, 'test-voting');

    // Verify file exists
    const stream = await driver.getObjectStream(key);
    expect(stream).toBeDefined();

    await driver.deleteObject(key);

    // Verify file is deleted
    await expect(driver.getObjectStream(key)).rejects.toThrow();
  });

  it('should handle missing object gracefully', async () => {
    const key = 'non-existent-file.jpg';

    await expect(driver.getObjectStream(key)).rejects.toThrow();
    await expect(driver.getObjectHeaders(key)).rejects.toThrow();
  });
});
