# Age CLI Command Specifications

## Overview

This document defines the exact behavior expected from each Age CLI command. Each specification includes input/output examples, error cases, and step-by-step processing details.

## Command: `age detect <file>`

### Purpose
Analyze a markdown file and determine its document type(s) based on frontmatter, content patterns, and file location.

### Expected Behavior

#### Input
```bash
age detect notes/meeting-notes-2024-01-15.md
```

#### Processing Steps
1. **File Validation**
   - Check if file exists and is readable
   - Verify file has .md extension
   - Ensure file size is reasonable (< 10MB)

2. **Parse Document**
   - Extract frontmatter using gray-matter
   - Parse markdown content structure
   - Analyze file path and name patterns

3. **Type Detection**
   - Score each document type based on:
     - Frontmatter fields present
     - Content patterns (headers, lists, etc.)
     - File path location
     - Filename conventions

#### Output Format
```
Document: notes/meeting-notes-2024-01-15.md
File size: 2.3KB
Last modified: 2024-01-15 10:30:00

Detected Types (confidence score):
✓ meeting-notes (95%) - Contains: date, attendees, agenda structure
✓ project-work (70%) - Contains: project tag, action items
• research (30%) - Contains: external links
• personal-notes (15%) - Contains: first-person language

Frontmatter Analysis:
- date: 2024-01-15 ✓ (keeps meeting context)
- attendees: ["John", "Sarah"] ✓ (important for reference)
- project: "Website Redesign" ✓ (categorization)
- author: "Me" ⚠ (usually removed - creates dead links)
- status: "draft" ⚠ (temporary metadata)

Content Patterns:
- Action items: 5 found
- External URLs: 2 found
- Cross-references: 3 vault links
- Code blocks: 0
```

#### Error Cases
```bash
# File doesn't exist
$ age detect nonexistent.md
Error: File 'nonexistent.md' not found

# Not a markdown file
$ age detect document.txt
Error: File must have .md extension

# File too large
$ age detect huge-file.md
Warning: File is 15MB, processing may be slow
```

---

## Command: `age <file>`

### Purpose
Transform a markdown document by removing cruft, summarizing content, and optimizing for long-term storage.

### Expected Behavior

#### Input
```bash
age notes/meeting-notes-2024-01-15.md
```

#### Processing Steps

1. **Pre-processing Analysis**
   - Run document type detection
   - Load applicable processing rules from .age/ configs
   - Create backup in .age/backups/

2. **Interactive Planning Phase**
   ```
   Aging: notes/meeting-notes-2024-01-15.md
   Detected as: meeting-notes (95% confidence)

   Planned Changes:

   📝 Frontmatter Updates:
   + Add: aged_date, summary_length
   - Remove: author, status
   ~ Modify: tags (add "archived")

   🔗 Link Processing:
   - Check 3 external URLs for availability
   - Verify 2 internal vault links

   📄 Content Processing:
   - Summarize discussion sections (preserve action items)
   - Extract key decisions and outcomes
   - Maintain attendee context and project reference

   ⚠ Estimated content reduction: 2.3KB → 1.1KB (52%)

   Continue? [Y]es/[P]review changes/[C]onfigure/[A]bort:
   ```

3. **Change Preview (if requested)**
   ```
   === FRONTMATTER CHANGES ===

   - author: evan
   - status: draft
   + aged_date: 2024-01-20
   + summary_length: short
   ~ tags: [meeting, project] → [meeting, project, archived]

   === CONTENT CHANGES ===

   Original (lines 15-25):
   > John mentioned that we should consider the new design approach.
   > Sarah agreed but had concerns about the timeline. We discussed
   > various options for about 20 minutes. There were several good
   > points raised about user experience...

   Proposed:
   > **Key Discussion**: Team reviewed new design approach. Concerns
   > raised about timeline feasibility.

   === URL PROCESSING ===

   https://example.com/design-specs → Fetched (200 OK)
   Summary: "Design specification document outlining new UI patterns..."

   Continue with these changes? [Y]es/[N]o/[E]dit:
   ```

