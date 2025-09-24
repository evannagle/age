# Age CLI Processing Pipeline

## Overview

This document defines the step-by-step processing pipeline that transforms a markdown document through the aging process. Each step is modular and can be tested independently.

## Pipeline Architecture

```
Input Document
     ↓
┌─────────────────┐
│ 1. VALIDATION   │
│   & PARSING     │
└─────────────────┘
     ↓
┌─────────────────┐
│ 2. TYPE         │
│   DETECTION     │
└─────────────────┘
     ↓
┌─────────────────┐
│ 3. RULE         │
│   LOADING       │
└─────────────────┘
     ↓
┌─────────────────┐
│ 4. CHANGE       │
│   PLANNING      │
└─────────────────┘
     ↓
┌─────────────────┐
│ 5. USER         │
│   APPROVAL      │
└─────────────────┘
     ↓
┌─────────────────┐
│ 6. BACKUP       │
│   CREATION      │
└─────────────────┘
     ↓
┌─────────────────┐
│ 7. PROCESSING   │
│   EXECUTION     │
└─────────────────┘
     ↓
┌─────────────────┐
│ 8. VALIDATION   │
│   & CLEANUP     │
└─────────────────┘
     ↓
Output Document
```

## Step 1: Validation & Parsing

### Purpose
Ensure the input file is valid and extract structured data for processing.

### Implementation (`src/utils/markdown.ts`)

```typescript
interface ParsedDocument {
  filePath: string;
  frontmatter: Record<string, any>;
  content: string;
  structure: ContentStructure;
  metadata: FileMetadata;
}

interface ContentStructure {
  headers: Header[];
  links: Link[];
  codeBlocks: CodeBlock[];
  lists: ListItem[];
  actionItems: ActionItem[];
}

interface FileMetadata {
  size: number;
  lastModified: Date;
  encoding: string;
}
```

### Processing Steps
1. **File System Validation**
   - Check file exists and is readable
   - Verify .md extension
   - Check file size (warn if > 10MB)
   - Validate encoding (UTF-8)

2. **Frontmatter Extraction**
   - Parse YAML frontmatter with gray-matter
   - Validate frontmatter structure
   - Handle malformed YAML gracefully

3. **Content Analysis**
   - Parse markdown structure with remark
   - Extract headers, links, code blocks
   - Identify Obsidian-specific syntax ([[links]], tags)
   - Find action items (- [ ] patterns)

4. **Error Handling**
   ```typescript
   // File access errors
   if (!fs.existsSync(filePath)) {
     throw new Error(`File '${filePath}' not found`);
   }

   // Permission errors
   try {
     fs.accessSync(filePath, fs.constants.R_OK);
   } catch (error) {
     throw new Error(`Permission denied reading '${filePath}'`);
   }

   // Malformed frontmatter
   try {
     const parsed = matter(content);
   } catch (error) {
     console.warn(`Warning: Malformed frontmatter in ${filePath}`);
     // Continue with empty frontmatter
   }
   ```

### Output
```typescript
const parsedDoc: ParsedDocument = {
  filePath: "notes/meeting.md",
  frontmatter: {
    date: "2024-01-15",
    attendees: ["John", "Sarah"],
    project: "Website Redesign"
  },
  content: "# Meeting Notes\n\n...",
  structure: {
    headers: [{ level: 1, text: "Meeting Notes", line: 6 }],
    links: [
      { type: "external", url: "https://example.com", text: "Design Specs" },
      { type: "internal", link: "[[Project Overview]]" }
    ],
    actionItems: [
      { text: "Create mockups", assignee: "John", completed: false }
    ]
  }
};
```

## Step 2: Type Detection

### Purpose
Determine the document type(s) based on content analysis and scoring.

### Implementation (`src/types/detector.ts`)

```typescript
interface TypeScore {
  type: string;
  confidence: number;
  reasons: string[];
  warnings?: string[];
}

interface DetectionResult {
  primaryType: string;
  allScores: TypeScore[];
  recommendations: Recommendation[];
}
```

### Scoring Algorithm

