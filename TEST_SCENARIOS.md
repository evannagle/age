# Age CLI Test Scenarios

## Overview

This document defines specific test cases for validating Age CLI functionality. Each scenario includes sample input files, expected outputs, and validation criteria.

## Test Data Setup

### Sample Documents

#### 1. Meeting Notes (`test-data/meeting-notes.md`)
```markdown
---
date: 2024-01-15
attendees: [John, Sarah, Mike]
project: Website Redesign
author: evan
status: draft
tags: [meeting, project]
---

# Team Meeting - Website Redesign

## Agenda
- Review current progress
- Discuss new design approach
- Plan next sprint

## Discussion

John mentioned that we should consider the new design approach. Sarah agreed but had concerns about the timeline. We discussed various options for about 20 minutes. There were several good points raised about user experience and technical feasibility.

Mike brought up some implementation details that I hadn't considered. We went back and forth on the database schema changes needed.

## Action Items
- [ ] John: Create mockups for new design
- [ ] Sarah: Review timeline and dependencies
- [ ] Mike: Research database migration approach
- [x] Evan: Schedule follow-up meeting

## Links
- [Design Specs](https://example.com/design-specs)
- [[Project Overview]]
- https://github.com/company/project

## Notes
Personal reminder: Need to follow up with the client about their feedback on colors.
```

#### 2. Research Document (`test-data/research-notes.md`)
```markdown
---
source: "Deep Learning Paper"
methodology: "Literature Review"
tags: [ai, research, ml]
author: evan
created: 2024-01-10
status: in-progress
---

# Transformer Architecture Analysis

## Summary

This paper introduces the Transformer architecture which has revolutionized natural language processing. The key innovation is the self-attention mechanism that allows the model to weigh the importance of different parts of the input sequence.

## Key Findings

The attention mechanism computes a weighted average of all positions in the sequence, allowing the model to access information from any part of the input. This is more efficient than recurrent approaches.

### Technical Details

The multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions.

Formula: Attention(Q,K,V) = softmax(QK^T/√d_k)V

## Applications

- Machine translation
- Text summarization
- Question answering
- Code generation

## Personal Notes

This seems really applicable to our current project. Should discuss with the team whether we want to implement something similar for document summarization.

Need to read the follow-up papers on BERT and GPT.

## References
- https://arxiv.org/abs/1706.03762
- [[Related AI Papers]]
```

#### 3. Project Work (`test-data/project-task.md`)
```markdown
---
project: "Mobile App"
priority: high
assigned: evan
due_date: 2024-02-01
status: in-progress
tags: [development, mobile, urgent]
---

# Implement User Authentication

## Requirements
- OAuth integration with Google/Apple
- Secure token storage
- Password reset flow
- Multi-device support

## Implementation Plan

### Phase 1: Basic Auth
1. Set up OAuth providers
2. Implement login/logout flows
3. Add token management

### Phase 2: Security
1. Add biometric authentication
2. Implement secure storage
3. Add session management

## Technical Notes

Using Firebase Auth for the backend. Need to configure the OAuth providers in the console.

```javascript
// Example implementation
const auth = getAuth();
signInWithPopup(auth, provider)
  .then((result) => {
    const user = result.user;
    // Handle successful login
  });
```

## Blockers
- Waiting for design mockups
- Need API keys from client

## Progress
- [x] Research authentication libraries
- [x] Set up development environment
- [ ] Implement OAuth flows
- [ ] Add error handling
- [ ] Write tests
```

#### 4. Personal Notes (`test-data/personal-thoughts.md`)
```markdown
---
date: 2024-01-12
mood: reflective
tags: [personal, journal]
---

# Weekend Reflections

## What I'm Thinking About

Had an interesting conversation with mom about career choices. She made some good points about work-life balance that I hadn't really considered before.

The new project at work is challenging but exciting. I feel like I'm learning a lot, especially about system architecture and team leadership.

## Random Thoughts

- Need to call dentist about appointment
- Should probably start exercising more regularly
- Want to learn photography this year

## Ideas for Later

Maybe I should write a blog post about the technical challenges we solved last week. Could be helpful for other developers facing similar issues.

Also thinking about starting a side project - maybe something related to productivity tools for developers.

## Links
- [[Career Planning]]
- https://blog.example.com/work-life-balance
```