4. **Processing Execution**
   ```
   Processing document...
   ✓ Backup created: .age/backups/meeting-notes-2024-01-15_20240120-143022.md
   ✓ Frontmatter updated
   ✓ Content summarized (2 sections processed)
   ✓ URLs processed (1 summarized, 1 verified)
   ✓ Links verified (2 internal links OK)

   Aged document saved: notes/meeting-notes-2024-01-15.md
   Content reduced: 2.3KB → 1.1KB (52% reduction)

   Next suggested aging: March 2024 (document maturity: juvenile → mature)
   ```

#### Configuration Rules Applied
Based on document type `meeting-notes`:
```json
{
  "frontmatter": {
    "keep": ["date", "attendees", "project", "tags"],
    "remove": ["author", "status", "draft"],
    "add": {
      "aged_date": "{{current_date}}",
      "summary_length": "short",
      "next_review": "{{current_date + 60_days}}"
    }
  },
  "content": {
    "summarize_sections": ["discussion", "notes"],
    "preserve": ["action-items", "decisions", "attendees"],
    "url_processing": true,
    "link_verification": true
  }
}
```

---

## Command: `age --batch <directory>`

### Purpose
Process multiple markdown files in a directory with reduced interactivity for bulk operations.

### Expected Behavior

#### Input
```bash
age --batch notes/meetings/
```

#### Processing Steps

1. **Directory Analysis**
   ```
   Scanning: notes/meetings/
   Found 15 markdown files

   Document Types Detected:
   - meeting-notes: 12 files
   - project-work: 2 files
   - research: 1 file

   Estimated Processing Time: ~3 minutes
   Estimated Storage Reduction: ~40%
   ```

2. **Batch Configuration**
   ```
   Batch Processing Options:
   [1] Fully automatic (use default rules)
   [2] Approve each document type once
   [3] Review each file individually
   [4] Custom configuration

   Choice [1]: 2
   ```

3. **Type-Based Approval**
   ```
   === MEETING-NOTES RULES (12 files) ===
   - Remove: author, status fields
   - Add: aged_date, summary_length
   - Summarize: discussion sections
   - Preserve: action items, decisions

   Apply to all meeting-notes files? [Y]es/[N]o/[C]ustomize: Y
   ```

4. **Batch Execution**
   ```
   Processing batch...
   [█████████████████████████████████████████████████████████] 15/15

   ✓ meeting-2024-01-15.md (2.3KB → 1.1KB)
   ✓ meeting-2024-01-10.md (1.8KB → 0.9KB)
   ⚠ meeting-2024-01-08.md (unchanged - recently aged)
   ✓ project-review.md (3.1KB → 1.8KB)
   ...

   Batch Complete:
   - Processed: 14 files
   - Skipped: 1 file (already aged)
   - Total reduction: 34.2KB → 18.7KB (45%)
   - Backups created: 14 files
   ```

---

## Command: `age --undo <file>`

### Purpose
Restore a document from its backup in .age/backups/ directory.

### Expected Behavior

#### Input
```bash
age --undo notes/meeting-notes-2024-01-15.md
```

#### Processing Steps

1. **Backup Discovery**
   ```
   Finding backups for: notes/meeting-notes-2024-01-15.md

   Available backups:
   [1] 2024-01-20 14:30:22 - Before aging (2.3KB)
   [2] 2024-01-18 09:15:45 - Before manual edit (2.1KB)
   [3] 2024-01-15 16:45:10 - Original creation (2.8KB)

   Which backup to restore? [1]: 1
   ```

2. **Restore Confirmation**
   ```
   Restore Plan:

   Current file: notes/meeting-notes-2024-01-15.md (1.1KB, aged)
   Restore from: 2024-01-20 14:30:22 backup (2.3KB, pre-aging)

   ⚠ This will overwrite current content
   ⚠ Current file will be backed up first

   Continue? [Y]es/[N]o: Y
   ```