#### Frontmatter Scoring (40% weight)
```typescript
const frontmatterScoring = {
  'meeting-notes': {
    required: ['date', 'attendees'],
    bonus: ['project', 'agenda'],
    penalty: ['author', 'draft'],
    patterns: {
      date: /^\d{4}-\d{2}-\d{2}$/,
      attendees: (value) => Array.isArray(value)
    }
  },
  'research': {
    required: ['source'],
    bonus: ['methodology', 'references'],
    patterns: {
      methodology: /literature|survey|experiment|analysis/i
    }
  }
};
```

#### Content Pattern Scoring (40% weight)
```typescript
const contentPatterns = {
  'meeting-notes': {
    headers: /agenda|discussion|action.?items|notes/i,
    actionItems: { min: 1, weight: 0.3 },
    attendeeReferences: { patterns: /john|sarah|mike/gi, weight: 0.2 }
  },
  'research': {
    citations: { min: 1, weight: 0.4 },
    methodology: { patterns: /method|approach|analysis/i, weight: 0.3 },
    conclusions: { patterns: /conclusion|findings|results/i, weight: 0.2 }
  }
};
```

#### File Path Scoring (20% weight)
```typescript
const pathPatterns = {
  'meeting-notes': /meetings?|notes/i,
  'research': /research|papers?|studies/i,
  'project-work': /projects?|tasks?|work/i,
  'personal-notes': /personal|journal|diary/i
};
```

### Detection Logic
```typescript
function detectDocumentType(doc: ParsedDocument): DetectionResult {
  const scores: TypeScore[] = [];

  for (const type of documentTypes) {
    let confidence = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Frontmatter scoring
    const frontmatterScore = scoreFrontmatter(doc.frontmatter, type);
    confidence += frontmatterScore.score * 0.4;
    reasons.push(...frontmatterScore.reasons);
    warnings.push(...frontmatterScore.warnings);

    // Content pattern scoring
    const contentScore = scoreContentPatterns(doc.structure, type);
    confidence += contentScore.score * 0.4;
    reasons.push(...contentScore.reasons);

    // Path scoring
    const pathScore = scoreFilePath(doc.filePath, type);
    confidence += pathScore.score * 0.2;
    if (pathScore.score > 0) {
      reasons.push(`File path matches ${type} pattern`);
    }

    scores.push({
      type,
      confidence: Math.min(confidence, 1.0),
      reasons,
      warnings
    });
  }

  scores.sort((a, b) => b.confidence - a.confidence);

  return {
    primaryType: scores[0].type,
    allScores: scores,
    recommendations: generateRecommendations(scores, doc)
  };
}
```

## Step 3: Rule Loading

### Purpose
Load and merge processing rules from the configuration hierarchy.

### Implementation (`src/config/hierarchy.ts`)

```typescript
interface ProcessingRules {
  frontmatter: FrontmatterRules;
  content: ContentRules;
  links: LinkRules;
  backup: BackupRules;
}

interface FrontmatterRules {
  keep: string[];
  remove: string[];
  add: Record<string, string | TemplateFunction>;
  modify: Record<string, ModificationRule>;
}
```

### Configuration Loading Order
1. **Built-in Defaults** (`src/config/defaults.ts`)
2. **Global Config** (`~/.age/config.json`)
3. **Vault Config** (`vault/.age/config.json`)
4. **Local Config** (`.age/config.json`)

### Rule Merging Logic
```typescript
function loadProcessingRules(
  documentType: string,
  filePath: string
): ProcessingRules {
  const configFiles = findConfigFiles(filePath);
  const rules = { ...DEFAULT_RULES };

  for (const configFile of configFiles) {
    const config = loadConfig(configFile);
    const typeRules = config.documentTypes?.[documentType];

    if (typeRules) {
      // Merge arrays (union for keep, union for remove)
      rules.frontmatter.keep = [...new Set([
        ...rules.frontmatter.keep,
        ...typeRules.frontmatter.keep
      ])];

      // Merge objects (later configs override)
      Object.assign(rules.frontmatter.add, typeRules.frontmatter.add);
    }
  }

  return rules;
}
```

