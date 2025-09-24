# Age CLI

A TypeScript CLI application that helps remove cruft from markdown documents and keeps only the most pertinent information for longer-term local storage.

## Overview

Age transforms your markdown documents through different lifecycle stages:
- **Young** → **Juvenile** → **Mature**

Each stage focuses on different aspects of document curation, from cleaning up messy notes to distilling essential reference information.

## Features

- 🧠 AI-powered content summarization
- 🎯 Interactive approval workflow
- 🔗 Cross-document relationship analysis
- ⚙️ Configurable document type processing
- 📁 Hierarchical configuration system
- 🔄 Safe backup and undo operations

## Quick Start

```bash
# Install dependencies
npm install

# Detect document type
age detect document.md

# Age a document with interactive approval
age document.md

# Process a directory
age --batch notes/

# Restore a document
age --undo document.md
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive documentation including:
- Architecture overview
- Configuration system
- Document type rules
- AI integration strategy
- Development guidelines

## Development

```bash
# Development mode
npm run dev

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## License

MIT