3. **Restore Execution**
   ```
   Restoring file...
   ✓ Current file backed up: .age/backups/meeting-notes-2024-01-15_before-restore_20240120-154500.md
   ✓ File restored from backup

   notes/meeting-notes-2024-01-15.md restored (1.1KB → 2.3KB)
   ```

---

## Command: `age config`

### Purpose
Manage Age CLI configuration at different hierarchy levels.

### Expected Behavior

#### Subcommands

##### `age config --show`
```
Age Configuration (hierarchical):

Global (~/.age/config.json):
  ai.provider: openai
  ai.model: gpt-4
  backup.retention: 30d

Vault (/path/to/vault/.age/config.json):
  document_types: custom-types.json
  processing.interactive: true

Local (./.age/config.json):
  (none)

Effective Configuration:
  ai.provider: openai (global)
  ai.model: gpt-4 (global)
  backup.retention: 30d (global)
  document_types: custom-types.json (vault)
  processing.interactive: true (vault)
```

##### `age config --edit global`
Opens `~/.age/config.json` in default editor

##### `age config --init`
```
Initialize Age configuration in current directory? [Y]es/[N]o: Y

✓ Created .age/ directory
✓ Created .age/config.json with defaults
✓ Created .age/document-types.json with PARA types
✓ Created .age/README.md

Configuration initialized. Edit .age/config.json to customize.
```

---

## Command: `age status`

### Purpose
Show vault health, aging statistics, and system status.

### Expected Behavior

#### Output
```
Age CLI Status Report
Generated: 2024-01-20 15:45:00

=== VAULT HEALTH ===
Documents analyzed: 1,247 files
Total size: 45.2MB
Average document age: 127 days

Document Types:
- meeting-notes: 234 files (18.8%)
- research: 189 files (15.2%)
- project-work: 156 files (12.5%)
- personal-notes: 145 files (11.6%)
- other: 523 files (41.9%)

=== AGING STATISTICS ===
Aged documents: 89 files (7.1%)
Storage saved: 12.3MB (27.2% reduction)
Last aging session: 2024-01-18 (2 days ago)

Recently aged:
- 2024-01-18: 12 files processed
- 2024-01-15: 8 files processed
- 2024-01-10: 15 files processed

=== LINK HEALTH ===
Internal links: 2,847 total
- Valid: 2,791 (98.0%)
- Broken: 56 (2.0%)

External links: 456 total
- Last verified: 2024-01-15
- Need verification: 23 links

=== SYSTEM STATUS ===
Configuration: ✓ Valid
AI Provider: ✓ OpenAI (gpt-4) - API key valid
Backups: ✓ 127 files in .age/backups/ (12.3MB)
- Retention: 30 days
- Oldest backup: 2023-12-15

Recommendations:
⚠ 23 documents haven't been aged in 90+ days
⚠ 56 broken internal links need attention
ⓘ Consider aging documents in: notes/archive/2023/
```

---

## Error Handling Patterns

### Common Error Scenarios

1. **File Access Errors**
   ```bash
   Error: Permission denied reading 'protected-file.md'
   Suggestion: Check file permissions or run with appropriate access
   ```

2. **AI Service Errors**
   ```bash
   Error: AI service unavailable (OpenAI API timeout)
   Fallback: Continue with local processing only? [Y]es/[N]o
   ```

3. **Configuration Errors**
   ```bash
   Error: Invalid configuration in .age/config.json
   Line 15: "retentoin" should be "retention"

   Fix automatically? [Y]es/[N]o/[E]dit manually
   ```

4. **Backup Errors**
   ```bash
   Warning: Backup directory .age/backups/ is 95% full (450MB)

   Options:
   [1] Clean old backups (30+ days)
   [2] Increase retention period
   [3] Continue without backup (not recommended)
   ```

This specification will guide our implementation and ensure consistent, predictable behavior across all Age CLI commands.