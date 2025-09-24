import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  fileSize: number;
  checksum: string;
}

export class FileUtils {
  static async safeReadFile(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File '${filePath}' not found`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied reading '${filePath}'`);
      } else if (error.code === 'EISDIR') {
        throw new Error(`'${filePath}' is a directory, not a file`);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read file '${filePath}': ${errorMessage}`);
      }
    }
  }

  static async safeWriteFile(filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });

      // Write file
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied writing to '${filePath}'`);
      } else if (error.code === 'ENOSPC') {
        throw new Error(`No space left on device writing to '${filePath}'`);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to write file '${filePath}': ${errorMessage}`);
      }
    }
  }

  static async createBackup(filePath: string): Promise<BackupInfo> {
    const backupDir = this.findBackupDirectory(filePath);
    const timestamp = new Date();

    // Generate backup filename
    const basename = path.basename(filePath, path.extname(filePath));
    const extension = path.extname(filePath);
    const timestampStr = timestamp
      .toISOString()
      .replace(/[:.]/g, '')
      .replace('T', '-')
      .slice(0, 15);

    const backupPath = path.join(backupDir, `${basename}_${timestampStr}${extension}`);

    // Read original file
    const content = await this.safeReadFile(filePath);
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    // Copy file
    await this.safeWriteFile(backupPath, content);

    const backupInfo: BackupInfo = {
      originalPath: path.resolve(filePath),
      backupPath,
      timestamp,
      fileSize: fs.statSync(filePath).size,
      checksum,
    };

    // Update backup registry
    await this.updateBackupRegistry(backupInfo);

    return backupInfo;
  }

  static async restoreFromBackup(backupInfo: BackupInfo): Promise<void> {
    if (!fs.existsSync(backupInfo.backupPath)) {
      throw new Error(`Backup file not found: ${backupInfo.backupPath}`);
    }

    // Verify backup integrity
    const backupContent = await this.safeReadFile(backupInfo.backupPath);
    const backupChecksum = crypto.createHash('sha256').update(backupContent).digest('hex');

    if (backupChecksum !== backupInfo.checksum) {
      throw new Error('Backup file integrity check failed - file may be corrupted');
    }

    // Create backup of current file before restoring
    if (fs.existsSync(backupInfo.originalPath)) {
      const currentBackup = await this.createBackup(backupInfo.originalPath);
      console.log(`Current file backed up: ${currentBackup.backupPath}`);
    }

    // Restore file
    await this.safeWriteFile(backupInfo.originalPath, backupContent);
  }

  static findBackupDirectory(filePath: string): string {
    // Look for .age/backups/ in directory hierarchy
    let currentDir = path.dirname(path.resolve(filePath));
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const ageDir = path.join(currentDir, '.age');
      const backupDir = path.join(ageDir, 'backups');

      if (fs.existsSync(ageDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        return backupDir;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }

    // Fallback to global backups
    const globalBackupDir = path.join(require('os').homedir(), '.age', 'backups');
    fs.mkdirSync(globalBackupDir, { recursive: true });
    return globalBackupDir;
  }

  private static async updateBackupRegistry(backupInfo: BackupInfo): Promise<void> {
    const backupDir = path.dirname(backupInfo.backupPath);
    const registryFile = path.join(backupDir, 'registry.json');

    let registry: BackupInfo[] = [];

    // Load existing registry
    if (fs.existsSync(registryFile)) {
      try {
        const content = await this.safeReadFile(registryFile);
        registry = JSON.parse(content);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Warning: Could not read backup registry: ${errorMessage}`);
      }
    }

    // Add new backup
    registry.push(backupInfo);

    // Sort by timestamp (newest first)
    registry.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Save registry
    try {
      await this.safeWriteFile(registryFile, JSON.stringify(registry, null, 2));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Could not update backup registry: ${errorMessage}`);
    }
  }

  static async findBackupsForFile(filePath: string): Promise<BackupInfo[]> {
    const backupDir = this.findBackupDirectory(filePath);
    const registryFile = path.join(backupDir, 'registry.json');

    if (!fs.existsSync(registryFile)) {
      return [];
    }

    try {
      const content = await this.safeReadFile(registryFile);
      const registry: BackupInfo[] = JSON.parse(content);

      const resolvedPath = path.resolve(filePath);
      return registry
        .filter(backup => backup.originalPath === resolvedPath)
        .filter(backup => fs.existsSync(backup.backupPath)) // Only return existing backups
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Could not read backup registry: ${errorMessage}`);
      return [];
    }
  }

  static async findMarkdownFiles(directory: string, recursive: boolean = false): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.md' || ext === '.markdown') {
            files.push(fullPath);
          }
        } else if (entry.isDirectory() && recursive) {
          // Skip .age and node_modules directories
          if (entry.name !== '.age' && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
            const subdirFiles = await this.findMarkdownFiles(fullPath, true);
            files.push(...subdirFiles);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to scan directory '${directory}': ${errorMessage}`);
    }

    return files.sort();
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(size < 10 ? 1 : 0)}${units[unitIndex]}`;
  }

  static formatLastModified(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  static async cleanupOldBackups(directory: string, retentionDays: number = 30): Promise<number> {
    const backupDir = this.findBackupDirectory(directory);
    const registryFile = path.join(backupDir, 'registry.json');

    if (!fs.existsSync(registryFile)) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let registry: BackupInfo[] = [];
    let cleanedCount = 0;

    try {
      const content = await this.safeReadFile(registryFile);
      registry = JSON.parse(content);

      const toKeep: BackupInfo[] = [];
      const toDelete: BackupInfo[] = [];

      for (const backup of registry) {
        const backupDate = new Date(backup.timestamp);
        if (backupDate < cutoffDate) {
          toDelete.push(backup);
        } else {
          toKeep.push(backup);
        }
      }

      // Delete old backup files
      for (const backup of toDelete) {
        try {
          if (fs.existsSync(backup.backupPath)) {
            fs.unlinkSync(backup.backupPath);
            cleanedCount++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Warning: Could not delete backup ${backup.backupPath}: ${errorMessage}`);
        }
      }

      // Update registry
      if (toDelete.length > 0) {
        await this.safeWriteFile(registryFile, JSON.stringify(toKeep, null, 2));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Error cleaning up backups: ${errorMessage}`);
    }

    return cleanedCount;
  }
}