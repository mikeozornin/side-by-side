export interface StorageDriver {
  /**
   * Upload an object to storage
   * @param key - Object key (filename)
   * @param data - File data buffer
   * @param contentType - MIME type
   * @param cacheControl - Cache control header (optional)
   * @param votingId - Voting ID for local storage organization (optional)
   */
  putObject(key: string, data: Buffer, contentType: string, cacheControl?: string, votingId?: string): Promise<void>;

  /**
   * Get object as readable stream
   * @param key - Object key (filename)
   * @returns Readable stream of object data
   */
  getObjectStream(key: string): Promise<ReadableStream>;

  /**
   * Get object metadata headers
   * @param key - Object key (filename)
   * @returns Object with headers like Content-Type, Content-Length, etc.
   */
  getObjectHeaders(key: string): Promise<Record<string, string>>;

  /**
   * Delete an object
   * @param key - Object key (filename)
   */
  deleteObject(key: string): Promise<void>;

}

export type StorageDriverType = 'local' | 's3';

// Runtime values for the type
export const STORAGE_DRIVER_TYPES = {
  LOCAL: 'local' as const,
  S3: 's3' as const,
} as const;
