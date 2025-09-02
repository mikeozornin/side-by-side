import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export async function ensureDirectories(dataDir: string, logDir: string): Promise<void> {
  const dirs = [dataDir, logDir];
  
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

export async function ensureVotingDirectory(votingId: string, dataDir: string): Promise<string> {
  const votingDir = join(dataDir, votingId);
  
  if (!existsSync(votingDir)) {
    await mkdir(votingDir, { recursive: true });
  }
  
  return votingDir;
}