## Step 4: Change Planning

### Purpose
Analyze the document and plan all changes that will be made during processing.

### Implementation (`src/commands/age.ts`)

```typescript
interface ChangePlan {
  frontmatterChanges: FrontmatterChange[];
  contentChanges: ContentChange[];
  linkChanges: LinkChange[];
  metadata: ChangePlanMetadata;
}

interface FrontmatterChange {
  type: 'add' | 'remove' | 'modify';
  field: string;
  oldValue?: any;
  newValue?: any;
  reason: string;
}
```

### Planning Logic
```typescript
function planChanges(
  doc: ParsedDocument,
  rules: ProcessingRules,
  typeDetection: DetectionResult
): ChangePlan {
  const plan: ChangePlan = {
    frontmatterChanges: [],
    contentChanges: [],
    linkChanges: [],
    metadata: {
      estimatedSizeChange: 0,
      processingTime: 'unknown',
      aiRequired: false
    }
  };

  // Plan frontmatter changes
  for (const field of rules.frontmatter.remove) {
    if (doc.frontmatter[field] !== undefined) {
      plan.frontmatterChanges.push({
        type: 'remove',
        field,
        oldValue: doc.frontmatter[field],
        reason: `Document type '${typeDetection.primaryType}' removes '${field}'`
      });
    }
  }

  // Plan additions with template processing
  for (const [field, template] of Object.entries(rules.frontmatter.add)) {
    const newValue = processTemplate(template, doc);
    plan.frontmatterChanges.push({
      type: 'add',
      field,
      newValue,
      reason: `Document type '${typeDetection.primaryType}' adds '${field}'`
    });
  }

  // Plan link processing
  for (const link of doc.structure.links) {
    if (link.type === 'external') {
      plan.linkChanges.push({
        type: 'verify',
        url: link.url,
        action: 'check_availability'
      });
    }
  }

  return plan;
}
```

### Template Processing
```typescript
const templateFunctions = {
  current_date: () => new Date().toISOString().split('T')[0],
  file_size: (doc: ParsedDocument) => fs.statSync(doc.filePath).size,
  word_count: (doc: ParsedDocument) => doc.content.split(/\s+/).length,
  aged_date: () => new Date().toISOString().split('T')[0],
  next_review: () => {
    const date = new Date();
    date.setDate(date.getDate() + 60);
    return date.toISOString().split('T')[0];
  }
};
```

## Step 5: User Approval

### Purpose
Present planned changes to the user and get approval before execution.

### Implementation (`src/interactive/approval.ts`)

```typescript
enum ApprovalResult {
  APPROVE = 'approve',
  REJECT = 'reject',
  PREVIEW = 'preview',
  CONFIGURE = 'configure',
  ABORT = 'abort'
}

interface ApprovalOptions {
  showEstimatedChanges: boolean;
  allowConfiguration: boolean;
  defaultAction: ApprovalResult;
}
```

### Interactive Flow
```typescript
async function getUserApproval(
  plan: ChangePlan,
  options: ApprovalOptions
): Promise<ApprovalResult> {
  // Display planned changes summary
  console.log(formatChangePlan(plan));

  // Get user choice
  const choice = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'How would you like to proceed?',
    choices: [
      { name: 'Yes - Apply all changes', value: 'approve' },
      { name: 'Preview - Show detailed changes', value: 'preview' },
      { name: 'Configure - Modify rules', value: 'configure' },
      { name: 'Abort - Cancel operation', value: 'abort' }
    ],
    default: options.defaultAction
  }]);

  if (choice.action === 'preview') {
    showDetailedPreview(plan);
    return getUserApproval(plan, options); // Recursive call after preview
  }

  return choice.action;
}
```

