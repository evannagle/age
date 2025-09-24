# Age CLI Development Roadmap

## Development Philosophy

Build incrementally with testable milestones. Each phase should produce a working CLI that provides value, even if limited. Focus on the core aging workflow first, then expand capabilities.

## Phase 1: Foundation & Detection (Week 1-2)
**Goal**: Get `age detect` working with real markdown files

### 1.1 Core Infrastructure
- [ ] **Document Parser** (`src/utils/markdown.ts`)
  - Parse markdown with frontmatter using gray-matter
  - Extract content structure (headers, lists, links)
  - Handle Obsidian-specific syntax (internal links, tags)

- [ ] **Configuration System** (`src/config/`)
  - Hierarchical config loading (.age folders)
  - Schema validation with default fallbacks
  - Document type definitions loader

- [ ] **File System Utilities** (`src/utils/files.ts`)
  - Safe file reading/writing with error handling
  - Directory traversal for batch operations
  - File backup and restoration

### 1.2 Document Type Detection
- [ ] **Type Detection Engine** (`src/types/detector.ts`)
  - Frontmatter analysis scoring
  - Content pattern matching (action items, code blocks, etc.)
  - File path and naming conventions
  - Confidence scoring algorithm

- [ ] **PARA Document Types** (`src/types/definitions.ts`)
  - Define rules for: meeting-notes, research, project-work, personal-notes
  - Frontmatter field mappings
  - Content pattern definitions

- [ ] **Detection Command** (`src/commands/detect.ts`)
  - Implement full specification from COMMAND_SPECS.md
  - Pretty-printed output with confidence scores
  - Frontmatter analysis and recommendations

### Phase 1 Success Criteria
```bash
# These should work perfectly:
age detect notes/meeting.md        # Shows type detection
age detect --batch notes/          # Analyzes directory
age config --show                  # Shows configuration
age config --init                  # Creates .age/ structure
```

---

## Phase 2: Basic Aging Pipeline (Week 3-4)
**Goal**: Get `age <file>` working without AI summarization

### 2.1 Processing Pipeline
- [ ] **Frontmatter Processor** (`src/filters/frontmatter.ts`)
  - Add/remove/modify fields based on document type
  - Template variable replacement (dates, computed values)
  - Validation and cleanup

- [ ] **Link Processor** (`src/filters/links.ts`)
  - Verify internal Obsidian links
  - Check external URL availability
  - Report broken/dead links

- [ ] **Backup System** (`src/utils/backup.ts`)
  - Create timestamped backups in .age/backups/
  - Backup cleanup based on retention policy
  - Restore functionality

### 2.2 Interactive Workflow
- [ ] **Change Preview** (`src/interactive/diff.ts`)
  - Show before/after comparisons
  - Highlight additions, removals, modifications
  - Clean, readable output format

- [ ] **Approval System** (`src/interactive/approval.ts`)
  - Yes/No/Preview/Configure workflow
  - Handle user input gracefully
  - Implement the exact UX from COMMAND_SPECS.md

### 2.3 Aging Command Implementation
- [ ] **Main Aging Logic** (`src/commands/age.ts`)
  - Pre-processing analysis
  - Interactive planning phase
  - Change execution with rollback on failure
  - Progress reporting

### Phase 2 Success Criteria
```bash
# These should work without AI:
age meeting-notes.md               # Ages with frontmatter cleanup
age --undo meeting-notes.md        # Restores from backup
age status                         # Shows vault statistics
```

---

## Phase 3: AI Integration (Week 5-6)
**Goal**: Add AI-powered content summarization

### 3.1 AI Infrastructure
- [ ] **Provider System** (`src/ai/providers/`)
  - OpenAI client with proper error handling
  - Anthropic client (Claude) support
  - Rate limiting and retry logic
  - API key management from env/config

- [ ] **Summarization Engine** (`src/ai/summarize.ts`)
  - Content analysis and summarization
  - Context-aware prompts based on document type
  - Preserve important sections (action items, decisions)
  - Maintain user's writing style

### 3.2 Content Processing
- [ ] **Content Filter** (`src/filters/content.ts`)
  - AI-powered summarization with user approval
  - Section-by-section processing
  - Preserve critical information patterns

- [ ] **URL Processor** (`src/filters/urls.ts`)
  - Fetch and summarize external URLs
  - Replace URLs with offline summaries
  - Handle different content types

