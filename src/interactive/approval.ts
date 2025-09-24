import inquirer from 'inquirer';
import chalk from 'chalk';
import type { ChangePlan } from '../types/changes.js';
import type { ParsedDocument } from '../types/document.js';

export enum ApprovalResult {
  APPROVE = 'approve',
  PREVIEW = 'preview',
  CONFIGURE = 'configure',
  ABORT = 'abort'
}

export interface ApprovalOptions {
  allowConfiguration: boolean;
  showSummary: boolean;
  defaultAction: ApprovalResult;
}

export class InteractiveApproval {
  async getApproval(
    document: ParsedDocument,
    plan: ChangePlan,
    documentType: string,
    options: ApprovalOptions = {
      allowConfiguration: true,
      showSummary: true,
      defaultAction: ApprovalResult.APPROVE
    }
  ): Promise<ApprovalResult> {

    if (options.showSummary) {
      this.displayChangeSummary(document, plan, documentType);
    }

    const choices: any[] = [
      {
        name: `${chalk.green('✓')} Yes - Apply all changes`,
        value: ApprovalResult.APPROVE,
        short: 'Yes'
      },
      {
        name: `${chalk.blue('👁')} Preview - Show detailed changes`,
        value: ApprovalResult.PREVIEW,
        short: 'Preview'
      }
    ];

    if (options.allowConfiguration) {
      choices.push({
        name: `${chalk.yellow('⚙')} Configure - Modify rules`,
        value: ApprovalResult.CONFIGURE,
        short: 'Configure'
      });
    }

    choices.push({
      name: `${chalk.red('✗')} Abort - Cancel operation`,
      value: ApprovalResult.ABORT,
      short: 'Abort'
    });

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'How would you like to proceed?',
      choices,
      default: options.defaultAction
    }]);

    if (action === ApprovalResult.PREVIEW) {
      await this.showDetailedPreview(document, plan);
      // Recurse to get final decision after preview
      return this.getApproval(document, plan, documentType, {
        ...options,
        showSummary: false // Don't show summary again
      });
    }

    return action;
  }

  private displayChangeSummary(
    document: ParsedDocument,
    plan: ChangePlan,
    documentType: string
  ): void {
    console.log(chalk.blue(`\nAging: ${document.filePath}`));
    console.log(chalk.gray(`Detected as: ${documentType} (document type)`));
    console.log();

    console.log(chalk.bold('Planned Changes:'));
    console.log();

    // Frontmatter changes summary
    if (plan.frontmatterChanges.length > 0) {
      const additions = plan.frontmatterChanges.filter(c => c.type === 'add').length;
      const removals = plan.frontmatterChanges.filter(c => c.type === 'remove').length;
      const modifications = plan.frontmatterChanges.filter(c => c.type === 'modify').length;

      console.log(chalk.yellow('📝 Frontmatter Updates:'));
      if (additions > 0) console.log(`   + Add: ${additions} fields`);
      if (removals > 0) console.log(`   - Remove: ${removals} fields`);
      if (modifications > 0) console.log(`   ~ Modify: ${modifications} fields`);
      console.log();
    }

    // Link changes summary
    if (plan.linkChanges.length > 0) {
      const verifications = plan.linkChanges.filter(c => c.type === 'verify').length;
      const updates = plan.linkChanges.filter(c => c.type === 'update').length;
      const removals = plan.linkChanges.filter(c => c.type === 'remove').length;

      console.log(chalk.cyan('🔗 Link Processing:'));
      if (verifications > 0) console.log(`   ✓ Verify: ${verifications} links`);
      if (updates > 0) console.log(`   → Update: ${updates} redirected links`);
      if (removals > 0) console.log(`   ✗ Remove: ${removals} broken links`);
      console.log();
    }

    // Content changes summary
    if (plan.contentChanges.length > 0) {
      console.log(chalk.green('📄 Content Processing:'));
      for (const change of plan.contentChanges) {
        console.log(`   ${this.getChangeIcon(change.type)} ${change.reason}`);
      }
      console.log();
    } else {
      console.log(chalk.gray('📄 Content Processing:'));
      console.log(chalk.gray('   No content changes planned'));
      console.log();
    }

    // Processing metadata
    const { metadata } = plan;
    if (metadata.sizeChangePercent !== 0) {
      const sizeChange = metadata.sizeChangePercent > 0 ? 'increase' : 'decrease';
      const color = metadata.sizeChangePercent > 0 ? chalk.red : chalk.green;
      console.log(color(`⚠ Estimated ${sizeChange}: ${Math.abs(metadata.sizeChangePercent)}%`));
    }

    if (metadata.requiresAI) {
      console.log(chalk.yellow('🤖 AI summarization required (not configured)'));
    }

    console.log(chalk.gray(`Processing complexity: ${metadata.processingComplexity}`));
    console.log(chalk.gray(`Estimated time: ${metadata.estimatedTime}`));
    console.log();
  }

  private async showDetailedPreview(document: ParsedDocument, plan: ChangePlan): Promise<void> {
    console.log(chalk.bold('\n=== DETAILED CHANGE PREVIEW ===\n'));

    // Show frontmatter changes
    if (plan.frontmatterChanges.length > 0) {
      console.log(chalk.yellow('📝 Frontmatter Changes:'));
      console.log();

      for (const change of plan.frontmatterChanges) {
        const icon = this.getChangeIcon(change.type);
        const color = this.getChangeColor(change.type);

        switch (change.type) {
          case 'add':
            console.log(color(`${icon} ${change.field}: ${this.formatValue(change.newValue)}`));
            break;
          case 'remove':
            console.log(color(`${icon} ${change.field}: ${this.formatValue(change.oldValue)}`));
            break;
          case 'modify':
            console.log(color(`${icon} ${change.field}: ${this.formatValue(change.oldValue)} → ${this.formatValue(change.newValue)}`));
            break;
        }
        console.log(chalk.gray(`     Reason: ${change.reason}`));
        console.log();
      }
    }

    // Show link changes
    if (plan.linkChanges.length > 0) {
      console.log(chalk.cyan('🔗 Link Processing:'));
      console.log();

      for (const change of plan.linkChanges) {
        const target = change.url || change.link || 'unknown';
        const icon = this.getLinkChangeIcon(change.type);
        const color = this.getLinkChangeColor(change.status || 'unknown');

        console.log(color(`${icon} ${target}`));
        if (change.newUrl) {
          console.log(color(`     → Redirects to: ${change.newUrl}`));
        }
        console.log(chalk.gray(`     ${change.reason}`));
        console.log();
      }
    }

    // Show content changes
    if (plan.contentChanges.length > 0) {
      console.log(chalk.green('📄 Content Changes:'));
      console.log();

      for (const change of plan.contentChanges) {
        console.log(chalk.bold(`Section: ${change.section}`));
        console.log(chalk.gray(`Type: ${change.type}`));

        if (change.oldContent !== change.newContent) {
          console.log();
          console.log(chalk.red('- Original:'));
          console.log(this.formatContentPreview(change.oldContent));
          console.log();
          console.log(chalk.green('+ Proposed:'));
          console.log(this.formatContentPreview(change.newContent));
        }

        console.log(chalk.gray(`Reason: ${change.reason}`));
        console.log();
      }
    }

    // Wait for user to read
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }

  private getChangeIcon(type: string): string {
    switch (type) {
      case 'add': return '+';
      case 'remove': return '-';
      case 'modify': return '~';
      default: return '•';
    }
  }

  private getChangeColor(type: string): typeof chalk.green {
    switch (type) {
      case 'add': return chalk.green;
      case 'remove': return chalk.red;
      case 'modify': return chalk.blue;
      default: return chalk.gray;
    }
  }

  private getLinkChangeIcon(type: string): string {
    switch (type) {
      case 'verify': return '✓';
      case 'update': return '→';
      case 'remove': return '✗';
      default: return '•';
    }
  }

  private getLinkChangeColor(status: string): typeof chalk.green {
    switch (status) {
      case 'valid': return chalk.green;
      case 'redirect': return chalk.yellow;
      case 'broken': return chalk.red;
      case 'timeout': return chalk.magenta;
      case 'error': return chalk.red;
      default: return chalk.gray;
    }
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return chalk.gray('null');
    }
    if (Array.isArray(value)) {
      return `[${value.join(', ')}]`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'string' && value.includes(' ')) {
      return `"${value}"`;
    }
    return String(value);
  }

  private formatContentPreview(content: string, maxLines: number = 5): string {
    const lines = content.split('\n');
    const preview = lines.slice(0, maxLines);
    const truncated = lines.length > maxLines;

    let result = preview.map(line => `    ${line}`).join('\n');

    if (truncated) {
      result += chalk.gray(`\n    ... (${lines.length - maxLines} more lines)`);
    }

    return result;
  }

  async confirmDestructiveChange(
    changeDescription: string,
    consequences: string[]
  ): Promise<boolean> {
    console.log(chalk.red('\n⚠ DESTRUCTIVE CHANGE WARNING ⚠'));
    console.log(chalk.yellow(changeDescription));
    console.log();

    if (consequences.length > 0) {
      console.log(chalk.bold('Consequences:'));
      for (const consequence of consequences) {
        console.log(chalk.red(`• ${consequence}`));
      }
      console.log();
    }

    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Are you sure you want to proceed?',
      default: false
    }]);

    return confirmed;
  }

  async selectFromOptions<T>(
    message: string,
    options: Array<{ name: string; value: T; description?: string }>
  ): Promise<T> {
    const choices = options.map(option => ({
      name: option.description ? `${option.name} - ${option.description}` : option.name,
      value: option.value,
      short: option.name
    }));

    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message,
      choices
    }]);

    return selected;
  }
}