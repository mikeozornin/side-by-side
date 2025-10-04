import { writeFile, readFile, stat, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { ensureDir } from 'fs-extra';
import { StorageDriver } from './types.js';

export class LocalStorageDriver implements StorageDriver {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async putObject(key: string, data: Buffer, contentType: string, cacheControl?: string, votingId?: string): Promise<void> {
    // For local storage, we need to create the directory structure
    // Key format: <hash><ext> (e.g., "a1b2c3.jpg")
    // We'll store it in a subdirectory to maintain the existing structure
    const targetVotingId = votingId || 'default';
    const votingDir = join(this.dataDir, targetVotingId);
    await ensureDir(votingDir);
    
    const filePath = join(votingDir, key);
    await writeFile(filePath, data);
  }

  async getObjectStream(key: string): Promise<ReadableStream> {
    const filePath = await this.findFilePath(key);
    const fileBuffer = await readFile(filePath);
    
    return new ReadableStream({
      start(controller) {
        controller.enqueue(fileBuffer);
        controller.close();
      }
    });
  }

  async getObjectHeaders(key: string): Promise<Record<string, string>> {
    const filePath = await this.findFilePath(key);
    const stats = await stat(filePath);
    
    return {
      'Content-Length': stats.size.toString(),
      'Last-Modified': stats.mtime.toUTCString(),
    };
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = await this.findFilePath(key);
    await unlink(filePath);
  }

  private async findFilePath(key: string): Promise<string> {
    // First try in root data directory
    const candidateInRoot = join(this.dataDir, key);
    try {
      await stat(candidateInRoot);
      return candidateInRoot;
    } catch {
      // Not found in root, try in subdirectories
      const { readdir } = await import('fs/promises');
      const entries = await readdir(this.dataDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidate = join(this.dataDir, entry.name, key);
        try {
          await stat(candidate);
          return candidate;
        } catch {
          // Continue searching
        }
      }
      
      throw new Error(`File not found: ${key}`);
    }
  }

  private extractVotingIdFromKey(key: string): string {
    // For local storage, we need to maintain the voting directory structure
    // Since we don't have votingId in the key, we'll use a default structure
    // This is a temporary solution - in practice, the uploadImages function
    // should pass the votingId to the storage driver
    return 'default';
  }
}
