import chalk from 'chalk';
import * as path from 'path';
import { FileUtils } from '../utils/files.js';
import { MarkdownParser } from '../utils/markdown.js';
import { DocumentTypeDetector } from '../types/detector.js';
import { ConfigManager } from '../config/hierarchy.js';
import { LinkProcessor } from '../filters/links.js';

interface VaultStats {
  totalFiles: number;
  totalSize: number;
  documentTypes: Record<string, number>;
  averageAge: number;
  agedDocuments: number;
  linkHealth: {
    totalLinks: number;
    internalLinks: number;
    externalLinks: number;
    brokenLinks: number;
  };
  backupStats: {
    totalBackups: number;
    backupSize: number;
    oldestBackup?: Date;
  };
}

export class StatusCommand {
  private parser: MarkdownParser;
  private configManager: ConfigManager;
  private linkProcessor: LinkProcessor;

  constructor() {
    this.parser = new MarkdownParser();
    this.configManager = ConfigManager.getInstance();
    this.linkProcessor = new LinkProcessor();
  }

  async execute(directory: string = '.'): Promise<void> {
    try {
      console.log(chalk.bold('Age CLI Status Report'));
      console.log(chalk.gray(`Generated: ${new Date().toLocaleString()}`));
      console.log();

      // Analyze vault
      const stats = await this.analyzeVault(directory);

      // Display vault health
      this.displayVaultHealth(stats);

      // Display document types
      this.displayDocumentTypes(stats);

      // Display link health
      await this.displayLinkHealth(directory, stats);

      // Display system status
      this.displaySystemStatus(directory);

      // Display recommendations
      this.displayRecommendations(stats);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  }

  private async analyzeVault(directory: string): Promise<VaultStats> {
    console.log(chalk.blue('Analyzing vault...'));

    const files = await FileUtils.findMarkdownFiles(directory, true);
    const stats: VaultStats = {
      totalFiles: files.length,
      totalSize: 0,
      documentTypes: {},
      averageAge: 0,
      agedDocuments: 0,
      linkHealth: {
        totalLinks: 0,
        internalLinks: 0,
        externalLinks: 0,
        brokenLinks: 0
      },
      backupStats: {
        totalBackups: 0,
        backupSize: 0
      }
    };

    if (files.length === 0) {
      return stats;
    }

    // Load configuration
    const configHierarchy = this.configManager.loadConfigHierarchy(directory);
    const detector = new DocumentTypeDetector(configHierarchy.effective);

    let totalAge = 0;
    let processedCount = 0;

    // Sample files for analysis (to avoid performance issues with large vaults)
    const sampleSize = Math.min(files.length, 100);
    const sampleFiles = files.slice(0, sampleSize);

    for (const filePath of sampleFiles) {
      try {
        const document = await this.parser.parseDocument(filePath);
        const detection = detector.detectDocumentType(document);

        // Update stats
        stats.totalSize += document.metadata.size;

        // Document types
        const primaryType = detection.primaryType;
        stats.documentTypes[primaryType] = (stats.documentTypes[primaryType] || 0) + 1;

        // Check if document has been aged
        if (document.frontmatter.aged_date) {
          stats.agedDocuments++;
        }

        // Calculate age
        const fileAge = Date.now() - document.metadata.lastModified.getTime();
        totalAge += fileAge;
        processedCount++;

        // Link analysis
        stats.linkHealth.totalLinks += document.structure.links.length;
        stats.linkHealth.internalLinks += document.structure.links.filter(l => l.type === 'internal').length;
        stats.linkHealth.externalLinks += document.structure.links.filter(l => l.type === 'external').length;

      } catch (error) {
        // Skip files that can't be parsed
        console.warn(chalk.yellow(`Warning: Could not parse ${path.basename(filePath)}`));
      }
    }

    // Calculate averages
    if (processedCount > 0) {
      stats.averageAge = totalAge / processedCount;
    }

    // Scale up statistics based on sample size
    if (sampleSize < files.length) {
      const scaleFactor = files.length / sampleSize;
      stats.totalSize = Math.round(stats.totalSize * scaleFactor);
      stats.agedDocuments = Math.round(stats.agedDocuments * scaleFactor);
      stats.linkHealth.totalLinks = Math.round(stats.linkHealth.totalLinks * scaleFactor);
      stats.linkHealth.internalLinks = Math.round(stats.linkHealth.internalLinks * scaleFactor);
      stats.linkHealth.externalLinks = Math.round(stats.linkHealth.externalLinks * scaleFactor);

      // Scale document types
      for (const type in stats.documentTypes) {
        stats.documentTypes[type] = Math.round(stats.documentTypes[type] * scaleFactor);
      }
    }

    // Analyze backups
    await this.analyzeBackups(directory, stats);

    return stats;
  }

  private async analyzeBackups(directory: string, stats: VaultStats): Promise<void> {
    try {
      const backupDir = FileUtils.findBackupDirectory(directory);
      const backups = await FileUtils.findMarkdownFiles(backupDir, false);

      stats.backupStats.totalBackups = backups.length;

      let totalBackupSize = 0;
      let oldestBackupTime = Date.now();

      for (const backupPath of backups) {
        const fs = require('fs');
        const stat = fs.statSync(backupPath);
        totalBackupSize += stat.size;

        if (stat.mtime.getTime() < oldestBackupTime) {
          oldestBackupTime = stat.mtime.getTime();
          stats.backupStats.oldestBackup = stat.mtime;
        }
      }

      stats.backupStats.backupSize = totalBackupSize;
    } catch (error) {
      // Backup analysis is optional
    }
  }

  private displayVaultHealth(stats: VaultStats): void {
    console.log(chalk.bold('=== VAULT HEALTH ==='));
    console.log(`Documents analyzed: ${stats.totalFiles.toLocaleString()} files`);
    console.log(`Total size: ${FileUtils.formatFileSize(stats.totalSize)}`);

    if (stats.averageAge > 0) {
      const avgDays = Math.floor(stats.averageAge / (1000 * 60 * 60 * 24));
      console.log(`Average document age: ${avgDays} days`);
    }

    console.log();
  }

  private displayDocumentTypes(stats: VaultStats): void {
    if (Object.keys(stats.documentTypes).length === 0) {
      return;
    }

    console.log(chalk.bold('Document Types:'));

    // Sort by count (descending)
    const sortedTypes = Object.entries(stats.documentTypes)
      .sort(([, a], [, b]) => b - a);

    for (const [type, count] of sortedTypes) {
      const percentage = ((count / stats.totalFiles) * 100).toFixed(1);
      console.log(`- ${type}: ${count.toLocaleString()} files (${percentage}%)`);
    }

    console.log();
  }

  private async displayLinkHealth(directory: string, stats: VaultStats): Promise<void> {
    console.log(chalk.bold('=== LINK HEALTH ==='));

    if (stats.linkHealth.totalLinks === 0) {
      console.log(chalk.gray('No links found in analyzed documents'));
      console.log();
      return;
    }

    console.log(`Total links: ${stats.linkHealth.totalLinks.toLocaleString()}`);
    console.log(`- Internal links: ${stats.linkHealth.internalLinks.toLocaleString()}`);
    console.log(`- External links: ${stats.linkHealth.externalLinks.toLocaleString()}`);

    // Note about link verification
    console.log();
    console.log(chalk.gray('Link verification requires individual document processing'));
    console.log(chalk.gray('Run "age <file>" on specific documents to check link health'));

    console.log();
  }

  private displaySystemStatus(directory: string): void {
    console.log(chalk.bold('=== SYSTEM STATUS ==='));

    // Configuration status
    const configHierarchy = this.configManager.loadConfigHierarchy(directory);
    const hasLocal = !!configHierarchy.local;
    const hasVault = !!configHierarchy.vault;
    const hasGlobal = !!configHierarchy.global;

    console.log(`Configuration: ${chalk.green('✓ Valid')}`);

    const configSources: string[] = [];
    if (hasGlobal) configSources.push('global');
    if (hasVault) configSources.push('vault');
    if (hasLocal) configSources.push('local');

    if (configSources.length > 0) {
      console.log(`  Sources: ${configSources.join(', ')}`);
    } else {
      console.log(chalk.gray('  Using built-in defaults only'));
    }

    // AI provider status
    const aiProvider = configHierarchy.effective.ai?.provider || 'none';
    if (aiProvider === 'none') {
      console.log(`AI Provider: ${chalk.yellow('⚠ Not configured')}`);
      console.log(chalk.gray('  Content summarization disabled'));
    } else {
      console.log(`AI Provider: ${chalk.green('✓')} ${aiProvider}`);
    }

    // Backup system status
    try {
      const backupDir = FileUtils.findBackupDirectory(directory);
      const fs = require('fs');

      if (fs.existsSync(backupDir)) {
        console.log(`Backups: ${chalk.green('✓')} Directory exists`);
      } else {
        console.log(`Backups: ${chalk.yellow('⚠')} Directory will be created when needed`);
      }
    } catch (error) {
      console.log(`Backups: ${chalk.red('✗')} Error accessing backup directory`);
    }

    console.log();
  }

  private displayRecommendations(stats: VaultStats): void {
    const recommendations: string[] = [];

    // Aging recommendations
    const unagedPercent = ((stats.totalFiles - stats.agedDocuments) / stats.totalFiles) * 100;
    if (unagedPercent > 50) {
      recommendations.push(`${Math.round(unagedPercent)}% of documents haven't been aged`);
    }

    // Link health recommendations
    if (stats.linkHealth.externalLinks > 10) {
      recommendations.push(`${stats.linkHealth.externalLinks} external links should be verified periodically`);
    }

    // Configuration recommendations
    const configHierarchy = this.configManager.loadConfigHierarchy('.');
    if (!configHierarchy.local && !configHierarchy.vault) {
      recommendations.push('Consider running "age config init" to customize document processing rules');
    }

    if (configHierarchy.effective.ai?.provider === 'none') {
      recommendations.push('Configure AI provider for content summarization capabilities');
    }

    // Backup recommendations
    if (stats.backupStats.totalBackups > 100) {
      recommendations.push(`${stats.backupStats.totalBackups} backup files - consider running cleanup`);
    }

    if (recommendations.length > 0) {
      console.log(chalk.bold('Recommendations:'));
      for (const rec of recommendations) {
        console.log(chalk.cyan(`• ${rec}`));
      }
      console.log();
    }

    // Next steps
    console.log(chalk.bold('Suggested Actions:'));
    console.log('• Run "age detect <file>" to analyze specific documents');
    console.log('• Run "age <file>" to age documents that need processing');
    if (stats.backupStats.totalBackups > 0) {
      console.log('• Use "age --undo <file>" to restore from backups if needed');
    }
  }
}