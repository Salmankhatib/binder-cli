// src/cli/undo.ts
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { logger } from '../utils/logger.js';

const BACKUP_DIR = resolve(process.cwd(), '.binder/backups');

export function createBackup(filePath: string): string {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = Date.now();
  const fileName = filePath.replace(/[\/\\]/g, '_');
  const backupPath = resolve(BACKUP_DIR, `${timestamp}_${fileName}`);
  
  copyFileSync(filePath, backupPath);
  
  // Keep only last 10 backups to avoid bloat
  const backups = readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith(fileName))
    .sort();
  
  if (backups.length > 10) {
    unlinkSync(join(BACKUP_DIR, backups[0]));
  }

  return backupPath;
}

export function undoLast(filePath: string): boolean {
  const fileName = filePath.replace(/[\/\\]/g, '_');
  const backups = readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith(fileName))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    logger.error(`No backups found for ${filePath}`);
    return false;
  }
  
  const latest = resolve(BACKUP_DIR, backups[0]);
  copyFileSync(latest, filePath);
  
  // Remove the backup we just restored
  unlinkSync(latest);
  
  logger.success(`Restored ${filePath} from backup`);
  return true;
}

export function listHistory(filePath?: string): void {
  if (!existsSync(BACKUP_DIR)) {
    logger.info("No history found.");
    return;
  }

  const targetFileName = filePath?.replace(/[\/\\]/g, '_');
  const backups = readdirSync(BACKUP_DIR)
    .filter(f => !targetFileName || f.endsWith(targetFileName))
    .map(f => {
      const stat = statSync(resolve(BACKUP_DIR, f));
      return { 
        File: f.split('_').slice(1).join('_'), 
        Timestamp: new Date(stat.mtime).toLocaleString() 
      };
    });
  
  if (backups.length === 0) {
    logger.info("No history found for this file.");
  } else {
    console.table(backups);
  }
}
