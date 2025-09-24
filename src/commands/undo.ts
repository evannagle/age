import chalk from 'chalk';
import inquirer from 'inquirer';
import { FileUtils } from '../utils/files.js';
import type { BackupInfo } from '../utils/files.js';

export class UndoCommand {
  async execute(filePath: string): Promise<void> {
    try {
      console.log(chalk.blue(`Finding backups for: ${filePath}`));
      console.log();

      // Find available backups
      const backups = await FileUtils.findBackupsForFile(filePath);

      if (backups.length === 0) {
        console.log(chalk.yellow('No backups found for this file.'));
        console.log(chalk.gray('Backups are only created when a file is processed with the age command.'));
        return;
      }

      // Display available backups
      console.log(chalk.bold(`Available backups for ${require('path').basename(filePath)}:`));
      console.log();

      const backupChoices = backups.map((backup, index) => {
        const timestamp = new Date(backup.timestamp);
        const relativeTime = this.formatRelativeTime(timestamp);
        const size = FileUtils.formatFileSize(backup.fileSize);

        return {
          name: `${timestamp.toLocaleString()} - ${relativeTime} (${size})`,
          value: index,
          short: `${index + 1}. ${timestamp.toLocaleDateString()}`
        };
      });

      backupChoices.push({
        name: chalk.gray('Cancel - Don\'t restore anything'),
        value: -1,
        short: 'Cancel'
      });

      const { selectedBackupIndex } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedBackupIndex',
        message: 'Which backup would you like to restore?',
        choices: backupChoices,
        pageSize: 10
      }]);

      if (selectedBackupIndex === -1) {
        console.log(chalk.gray('Operation cancelled.'));
        return;
      }

      const selectedBackup = backups[selectedBackupIndex];

      // Show restore confirmation
      await this.showRestorePreview(filePath, selectedBackup);

      const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: 'Proceed with restore?',
        default: true
      }]);

      if (!confirmed) {
        console.log(chalk.gray('Restore cancelled.'));
        return;
      }

      // Perform the restore
      console.log(chalk.blue('\nRestoring file...'));

      await FileUtils.restoreFromBackup(selectedBackup);

      console.log(chalk.green('✓ File restored successfully'));

      // Show what was restored
      const currentSize = require('fs').statSync(filePath).size;
      const sizeChange = currentSize - selectedBackup.fileSize;

      console.log();
      console.log(`File: ${filePath}`);
      console.log(`Restored from: ${new Date(selectedBackup.timestamp).toLocaleString()}`);
      console.log(`Size: ${FileUtils.formatFileSize(currentSize)}`);

      if (Math.abs(sizeChange) > 0) {
        const changeIcon = sizeChange > 0 ? '↗' : '↘';
        const changeColor = sizeChange > 0 ? chalk.red : chalk.green;
        console.log(changeColor(`Change: ${changeIcon} ${FileUtils.formatFileSize(Math.abs(sizeChange))}`));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  }

  private async showRestorePreview(filePath: string, backup: BackupInfo): Promise<void> {
    const fs = require('fs');

    console.log(chalk.bold('\n=== RESTORE PREVIEW ==='));
    console.log();

    // Current file info
    let currentExists = false;
    let currentSize = 0;
    let currentModified = new Date();

    try {
      const currentStats = fs.statSync(filePath);
      currentExists = true;
      currentSize = currentStats.size;
      currentModified = currentStats.mtime;
    } catch (error) {
      // File doesn't exist
    }

    if (currentExists) {
      console.log(chalk.yellow('Current file:'));
      console.log(`  Path: ${filePath}`);
      console.log(`  Size: ${FileUtils.formatFileSize(currentSize)}`);
      console.log(`  Modified: ${currentModified.toLocaleString()}`);
      console.log();
    } else {
      console.log(chalk.gray('Current file: (does not exist)'));
      console.log();
    }

    // Backup info
    console.log(chalk.green('Restore from backup:'));
    console.log(`  Created: ${new Date(backup.timestamp).toLocaleString()}`);
    console.log(`  Size: ${FileUtils.formatFileSize(backup.fileSize)}`);
    console.log(`  Location: ${backup.backupPath}`);
    console.log();

    // Show size comparison
    if (currentExists) {
      const sizeDiff = backup.fileSize - currentSize;
      if (sizeDiff !== 0) {
        const direction = sizeDiff > 0 ? 'larger' : 'smaller';
        const color = sizeDiff > 0 ? chalk.red : chalk.green;
        console.log(color(`Backup is ${FileUtils.formatFileSize(Math.abs(sizeDiff))} ${direction} than current file`));
      } else {
        console.log(chalk.gray('Backup and current file are the same size'));
      }
    }

    // Warning about current file backup
    if (currentExists) {
      console.log();
      console.log(chalk.yellow('⚠ Current file will be backed up before restore'));
      console.log(chalk.gray('  You can undo this restore if needed'));
    }

    console.log();
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
      return 'over a month ago';
    }
  }
}