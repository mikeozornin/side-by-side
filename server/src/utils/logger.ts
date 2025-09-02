import { writeFile, appendFile } from 'fs/promises';
import { join } from 'path';

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_FILE = join(LOG_DIR, 'server.log');

export const logger = {
  info: (message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message} ${args.length ? JSON.stringify(args) : ''}\n`;
    console.log(logMessage.trim());
    appendFile(LOG_FILE, logMessage).catch(console.error);
  },
  
  error: (message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message} ${args.length ? JSON.stringify(args) : ''}\n`;
    console.error(logMessage.trim());
    appendFile(LOG_FILE, logMessage).catch(console.error);
  },
  
  warn: (message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message} ${args.length ? JSON.stringify(args) : ''}\n`;
    console.warn(logMessage.trim());
    appendFile(LOG_FILE, logMessage).catch(console.error);
  }
};