## Test Scenarios

### Scenario 1: Document Type Detection

#### Test 1.1: Meeting Notes Detection
```bash
age detect test-data/meeting-notes.md
```

**Expected Output:**
```
Document: test-data/meeting-notes.md
File size: 1.2KB
Last modified: 2024-01-15 10:30:00

Detected Types (confidence score):
✓ meeting-notes (95%) - Contains: date, attendees, agenda structure
✓ project-work (70%) - Contains: project tag, action items
• personal-notes (25%) - Contains: first-person language

Frontmatter Analysis:
- date: 2024-01-15 ✓ (keeps meeting context)
- attendees: ["John", "Sarah", "Mike"] ✓ (important for reference)
- project: "Website Redesign" ✓ (categorization)
- author: "evan" ⚠ (usually removed - creates dead links)
- status: "draft" ⚠ (temporary metadata)

Content Patterns:
- Action items: 4 found
- External URLs: 2 found
- Cross-references: 1 vault link
- Code blocks: 0
```

**Validation Criteria:**
- [x] Correctly identifies meeting-notes as highest confidence
- [x] Finds action items pattern
- [x] Identifies problematic frontmatter fields
- [x] Counts external and internal links correctly

#### Test 1.2: Research Document Detection
```bash
age detect test-data/research-notes.md
```

**Expected Output:**
```
Document: test-data/research-notes.md
File size: 1.8KB
Last modified: 2024-01-10 15:20:00

Detected Types (confidence score):
✓ research (90%) - Contains: source, methodology, references
• personal-notes (40%) - Contains: personal opinions, notes
• project-work (20%) - Contains: application notes

Frontmatter Analysis:
- source: "Deep Learning Paper" ✓ (important for citation)
- methodology: "Literature Review" ✓ (research context)
- author: "evan" ⚠ (usually removed)
- status: "in-progress" ⚠ (temporary metadata)

Content Patterns:
- References: 2 found
- Technical formulas: 1 found
- External URLs: 1 found
- Cross-references: 1 vault link
```

### Scenario 2: Document Aging (Without AI)

#### Test 2.1: Meeting Notes Aging
```bash
age test-data/meeting-notes.md
```

**Expected Interactive Flow:**
```
Aging: test-data/meeting-notes.md
Detected as: meeting-notes (95% confidence)

Planned Changes:

📝 Frontmatter Updates:
+ Add: aged_date, summary_length
- Remove: author, status
~ Modify: tags (add "archived")

🔗 Link Processing:
- Check 2 external URLs for availability
- Verify 1 internal vault link

📄 Content Processing:
- Frontmatter cleanup only (AI summarization not configured)

Continue? [Y]es/[P]review changes/[C]onfigure/[A]bort: P
```

**Preview Display:**
```
=== FRONTMATTER CHANGES ===

- author: evan
- status: draft
+ aged_date: 2024-01-20
+ summary_length: short
~ tags: [meeting, project] → [meeting, project, archived]

=== LINK PROCESSING ===

https://example.com/design-specs → Checking...
[[Project Overview]] → Internal link (not verified without vault context)

Continue with these changes? [Y]es/[N]o: Y
```

**Final Output:**
```
Processing document...
✓ Backup created: .age/backups/meeting-notes_20240120-143022.md
✓ Frontmatter updated (3 changes)
✓ Links processed (1 external checked)

Aged document saved: test-data/meeting-notes.md
Content unchanged (AI summarization disabled)

Next suggested aging: March 2024 (document maturity: young → juvenile)
```

#### Test 2.2: Undo Operation
```bash
age --undo test-data/meeting-notes.md
```

**Expected Output:**
```
Finding backups for: test-data/meeting-notes.md

Available backups:
[1] 2024-01-20 14:30:22 - Before aging (1.2KB)

Restore from backup? [Y]es/[N]o: Y

Restoring file...
✓ Current file backed up: .age/backups/meeting-notes_before-restore_20240120-154500.md
✓ File restored from backup

test-data/meeting-notes.md restored (aged → original)
```

### Scenario 3: Batch Processing