### Preview Display (`src/interactive/diff.ts`)
```typescript
function showDetailedPreview(plan: ChangePlan): void {
  console.log(chalk.bold('\n=== DETAILED CHANGE PREVIEW ===\n'));

  // Show frontmatter changes
  if (plan.frontmatterChanges.length > 0) {
    console.log(chalk.yellow('📝 Frontmatter Changes:'));
    for (const change of plan.frontmatterChanges) {
      switch (change.type) {
        case 'add':
          console.log(chalk.green(`+ ${change.field}: ${change.newValue}`));
          break;
        case 'remove':
          console.log(chalk.red(`- ${change.field}: ${change.oldValue}`));
          break;
        case 'modify':
          console.log(chalk.blue(`~ ${change.field}: ${change.oldValue} → ${change.newValue}`));
          break;
      }
      console.log(chalk.gray(`  Reason: ${change.reason}\n`));
    }
  }

  // Show content changes
  if (plan.contentChanges.length > 0) {
    console.log(chalk.yellow('📄 Content Changes:'));
    for (const change of plan.contentChanges) {
      console.log(`${change.description}:`);
      console.log(chalk.red('- Original:'));
      console.log(formatContentBlock(change.oldContent));
      console.log(chalk.green('+ Proposed:'));
      console.log(formatContentBlock(change.newContent));
    }
  }
}
```

## Step 6: Backup Creation

### Purpose
Create a timestamped backup before making any changes.

### Implementation (`src/utils/backup.ts`)

```typescript
interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  fileSize: number;
  checksum: string;
}

function createBackup(filePath: string): BackupInfo {
  const timestamp = new Date();
  const backupDir = findBackupDirectory(filePath);

  // Generate backup filename
  const basename = path.basename(filePath, '.md');
  const timestampStr = timestamp.toISOString()
    .replace(/[:.]/g, '')
    .replace('T', '-')
    .slice(0, 15);

  const backupPath = path.join(
    backupDir,
    `${basename}_${timestampStr}.md`
  );

  // Copy file with metadata preservation
  fs.copyFileSync(filePath, backupPath);

  // Generate checksum for integrity verification
  const content = fs.readFileSync(filePath, 'utf8');
  const checksum = crypto.createHash('sha256')
    .update(content)
    .digest('hex');

  // Store backup metadata
  const backupInfo: BackupInfo = {
    originalPath: filePath,
    backupPath,
    timestamp,
    fileSize: fs.statSync(filePath).size,
    checksum
  };

  // Save backup registry
  updateBackupRegistry(backupInfo);

  return backupInfo;
}
```

### Backup Directory Resolution
```typescript
function findBackupDirectory(filePath: string): string {
  // Look for .age/backups/ in directory hierarchy
  let currentDir = path.dirname(path.resolve(filePath));

  while (currentDir !== path.dirname(currentDir)) {
    const ageDir = path.join(currentDir, '.age');
    const backupDir = path.join(ageDir, 'backups');

    if (fs.existsSync(ageDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      return backupDir;
    }

    currentDir = path.dirname(currentDir);
  }

  // Fallback to global backups
  const globalBackupDir = path.join(os.homedir(), '.age', 'backups');
  fs.mkdirSync(globalBackupDir, { recursive: true });
  return globalBackupDir;
}
```

## Step 7: Processing Execution

### Purpose
Execute the approved changes in the correct order with error handling.

### Implementation (`src/filters/`)

```typescript
class ProcessingPipeline {
  async executeChanges(
    doc: ParsedDocument,
    plan: ChangePlan,
    backup: BackupInfo
  ): Promise<ProcessedDocument> {
    const context: ProcessingContext = {
      originalDoc: doc,
      currentDoc: { ...doc },
      plan,
      backup,
      errors: [],
      warnings: []
    };

    try {
      // Execute in specific order to avoid conflicts
      await this.processFrontmatter(context);
      await this.processLinks(context);
      await this.processContent(context);
      await this.validateResult(context);

      return context.currentDoc;
    } catch (error) {
      // Rollback on failure
      await this.rollback(backup);
      throw new ProcessingError(
        `Processing failed: ${error.message}`,
        context.errors
      );
    }
  }

  private async processFrontmatter(context: ProcessingContext): Promise<void> {
    const frontmatter = { ...context.currentDoc.frontmatter };

    // Apply changes in order: remove, modify, add
    for (const change of context.plan.frontmatterChanges) {
      switch (change.type) {
        case 'remove':
          delete frontmatter[change.field];
          break;
        case 'add':
          frontmatter[change.field] = change.newValue;
          break;
        case 'modify':
          frontmatter[change.field] = change.newValue;
          break;
      }
    }

    context.currentDoc.frontmatter = frontmatter;
  }
}
```

