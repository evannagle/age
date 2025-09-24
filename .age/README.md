# Age CLI Configuration

This directory contains Age CLI configuration for this project.

## Files

- `config.json` - Main configuration settings
- `document-types.json` - Document type processing rules
- `backups/` - Backup files created during aging process

## Configuration Hierarchy

Configuration is loaded in this order (later configs override earlier):
1. Built-in defaults
2. Global config (~/.age/config.json)
3. Vault config (parent .age/config.json)
4. Local config (this .age/config.json)

## Customization

Edit `config.json` to customize:
- AI provider settings
- Backup retention policies
- Processing preferences

Edit `document-types.json` to customize document type rules.