#### Test 3.1: Directory Analysis
```bash
age --batch test-data/
```

**Expected Output:**
```
Scanning: test-data/
Found 4 markdown files

Document Types Detected:
- meeting-notes: 1 file
- research: 1 file
- project-work: 1 file
- personal-notes: 1 file

Estimated Processing Time: ~30 seconds (no AI)
Files needing aging: 4 (100%)
```

### Scenario 4: Configuration Management

#### Test 4.1: Configuration Display
```bash
age config --show
```

**Expected Output:**
```
Age Configuration (hierarchical):

Global (~/.age/config.json):
  (not found)

Local (./.age/config.json):
  (not found)

Built-in Defaults:
  backup.retention: 30d
  processing.interactive: true
  ai.provider: none
  document_types: built-in PARA types

Effective Configuration:
  backup.retention: 30d (default)
  processing.interactive: true (default)
  ai.provider: none (default)
```

#### Test 4.2: Configuration Initialization
```bash
age config --init
```

**Expected Output:**
```
Initialize Age configuration in current directory? [Y]es/[N]o: Y

✓ Created .age/ directory
✓ Created .age/config.json with defaults
✓ Created .age/document-types.json with PARA types
✓ Created .age/README.md

Configuration initialized. Edit .age/config.json to customize.
```

**Files Created:**
- `.age/config.json`
- `.age/document-types.json`
- `.age/README.md`
- `.age/backups/` (directory)

### Scenario 5: Status and Health

#### Test 5.1: Basic Status
```bash
age status
```

**Expected Output:**
```
Age CLI Status Report
Generated: 2024-01-20 15:45:00

=== VAULT HEALTH ===
Documents found: 4 files
Total size: 4.8KB

Document Types:
- meeting-notes: 1 file (25.0%)
- research: 1 file (25.0%)
- project-work: 1 file (25.0%)
- personal-notes: 1 file (25.0%)

=== AGING STATISTICS ===
Aged documents: 0 files (0%)
Storage saved: 0KB
Last aging session: never

=== SYSTEM STATUS ===
Configuration: ✓ Valid (using defaults)
AI Provider: ⚠ Not configured
Backups: ✓ Directory exists, 0 files

Recommendations:
ⓘ Configure AI provider for content summarization
ⓘ Run 'age config --init' to set up local configuration
```

## Error Testing Scenarios

### Error 1: File Not Found
```bash
age detect nonexistent.md
```
**Expected:** `Error: File 'nonexistent.md' not found`

### Error 2: Invalid File Type
```bash
age detect test.txt
```
**Expected:** `Error: File must have .md extension`

### Error 3: Permission Denied
```bash
age detect /root/protected.md
```
**Expected:** `Error: Permission denied reading '/root/protected.md'`

### Error 4: Invalid Configuration
```bash
# After creating invalid .age/config.json
age status
```
**Expected:**
```
Error: Invalid configuration in .age/config.json
Line 5: "retentoin" should be "retention"

Fix automatically? [Y]es/[N]o/[E]dit manually
```

## Performance Testing

### Large File Test
- Create 100KB markdown file
- Test detection and aging performance
- Ensure processing completes within reasonable time

### Batch Performance Test
- Create directory with 100 small markdown files
- Test batch processing performance
- Verify memory usage stays reasonable

## Integration Testing

### End-to-End Workflow
1. Initialize configuration: `age config --init`
2. Detect document type: `age detect meeting-notes.md`
3. Age document: `age meeting-notes.md`
4. Check status: `age status`
5. Undo aging: `age --undo meeting-notes.md`
6. Verify restoration worked correctly

## Automated Testing Strategy

### Unit Tests
- Document parser functionality
- Type detection algorithms
- Configuration loading
- Backup/restore operations

### Integration Tests
- Full command workflows
- Configuration hierarchy resolution
- Error handling and recovery

### Manual Test Checklist
- [ ] All commands produce expected output format
- [ ] Interactive prompts work correctly
- [ ] Error messages are helpful and actionable
- [ ] Performance is acceptable on realistic data
- [ ] Backup/restore cycle preserves data integrity

This test suite ensures that every feature works as specified and handles edge cases gracefully.