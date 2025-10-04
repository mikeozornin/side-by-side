import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageDriver } from './types.js';

export class S3StorageDriver implements StorageDriver {
  private s3Client: S3Client;
  private bucket: string;

  constructor(
    endpoint: string,
    region: string,
    bucket: string,
    accessKeyId: string,
    secretAccessKey: string,
    forcePathStyle: boolean = true
  ) {
    // Validate required parameters
    if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing required S3 configuration. Please set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY');
    }

    this.bucket = bucket;

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });
  }

  async putObject(key: string, data: Buffer, contentType: string, cacheControl?: string, votingId?: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      CacheControl: cacheControl || 'public, max-age=31536000',
    });

    await this.s3Client.send(command);
  }

  async getObjectStream(key: string): Promise<ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    // Convert Node.js stream to Web Stream
    return response.Body.transformToWebStream();
  }

  async getObjectHeaders(key: string): Promise<Record<string, string>> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    const headers: Record<string, string> = {};
    
    if (response.ContentType) headers['Content-Type'] = response.ContentType;
    if (response.ContentLength) headers['Content-Length'] = response.ContentLength.toString();
    if (response.LastModified) headers['Last-Modified'] = response.LastModified.toUTCString();
    if (response.CacheControl) headers['Cache-Control'] = response.CacheControl;
    if (response.ETag) headers['ETag'] = response.ETag;

    return headers;
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

}
