# Age CLI - Document Aging System

## Project Overview

Age is a TypeScript CLI application that helps remove cruft from markdown documents and keeps only the most pertinent information for longer-term local storage. It's designed to work with Obsidian vaults, transforming documents through different lifecycle stages while preserving important cross-document relationships.

## Core Philosophy

Documents have lifecycle stages that require different types of curation:
- **Young**: Messy, multiple trajectories, false starts → Clean up and organize
- **Juvenile**: Task-focused, plan of execution → Optimize for execution
- **Mature**: Reference/snippet, routine or inspiration → Distill to essential, reusable information

## Key Features

### Document Transformation Pipeline
- **Frontmatter Management**: Remove unused fields, add/modify based on document type
- **AI-Powered Summarization**: Distill content while preserving unique insights and style
- **URL Processing**: Fetch and summarize external links for offline reference
- **Link Hygiene**: Prune dead/broken Obsidian links
- **Filename Optimization**: Generate succinct, descriptive names
- **Document Relocation**: Move aged documents to appropriate archive/folder locations

### Interactive Approval System
- Show before/after changes with clear diffs
- **Yes/Accept** or **No/Reprompt** workflow
- Learning system captures successful patterns to improve future aging
- Granular approval for different types of changes

### Configuration System
- **Hierarchical Configuration**: `.age/` folders work like `.git` (local overrides global)
- **Global**: `~/.age/` for user-wide settings
- **Vault-level**: `.age/` in vault root for vault-specific rules
- **Project-specific**: `.age/` in subdirectories for specialized processing
- **Document Type Rules**: Configurable frontmatter and content processing rules

### Document Type System
Uses PARA methodology with support for:
- art, drawing, family, fitness, guitar, health, home, software, woodworking, writing
- Frontmatter-based type detection
- Custom type definitions and processing rules
- Type-specific aging strategies

### Performance & Intelligence
- **Smart Processing**: Track last aging via frontmatter timestamps
- **Cross-Document Analysis**: Understanding of document relationships via links
- **Vault Health**: Identify orphaned documents, duplicated content
- **Backup System**: Store undo data in `.age/` directories with cleanup intervals

## CLI Commands

```bash
# Core commands
age detect <file>           # Show document type matches
age <file>                 # Age document with interactive approval
age --batch <directory>    # Process directory with automation
age --undo <file>          # Restore from backup

# Configuration
age config --global        # Edit global configuration
age config --local         # Edit local .age/ configuration
age config --show          # Show current configuration hierarchy

# Utilities
age status                 # Show vault health and aging statistics
age clean                  # Clean old backups from .age/ directories
```

## AI Integration Strategy

### Provider Configuration
- **Configurable Providers**: Support for OpenAI, Anthropic, local models
- **API Key Management**: Environment variables with config fallbacks
- **Rate Limiting**: Built-in throttling and retry logic
- **Fallback Modes**: Graceful degradation when AI services are unavailable

### Summarization Intelligence
- **Style Preservation**: Learn from existing vault content to maintain consistency
- **Content Analysis**: Focus on unique insights, remove unnecessary fluff
- **Context Awareness**: Understand document type and purpose for appropriate summarization
- **Iterative Improvement**: Learn from user feedback to refine summarization quality

## Technical Architecture

### Project Structure
```
age/
├── src/
│   ├── commands/          # CLI command handlers
│   │   ├── detect.ts      # Document type detection
│   │   ├── age.ts         # Main aging command
│   │   ├── undo.ts        # Restore functionality
│   │   └── config.ts      # Configuration management
│   ├── filters/           # Document processing pipeline
│   │   ├── frontmatter.ts # Frontmatter cleanup/modification
│   │   ├── content.ts     # Content summarization
│   │   ├── links.ts       # Link processing and cleanup
│   │   └── urls.ts        # External URL summarization
│   ├── types/             # Document type system
│   │   ├── detector.ts    # Type detection logic
│   │   ├── rules.ts       # Type-specific processing rules
│   │   └── definitions.ts # Document type definitions
│   ├── config/            # Configuration management
│   │   ├── hierarchy.ts   # .age/ folder resolution
│   │   ├── schema.ts      # Configuration validation
│   │   └── defaults.ts    # Default configurations
│   ├── ai/                # AI integration
│   │   ├── providers/     # Different AI service providers
│   │   ├── summarize.ts   # Content summarization
│   │   └── learn.ts       # Pattern learning from feedback
│   ├── interactive/       # User interaction system
│   │   ├── approval.ts    # Change approval workflow
│   │   ├── diff.ts        # Before/after comparison
│   │   └── feedback.ts    # Learning from user decisions
│   ├── utils/             # Utilities
│   │   ├── markdown.ts    # Markdown/Obsidian parsing
│   │   ├── files.ts       # File operations
│   │   ├── backup.ts      # Backup/restore system
│   │   └── vault.ts       # Vault analysis and health
│   └── index.ts           # CLI entry point
├── .age/                  # Local configuration
└── package.json
```

