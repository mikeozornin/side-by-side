import { LocalStorageDriver } from './local.js';
import { S3StorageDriver } from './s3.js';
import type { StorageDriver } from './types.js';

export function createStorageFromEnv(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER || 'local';

  if (driver === 'local') {
    const dataDir = process.env.DATA_DIR || './data';
    return new LocalStorageDriver(dataDir);
  }

  if (driver === 's3') {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

    if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing required S3 configuration. Please set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY');
    }

    return new S3StorageDriver(
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      forcePathStyle
    );
  }

  throw new Error(`Unsupported storage driver: ${driver}. Supported drivers: local, s3`);
}

export type { StorageDriver } from './types.js';
export { LocalStorageDriver } from './local.js';
export { S3StorageDriver } from './s3.js';
