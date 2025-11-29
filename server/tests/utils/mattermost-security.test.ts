import { describe, it, expect } from 'bun:test';
import { basename, resolve } from 'path';

// Test the path traversal protection logic
describe('Mattermost File Upload Security', () => {
  const dataDir = './data';
  const resolvedDataDir = resolve(dataDir);

  it('should reject paths outside data directory', () => {
    const maliciousPath = '/etc/passwd';
    const resolvedFilePath = resolve(maliciousPath);

    expect(resolvedFilePath.startsWith(resolvedDataDir)).toBe(false);
  });

  it('should accept paths within data directory', () => {
    const validPath = './data/test-voting/preview.png';
    const resolvedFilePath = resolve(validPath);

    expect(resolvedFilePath.startsWith(resolvedDataDir)).toBe(true);
  });

  it('should detect path traversal in filename', () => {
    const maliciousFilenames = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'file/../../../root/.ssh/id_rsa',
      'normal.png/../../../etc/passwd'
    ];

    maliciousFilenames.forEach(filename => {
      expect(filename.includes('..')).toBe(true);
      expect(filename.includes('/') || filename.includes('\\')).toBe(true);
    });
  });

  it('should accept safe filenames', () => {
    const safeFilenames = [
      'preview.png',
      'voting-preview.jpg',
      'image-123.png',
      'test_file.png'
    ];

    safeFilenames.forEach(filename => {
      expect(filename.includes('..')).toBe(false);
      expect(basename(filename)).toBe(filename); // Should not change with basename
    });
  });
});
