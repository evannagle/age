import chalk from 'chalk';
import matter from 'gray-matter';
import { MarkdownParser } from '../utils/markdown.js';
import { DocumentTypeDetector } from '../types/detector.js';
import { ConfigManager } from '../config/hierarchy.js';
import { FileUtils } from '../utils/files.js';
import { FrontmatterProcessor } from '../filters/frontmatter.js';
import { LinkProcessor } from '../filters/links.js';
import { InteractiveApproval, ApprovalResult } from '../interactive/approval.js';
import type { ParsedDocument } from '../types/document.js';
import type { ChangePlan, ChangePlanMetadata, ContentChange } from '../types/changes.js';
import type { AgeConfig } from '../types/config.js';

export class AgeCommand {
  private parser: MarkdownParser;
  private configManager: ConfigManager;
  private frontmatterProcessor: FrontmatterProcessor;
  private linkProcessor: LinkProcessor;
  private approval: InteractiveApproval;

  constructor() {
    this.parser = new MarkdownParser();
    this.configManager = ConfigManager.getInstance();
    this.frontmatterProcessor = new FrontmatterProcessor();
    this.linkProcessor = new LinkProcessor();
    this.approval = new InteractiveApproval();
  }

  async execute(filePath: string, options: { interactive?: boolean } = {}): Promise<void> {
    try {
      console.log(chalk.blue(`Processing: ${filePath}`));

      // Step 1: Parse document
      const document = await this.parser.parseDocument(filePath);

      // Step 2: Load configuration
      const configHierarchy = this.configManager.loadConfigHierarchy(filePath);
      const config = configHierarchy.effective;

      // Step 3: Detect document type
      const detector = new DocumentTypeDetector(config);
      const detection = detector.detectDocumentType(document);

      console.log(chalk.gray(`Detected type: ${detection.primaryType} (${Math.round(detection.allScores[0]?.confidence * 100 || 0)}% confidence)`));
      console.log();

      // Step 4: Create change plan
      const plan = await this.createChangePlan(document, detection.primaryType, config);

      // Check if there are any changes to make
      if (this.isEmptyPlan(plan)) {
        console.log(chalk.green('✓ Document is already optimally aged'));
        console.log(chalk.gray('No changes needed based on current configuration.'));
        return;
      }

      // Step 5: Get user approval (if interactive)
      const shouldProceed = options.interactive !== false
        ? await this.getApprovalForChanges(document, plan, detection.primaryType)
        : true;

      if (!shouldProceed) {
        console.log(chalk.gray('Operation cancelled by user.'));
        return;
      }

      // Step 6: Create backup
      console.log(chalk.blue('Creating backup...'));
      const backup = await FileUtils.createBackup(filePath);
      console.log(chalk.green(`✓ Backup created: ${require('path').basename(backup.backupPath)}`));

      // Step 7: Apply changes
      console.log(chalk.blue('Applying changes...'));
      const processedDocument = await this.applyChanges(document, plan);

      // Step 8: Write updated document
      const newContent = this.generateUpdatedDocument(processedDocument);
      await FileUtils.safeWriteFile(filePath, newContent);

      // Step 9: Report results
      this.reportResults(document, processedDocument, plan);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  }

  private async createChangePlan(
    document: ParsedDocument,
    documentType: string,
    config: AgeConfig
  ): Promise<ChangePlan> {
    const typeConfig = config.documentTypes?.[documentType];

    if (!typeConfig) {
      throw new Error(`No configuration found for document type: ${documentType}`);
    }

    // Plan frontmatter changes
    const frontmatterChanges = this.frontmatterProcessor.planFrontmatterChanges(
      document,
      typeConfig.frontmatter,
      documentType
    );

    // Plan link changes
    const linkChanges = await this.linkProcessor.planLinkChanges(
      document.structure.links,
      document.filePath,
      typeConfig.content.urlProcessing,
      typeConfig.content.linkVerification
    );

    // Plan content changes (Phase 2: no AI summarization yet)
    const contentChanges: ContentChange[] = [];

    // Calculate metadata
    const metadata = this.calculateChangePlanMetadata(document, {
      frontmatterChanges,
      contentChanges,
      linkChanges,
      metadata: {} as ChangePlanMetadata
    });

    return {
      frontmatterChanges,
      contentChanges,
      linkChanges,
      metadata
    };
  }

  private calculateChangePlanMetadata(document: ParsedDocument, plan: Partial<ChangePlan>): ChangePlanMetadata {
    const originalSize = document.metadata.size;

    // Rough estimation of size change based on frontmatter changes
    let estimatedSizeChange = 0;

    for (const change of plan.frontmatterChanges || []) {
      if (change.type === 'add') {
        estimatedSizeChange += JSON.stringify(change.newValue).length + change.field.length + 10;
      } else if (change.type === 'remove') {
        estimatedSizeChange -= JSON.stringify(change.oldValue).length + change.field.length + 10;
      }
    }

    const estimatedNewSize = Math.max(originalSize + estimatedSizeChange, 0);
    const sizeChangePercent = originalSize > 0
      ? Math.round(((estimatedNewSize - originalSize) / originalSize) * 100)
      : 0;

    // Determine complexity
    const totalChanges = (plan.frontmatterChanges?.length || 0) +
                        (plan.linkChanges?.length || 0) +
                        (plan.contentChanges?.length || 0);

    let complexity: 'simple' | 'moderate' | 'complex';
    if (totalChanges <= 3) complexity = 'simple';
    else if (totalChanges <= 8) complexity = 'moderate';
    else complexity = 'complex';

    // Estimate processing time
    let estimatedTime = '< 10 seconds';
    if (plan.linkChanges && plan.linkChanges.length > 5) {
      estimatedTime = '10-30 seconds';
    }
    if (plan.linkChanges && plan.linkChanges.length > 15) {
      estimatedTime = '30-60 seconds';
    }

    return {
      originalSize,
      estimatedNewSize,
      sizeChangePercent,
      processingComplexity: complexity,
      requiresAI: false, // Phase 2: no AI yet
      estimatedTime
    };
  }

  private isEmptyPlan(plan: ChangePlan): boolean {
    return plan.frontmatterChanges.length === 0 &&
           plan.contentChanges.length === 0 &&
           plan.linkChanges.filter(c => c.type !== 'verify').length === 0;
  }

  private async getApprovalForChanges(
    document: ParsedDocument,
    plan: ChangePlan,
    documentType: string
  ): Promise<boolean> {
    const result = await this.approval.getApproval(document, plan, documentType);

    switch (result) {
      case ApprovalResult.APPROVE:
        return true;

      case ApprovalResult.ABORT:
        return false;

      case ApprovalResult.CONFIGURE:
        console.log(chalk.yellow('\nConfiguration editing is not yet implemented in Phase 2'));
        console.log(chalk.gray('You can manually edit .age/config.json to customize processing rules'));
        console.log();

        // Ask again after showing the message
        return this.getApprovalForChanges(document, plan, documentType);

      default:
        return false;
    }
  }

  private async applyChanges(document: ParsedDocument, plan: ChangePlan): Promise<ParsedDocument> {
    const processedDocument = { ...document };

    // Apply frontmatter changes
    if (plan.frontmatterChanges.length > 0) {
      console.log(chalk.gray(`  Applying ${plan.frontmatterChanges.length} frontmatter changes...`));
      processedDocument.frontmatter = this.frontmatterProcessor.applyFrontmatterChanges(
        document.frontmatter,
        plan.frontmatterChanges
      );
    }

    // Apply link changes (just report for now, actual URL updating would be complex)
    const linkUpdates = plan.linkChanges.filter(c => c.type === 'update');
    const linkRemovals = plan.linkChanges.filter(c => c.type === 'remove');

    if (linkUpdates.length > 0) {
      console.log(chalk.gray(`  Found ${linkUpdates.length} link redirects (manual update recommended)`));
    }

    if (linkRemovals.length > 0) {
      console.log(chalk.gray(`  Found ${linkRemovals.length} broken links (manual removal recommended)`));
    }

    const linkVerifications = plan.linkChanges.filter(c => c.type === 'verify');
    if (linkVerifications.length > 0) {
      console.log(chalk.gray(`  Verified ${linkVerifications.length} links`));
    }

    // Content changes would go here in Phase 3 (AI integration)

    return processedDocument;
  }

  private generateUpdatedDocument(document: ParsedDocument): string {
    // Regenerate the complete markdown document
    let frontmatterYaml = '';

    if (Object.keys(document.frontmatter).length > 0) {
      // Use gray-matter to serialize frontmatter consistently
      const matterDoc = matter.stringify(document.content, document.frontmatter);
      return matterDoc;
    } else {
      return document.content;
    }
  }

  private reportResults(
    originalDocument: ParsedDocument,
    processedDocument: ParsedDocument,
    plan: ChangePlan
  ): void {
    console.log();
    console.log(chalk.green('✓ Document aged successfully'));
    console.log();

    // Report what was changed
    const changedSections: string[] = [];

    if (plan.frontmatterChanges.length > 0) {
      const additions = plan.frontmatterChanges.filter(c => c.type === 'add').length;
      const removals = plan.frontmatterChanges.filter(c => c.type === 'remove').length;
      const modifications = plan.frontmatterChanges.filter(c => c.type === 'modify').length;

      const parts: string[] = [];
      if (additions > 0) parts.push(`${additions} added`);
      if (removals > 0) parts.push(`${removals} removed`);
      if (modifications > 0) parts.push(`${modifications} modified`);

      changedSections.push(`Frontmatter: ${parts.join(', ')}`);
    }

    if (plan.linkChanges.length > 0) {
      const verified = plan.linkChanges.filter(c => c.type === 'verify' && c.status === 'valid').length;
      const issues = plan.linkChanges.filter(c => c.type !== 'verify' || c.status !== 'valid').length;

      changedSections.push(`Links: ${verified} verified${issues > 0 ? `, ${issues} issues found` : ''}`);
    }

    for (const section of changedSections) {
      console.log(`• ${section}`);
    }

    // File size comparison
    const newSize = Buffer.byteLength(this.generateUpdatedDocument(processedDocument), 'utf8');
    const originalSize = originalDocument.metadata.size;
    const sizeDiff = newSize - originalSize;

    if (sizeDiff !== 0) {
      const direction = sizeDiff > 0 ? 'increased' : 'decreased';
      const color = sizeDiff > 0 ? chalk.red : chalk.green;
      const percent = Math.round(Math.abs(sizeDiff) / originalSize * 100);

      console.log();
      console.log(color(`File size ${direction}: ${FileUtils.formatFileSize(Math.abs(sizeDiff))} (${percent}%)`));
    }

    console.log();
    console.log(chalk.gray('Use "age --undo" to restore the original file if needed.'));
  }
}