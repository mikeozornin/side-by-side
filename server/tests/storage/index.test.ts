import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createStorageFromEnv } from '../../src/storage/index.js';

describe('Storage Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create local storage driver by default', () => {
    process.env.STORAGE_DRIVER = 'local';
    process.env.DATA_DIR = '/tmp/test-data';

    const storage = createStorageFromEnv();

    expect(storage).toBeDefined();
    expect(storage.constructor.name).toBe('LocalStorageDriver');
  });

  it('should create S3 storage driver when configured', () => {
    process.env.STORAGE_DRIVER = 's3';
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_ACCESS_KEY_ID = 'test-key';
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
    process.env.S3_FORCE_PATH_STYLE = 'true';

    const storage = createStorageFromEnv();

    expect(storage).toBeDefined();
    expect(storage.constructor.name).toBe('S3StorageDriver');
  });

  it('should throw error for missing S3 configuration', () => {
    process.env.STORAGE_DRIVER = 's3';
    // Missing required S3 env vars

    expect(() => createStorageFromEnv()).toThrow('Missing required S3 configuration');
  });

  it('should throw error for unsupported driver', () => {
    process.env.STORAGE_DRIVER = 'unsupported';

    expect(() => createStorageFromEnv()).toThrow('Unsupported storage driver: unsupported');
  });
});