### Key Dependencies
- **CLI Framework**: Commander.js for robust argument parsing
- **Markdown Processing**: Unified/remark ecosystem for Obsidian-aware parsing
- **AI Integration**: Multiple provider support (OpenAI, Anthropic)
- **Interactive UI**: Inquirer for clean CLI interactions
- **Configuration**: JSON schema validation for type safety

## Development Guidelines

### Code Quality
- **TypeScript**: Strict mode enabled, comprehensive type definitions
- **Testing**: Jest for unit and integration testing
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier for consistent code style
- **Git Integration**: Respect .gitignore, create meaningful commits

### CLI Design Principles
- **Clean Interface**: Minimal/no icons, content over noise
- **Informative Errors**: Clear error messages that guide user actions
- **Performance**: Efficient processing of large vaults (10-20k documents)
- **Reliability**: Safe file operations with comprehensive backup system

### Configuration Examples

#### Global Configuration (`~/.age/config.json`)
```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "${OPENAI_API_KEY}"
  },
  "backup": {
    "retention": "30d",
    "compress": true
  },
  "processing": {
    "batchSize": 10,
    "interactive": true
  }
}
```

#### Document Type Rules (`.age/types.json`)
```json
{
  "meeting-notes": {
    "frontmatter": {
      "keep": ["date", "attendees", "project"],
      "remove": ["author", "created_by"],
      "add": ["archived_date", "summary_length"]
    },
    "content": {
      "summarize": true,
      "preserveActionItems": true,
      "removePersonalNotes": false
    }
  },
  "research": {
    "frontmatter": {
      "keep": ["source", "methodology", "tags"],
      "remove": ["draft", "status"],
      "add": ["aged_date", "key_findings"]
    },
    "content": {
      "summarize": true,
      "preserveSources": true,
      "extractKeyInsights": true
    }
  }
}
```

## Success Metrics

### User Experience
- **Approval Rate**: Percentage of AI-suggested changes accepted by user
- **Time Savings**: Reduction in manual document curation time
- **Vault Health**: Improvement in link health, reduced duplicates
- **Learning Effectiveness**: Improvement in AI suggestions over time

### Technical Performance
- **Processing Speed**: Documents processed per minute
- **Accuracy**: Correct document type detection rate
- **Reliability**: Successful backup/restore operations
- **Scalability**: Performance with large vaults (20k+ documents)

## Roadmap

### Phase 1: Foundation (MVP)
- Core CLI structure and commands
- Basic document type detection
- Simple frontmatter processing
- Interactive approval system

### Phase 2: Intelligence
- AI integration for content summarization
- Learning system for pattern recognition
- Advanced document type rules
- Cross-document relationship analysis

### Phase 3: Optimization
- Performance improvements for large vaults
- Advanced configuration options
- Batch processing optimizations
- Comprehensive testing suite

### Phase 4: Extension
- Obsidian plugin integration
- Additional AI providers
- Custom filter development API
- Community configuration sharing

## Contributing

### Development Setup
```bash
git clone https://github.com/evannagle/age
cd age
npm install
npm run dev
```

### Testing
```bash
npm test                   # Run test suite
npm run lint              # Check code quality
npm run build             # Build for production
```

### Architecture Decisions
- **Modular Design**: Filters and processors are composable and extensible
- **Configuration-Driven**: Behavior controlled through hierarchical config files
- **AI-Agnostic**: Support multiple AI providers through plugin system
- **Obsidian-Friendly**: Preserve vault structure and linking systems