### Content Processing with AI

```typescript
// src/filters/content.ts
async function processContent(
  content: string,
  rules: ContentRules,
  aiProvider?: AIProvider
): Promise<string> {
  if (!rules.summarize || !aiProvider) {
    return content;
  }

  const sections = parseContentSections(content);
  const processedSections: string[] = [];

  for (const section of sections) {
    if (shouldSummarizeSection(section, rules)) {
      const summary = await aiProvider.summarize(
        section.content,
        {
          style: 'concise',
          preserveKeyPoints: true,
          maxLength: calculateTargetLength(section.content)
        }
      );

      processedSections.push(summary);
    } else {
      processedSections.push(section.content);
    }
  }

  return processedSections.join('\n\n');
}
```

## Step 8: Validation & Cleanup

### Purpose
Verify the processed document is valid and perform cleanup operations.

### Implementation (`src/utils/validation.ts`)

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: ProcessingMetrics;
}

function validateProcessedDocument(
  original: ParsedDocument,
  processed: ProcessedDocument,
  plan: ChangePlan
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    metrics: calculateMetrics(original, processed)
  };

  // Validate markdown syntax
  try {
    remark().parse(processed.content);
  } catch (error) {
    result.errors.push({
      type: 'syntax_error',
      message: 'Generated invalid markdown',
      details: error.message
    });
    result.valid = false;
  }

  // Validate frontmatter
  try {
    yaml.load(processed.frontmatterRaw);
  } catch (error) {
    result.errors.push({
      type: 'frontmatter_error',
      message: 'Generated invalid YAML frontmatter',
      details: error.message
    });
    result.valid = false;
  }

  // Check for excessive content reduction
  if (result.metrics.sizeReductionPercent > 80) {
    result.warnings.push({
      type: 'excessive_reduction',
      message: `Content reduced by ${result.metrics.sizeReductionPercent}% - may have lost important information`
    });
  }

  // Verify planned changes were applied
  const actualChanges = calculateActualChanges(original, processed);
  const missedChanges = comparePlannedVsActual(plan, actualChanges);

  if (missedChanges.length > 0) {
    result.warnings.push({
      type: 'incomplete_processing',
      message: `${missedChanges.length} planned changes were not applied`,
      details: missedChanges
    });
  }

  return result;
}
```

### Final Output Generation

```typescript
function generateOutputDocument(processed: ProcessedDocument): string {
  const frontmatterYaml = yaml.dump(processed.frontmatter, {
    sortKeys: true,
    lineWidth: -1 // Prevent line wrapping
  });

  return `---\n${frontmatterYaml}---\n\n${processed.content}`;
}
```

## Error Handling & Recovery

### Error Categories
1. **Recoverable Errors**: Warn user, continue processing
2. **Fatal Errors**: Stop processing, restore from backup
3. **Configuration Errors**: Prompt user to fix, retry

### Recovery Strategies
```typescript
class ProcessingError extends Error {
  constructor(
    message: string,
    public readonly context: ProcessingContext,
    public readonly recoverable: boolean = false
  ) {
    super(message);
  }
}

async function handleProcessingError(
  error: ProcessingError,
  backup: BackupInfo
): Promise<void> {
  if (error.recoverable) {
    console.warn(`Warning: ${error.message}`);
    console.log('Continuing with remaining operations...');
  } else {
    console.error(`Fatal error: ${error.message}`);
    console.log('Restoring from backup...');
    await restoreFromBackup(backup);
    throw error;
  }
}
```

This pipeline ensures reliable, predictable processing with comprehensive error handling and user control at every step.