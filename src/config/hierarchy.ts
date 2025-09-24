import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AgeConfig, ConfigHierarchy } from '../types/config.js';
import { DEFAULT_CONFIG } from './defaults.js';

export class ConfigManager {
  private static instance: ConfigManager;

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  loadConfigHierarchy(filePath: string): ConfigHierarchy {
    const hierarchy: ConfigHierarchy = {
      effective: { ...DEFAULT_CONFIG },
    };

    // Load global config
    const globalConfigPath = path.join(os.homedir(), '.age', 'config.json');
    if (fs.existsSync(globalConfigPath)) {
      try {
        hierarchy.global = this.loadConfigFile(globalConfigPath);
        this.mergeConfig(hierarchy.effective, hierarchy.global);
      } catch (error) {
        console.warn(`Warning: Failed to load global config: ${error}`);
      }
    }

    // Load vault config (walk up directory tree looking for .age folder)
    const vaultConfigPath = this.findVaultConfig(filePath);
    if (vaultConfigPath) {
      try {
        hierarchy.vault = this.loadConfigFile(vaultConfigPath);
        this.mergeConfig(hierarchy.effective, hierarchy.vault);
      } catch (error) {
        console.warn(`Warning: Failed to load vault config: ${error}`);
      }
    }

    // Load local config
    const localConfigPath = this.findLocalConfig(filePath);
    if (localConfigPath) {
      try {
        hierarchy.local = this.loadConfigFile(localConfigPath);
        this.mergeConfig(hierarchy.effective, hierarchy.local);
      } catch (error) {
        console.warn(`Warning: Failed to load local config: ${error}`);
      }
    }

    return hierarchy;
  }

  private loadConfigFile(configPath: string): AgeConfig {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  }

  private findVaultConfig(filePath: string): string | null {
    let currentDir = path.dirname(path.resolve(filePath));
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const ageDir = path.join(currentDir, '.age');
      const configFile = path.join(ageDir, 'config.json');

      if (fs.existsSync(configFile)) {
        return configFile;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }

    return null;
  }

  private findLocalConfig(filePath: string): string | null {
    const dir = path.dirname(path.resolve(filePath));
    const configFile = path.join(dir, '.age', 'config.json');

    return fs.existsSync(configFile) ? configFile : null;
  }

  private mergeConfig(target: AgeConfig, source: AgeConfig): void {
    // Deep merge configuration objects
    if (source.ai) {
      target.ai = { ...target.ai, ...source.ai };
    }

    if (source.backup) {
      target.backup = { ...target.backup, ...source.backup };
    }

    if (source.processing) {
      target.processing = { ...target.processing, ...source.processing };
    }

    if (source.documentTypes) {
      if (!target.documentTypes) {
        target.documentTypes = {};
      }

      for (const [typeName, typeConfig] of Object.entries(source.documentTypes)) {
        if (target.documentTypes[typeName]) {
          // Merge document type configurations
          const existing = target.documentTypes[typeName];
          target.documentTypes[typeName] = {
            frontmatter: {
              keep: [...new Set([...existing.frontmatter.keep, ...typeConfig.frontmatter.keep])],
              remove: [...new Set([...existing.frontmatter.remove, ...typeConfig.frontmatter.remove])],
              add: { ...existing.frontmatter.add, ...typeConfig.frontmatter.add },
              modify: { ...existing.frontmatter.modify, ...typeConfig.frontmatter.modify },
            },
            content: { ...existing.content, ...typeConfig.content },
          };
        } else {
          target.documentTypes[typeName] = typeConfig;
        }
      }
    }
  }

  createLocalConfig(directory: string): void {
    const ageDir = path.join(directory, '.age');
    const configFile = path.join(ageDir, 'config.json');
    const typesFile = path.join(ageDir, 'document-types.json');
    const readmeFile = path.join(ageDir, 'README.md');
    const backupsDir = path.join(ageDir, 'backups');

    // Create .age directory
    fs.mkdirSync(ageDir, { recursive: true });
    fs.mkdirSync(backupsDir, { recursive: true });

    // Create basic config.json
    const basicConfig: AgeConfig = {
      processing: {
        interactive: true,
      },
    };

    fs.writeFileSync(configFile, JSON.stringify(basicConfig, null, 2));

    // Create document-types.json with PARA defaults
    const documentTypes = DEFAULT_CONFIG.documentTypes;
    fs.writeFileSync(typesFile, JSON.stringify({ documentTypes }, null, 2));

    // Create README.md
    const readme = `# Age CLI Configuration

This directory contains Age CLI configuration for this project.

## Files

- \`config.json\` - Main configuration settings
- \`document-types.json\` - Document type processing rules
- \`backups/\` - Backup files created during aging process

## Configuration Hierarchy

Configuration is loaded in this order (later configs override earlier):
1. Built-in defaults
2. Global config (~/.age/config.json)
3. Vault config (parent .age/config.json)
4. Local config (this .age/config.json)

## Customization

Edit \`config.json\` to customize:
- AI provider settings
- Backup retention policies
- Processing preferences

Edit \`document-types.json\` to customize document type rules.
`;

    fs.writeFileSync(readmeFile, readme);

    console.log('✓ Created .age/ directory');
    console.log('✓ Created .age/config.json with defaults');
    console.log('✓ Created .age/document-types.json with PARA types');
    console.log('✓ Created .age/README.md');
    console.log('\nConfiguration initialized. Edit .age/config.json to customize.');
  }

  validateConfig(config: AgeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate AI config
    if (config.ai) {
      const validProviders = ['openai', 'anthropic', 'none'];
      if (config.ai.provider && !validProviders.includes(config.ai.provider)) {
        errors.push(`Invalid AI provider: ${config.ai.provider}. Must be one of: ${validProviders.join(', ')}`);
      }
    }

    // Validate backup config
    if (config.backup) {
      if (config.backup.retention && !this.isValidDuration(config.backup.retention)) {
        errors.push(`Invalid backup retention: ${config.backup.retention}. Use format like '30d', '7d'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isValidDuration(duration: string): boolean {
    return /^\d+[dwhm]$/.test(duration);
  }
}