### Phase 3 Success Criteria
```bash
# Full aging workflow with AI:
age research-notes.md              # Summarizes content intelligently
age --batch project-notes/         # Bulk processing with AI
```

---

## Phase 4: Batch Operations (Week 7)
**Goal**: Efficient bulk processing

### 4.1 Batch Processing
- [ ] **Batch Command** (`src/commands/batch.ts`)
  - Directory analysis and type detection
  - Bulk approval workflows
  - Progress tracking and error recovery

- [ ] **Performance Optimization**
  - Parallel processing where safe
  - Caching for repeated operations
  - Memory-efficient handling of large vaults

### Phase 4 Success Criteria
```bash
age --batch vault/                 # Processes entire vault efficiently
age --batch --type meeting-notes vault/  # Type-filtered processing
```

---

## Phase 5: Learning & Intelligence (Week 8)
**Goal**: System learns from user feedback

### 5.1 Learning System
- [ ] **Feedback Capture** (`src/interactive/feedback.ts`)
  - Track user approval/rejection patterns
  - Store successful configurations
  - Identify common manual overrides

- [ ] **Pattern Learning** (`src/ai/learn.ts`)
  - Improve type detection based on feedback
  - Refine summarization based on user preferences
  - Suggest configuration improvements

### 5.2 Advanced Features
- [ ] **Cross-Document Analysis** (`src/utils/vault.ts`)
  - Link relationship mapping
  - Duplicate content detection
  - Orphaned document identification

### Phase 5 Success Criteria
```bash
# System adapts to user preferences:
age analyze-vault                  # Shows improvement opportunities
age doctor                         # Diagnoses vault health issues
```

---

## Implementation Priorities by Feature

### High Priority (Must Have)
1. **Document Type Detection** - Core to the entire system
2. **Frontmatter Processing** - Immediate value, testable
3. **Backup/Restore System** - Safety first
4. **Interactive Approval** - User experience foundation
5. **Basic Content Summarization** - Primary value proposition

### Medium Priority (Should Have)
1. **Batch Processing** - Scalability for large vaults
2. **Link Verification** - Vault health maintenance
3. **Configuration System** - Customization and flexibility
4. **URL Processing** - Enhanced offline capabilities
5. **Learning System** - Long-term improvement

### Low Priority (Nice to Have)
1. **Cross-Document Analysis** - Advanced insights
2. **Performance Optimization** - Only after core features work
3. **Multiple AI Providers** - Can start with just OpenAI
4. **Advanced Configuration** - Start with simple JSON files

## Technical Architecture Decisions

### Core Dependencies
- **gray-matter**: Frontmatter parsing (battle-tested)
- **unified/remark**: Markdown processing with plugin ecosystem
- **commander**: CLI framework (already integrated)
- **inquirer**: Interactive prompts with good UX
- **chalk**: Terminal colors for better output
- **fs-extra**: Enhanced file operations

### AI Integration Strategy
- Start with OpenAI (most reliable)
- Design provider interface for future expansion
- Graceful degradation when AI unavailable
- Local fallbacks for basic operations

### Configuration Architecture
- JSON files for simplicity and readability
- Schema validation to prevent user errors
- Environment variable overrides for CI/deployment
- Hierarchical precedence: local > vault > global

### Testing Strategy
- Unit tests for each utility function
- Integration tests for full command workflows
- Real markdown files in test fixtures
- Mock AI responses for consistent testing

## Development Workflow

### For Each Feature
1. **Write Tests First** - Define expected behavior
2. **Implement Core Logic** - Focus on happy path
3. **Add Error Handling** - Graceful failure modes
4. **User Experience Polish** - Clear output and messaging
5. **Documentation** - Update COMMAND_SPECS.md if behavior changes

### Quality Gates
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] ESLint passes with zero warnings
- [ ] Manual testing of command specifications
- [ ] Performance acceptable on 1000+ document vault

### Release Strategy
- **v0.1**: Phase 1 complete (detection only)
- **v0.2**: Phase 2 complete (basic aging without AI)
- **v0.3**: Phase 3 complete (AI-powered aging)
- **v1.0**: All phases complete, production ready

This roadmap ensures we build a solid foundation first, then add intelligence and scale. Each phase delivers working software that provides real value to users.