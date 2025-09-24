import chalk from 'chalk';
import * as path from 'path';
import { MarkdownParser } from '../utils/markdown.js';
import { DocumentTypeDetector } from '../types/detector.js';
import { ConfigManager } from '../config/hierarchy.js';
import { FileUtils } from '../utils/files.js';
import type { ParsedDocument, DetectionResult, TypeScore } from '../types/document.js';

export class DetectCommand {
  private parser: MarkdownParser;
  private configManager: ConfigManager;

  constructor() {
    this.parser = new MarkdownParser();
    this.configManager = ConfigManager.getInstance();
  }

  async execute(filePath: string): Promise<void> {
    try {
      console.log(chalk.blue(`Analyzing: ${filePath}`));
      console.log();

      // Parse document
      const document = await this.parser.parseDocument(filePath);

      // Load configuration
      const configHierarchy = this.configManager.loadConfigHierarchy(filePath);
      const detector = new DocumentTypeDetector(configHierarchy.effective);

      // Detect types
      const detection = detector.detectDocumentType(document);

      // Display results
      this.displayResults(document, detection);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  }

  private displayResults(document: ParsedDocument, detection: DetectionResult): void {
    // File information
    console.log(chalk.bold('Document Information:'));
    console.log(`File: ${document.filePath}`);
    console.log(`Size: ${FileUtils.formatFileSize(document.metadata.size)}`);
    console.log(`Last modified: ${FileUtils.formatLastModified(document.metadata.lastModified)}`);
    console.log(`Word count: ${document.structure.wordCount.toLocaleString()}`);
    console.log(`Lines: ${document.structure.lineCount.toLocaleString()}`);
    console.log();

    // Type detection results
    console.log(chalk.bold('Detected Types (confidence score):'));

    for (const score of detection.allScores) {
      const confidencePercent = Math.round(score.confidence * 100);
      const icon = this.getConfidenceIcon(score.confidence);
      const color = this.getConfidenceColor(score.confidence);

      console.log(color(`${icon} ${score.type} (${confidencePercent}%)`));

      if (score.reasons.length > 0) {
        const reasonText = ` - ${score.reasons.join(', ')}`;
        console.log(color(reasonText));
      }

      if (score.warnings && score.warnings.length > 0) {
        for (const warning of score.warnings) {
          console.log(chalk.yellow(`  ⚠ ${warning}`));
        }
      }
      console.log();
    }

    // Frontmatter analysis
    this.displayFrontmatterAnalysis(document, detection);

    // Content patterns
    this.displayContentPatterns(document);

    // Recommendations
    if (detection.recommendations.length > 0) {
      console.log(chalk.bold('Recommendations:'));
      for (const recommendation of detection.recommendations) {
        console.log(chalk.cyan(`• ${recommendation}`));
      }
      console.log();
    }

    // Next steps
    console.log(chalk.bold('Next Steps:'));
    if (detection.allScores[0]?.confidence > 0.7) {
      console.log(chalk.green(`✓ Ready for aging with '${detection.primaryType}' rules`));
      console.log(`  Run: ${chalk.white(`age ${path.basename(document.filePath)}`)}`);
    } else {
      console.log(chalk.yellow('⚠ Consider adding more specific frontmatter for better type detection'));
      console.log('  Or manually specify type during aging process');
    }
  }

  private displayFrontmatterAnalysis(document: ParsedDocument, detection: DetectionResult): void {
    if (Object.keys(document.frontmatter).length === 0) {
      console.log(chalk.bold('Frontmatter Analysis:'));
      console.log(chalk.gray('No frontmatter found'));
      console.log();
      return;
    }

    console.log(chalk.bold('Frontmatter Analysis:'));

    const primaryTypeConfig = this.getPrimaryTypeConfig(detection);

    for (const [field, value] of Object.entries(document.frontmatter)) {
      const status = this.analyzeFrontmatterField(field, value, primaryTypeConfig);
      console.log(status.icon + ` ${field}: ${this.formatValue(value)} ${status.message}`);
    }
    console.log();
  }

  private displayContentPatterns(document: ParsedDocument): void {
    console.log(chalk.bold('Content Patterns:'));

    // Action items
    const actionItems = document.structure.actionItems.length;
    if (actionItems > 0) {
      const completed = document.structure.actionItems.filter(item => item.completed).length;
      console.log(`- Action items: ${actionItems} found (${completed} completed)`);
    }

    // External URLs
    const externalLinks = document.structure.links.filter(link => link.type === 'external').length;
    if (externalLinks > 0) {
      console.log(`- External URLs: ${externalLinks} found`);
    }

    // Internal links
    const internalLinks = document.structure.links.filter(link => link.type === 'internal').length;
    if (internalLinks > 0) {
      console.log(`- Cross-references: ${internalLinks} vault links`);
    }

    // Code blocks
    const codeBlocks = document.structure.codeBlocks.length;
    if (codeBlocks > 0) {
      const languages = [...new Set(document.structure.codeBlocks.map(block => block.language).filter(Boolean))];
      console.log(`- Code blocks: ${codeBlocks} found${languages.length > 0 ? ` (${languages.join(', ')})` : ''}`);
    }

    // Headers
    const headers = document.structure.headers.length;
    if (headers > 0) {
      const levels = document.structure.headers.map(h => `H${h.level}`);
      const levelCounts = levels.reduce((acc, level) => {
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const levelSummary = Object.entries(levelCounts)
        .map(([level, count]) => `${count} ${level}`)
        .join(', ');

      console.log(`- Headers: ${headers} found (${levelSummary})`);
    }

    if (actionItems === 0 && externalLinks === 0 && internalLinks === 0 && codeBlocks === 0) {
      console.log(chalk.gray('No special content patterns found'));
    }

    console.log();
  }

  private getConfidenceIcon(confidence: number): string {
    if (confidence >= 0.8) return '✓';
    if (confidence >= 0.5) return '•';
    return '○';
  }

  private getConfidenceColor(confidence: number): typeof chalk.green {
    if (confidence >= 0.8) return chalk.green;
    if (confidence >= 0.5) return chalk.yellow;
    return chalk.gray;
  }

  private getPrimaryTypeConfig(detection: DetectionResult): any {
    // This would normally come from the config, simplified for now
    const typeConfigs: any = {
      'meeting-notes': {
        keep: ['date', 'attendees', 'project', 'tags'],
        remove: ['author', 'status', 'draft'],
      },
      'research': {
        keep: ['source', 'methodology', 'tags', 'references'],
        remove: ['author', 'status', 'draft'],
      },
      'project-work': {
        keep: ['project', 'priority', 'due_date', 'tags'],
        remove: ['status', 'draft'],
      },
      'personal-notes': {
        keep: ['date', 'tags', 'mood'],
        remove: ['author', 'draft'],
      },
    };

    return typeConfigs[detection.primaryType] || { keep: [], remove: [] };
  }

  private analyzeFrontmatterField(field: string, value: any, typeConfig: any): { icon: string; message: string } {
    if (typeConfig.keep?.includes(field)) {
      // Special validation for certain fields
      if (field === 'date') {
        const isValid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
        return {
          icon: chalk.green('✓'),
          message: isValid ? chalk.green('(keeps context)') : chalk.yellow('(invalid format)')
        };
      }

      if (field === 'attendees' && Array.isArray(value)) {
        return {
          icon: chalk.green('✓'),
          message: chalk.green(`(${value.length} attendees - important for reference)`)
        };
      }

      return {
        icon: chalk.green('✓'),
        message: chalk.green('(important for aging)')
      };
    }

    if (typeConfig.remove?.includes(field)) {
      return {
        icon: chalk.yellow('⚠'),
        message: chalk.yellow('(usually removed - creates dead links or temporary)')
      };
    }

    return {
      icon: chalk.gray('•'),
      message: chalk.gray('(neutral)')
    };
  }

  private formatValue(value: any): string {
    if (Array.isArray(value)) {
      return `[${value.join(', ')}]`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}