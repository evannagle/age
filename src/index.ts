#!/usr/bin/env node

import { Command } from 'commander';
import { DetectCommand } from './commands/detect.js';
import { ConfigManager } from './config/hierarchy.js';

const program = new Command();

program
  .name('age')
  .description('A CLI for aging markdown documents')
  .version('0.1.0');

// Detect command
program
  .command('detect <file>')
  .description('Detect document type and show possible matches')
  .action(async (file: string) => {
    const detectCommand = new DetectCommand();
    await detectCommand.execute(file);
  });

// Config commands
const configCmd = program
  .command('config')
  .description('Manage Age CLI configuration');

configCmd
  .command('show')
  .description('Show current configuration hierarchy')
  .action(async () => {
    const configManager = ConfigManager.getInstance();
    const hierarchy = configManager.loadConfigHierarchy('.');

    console.log('Age Configuration (hierarchical):\n');

    if (hierarchy.global) {
      console.log('Global (~/.age/config.json):');
      console.log(JSON.stringify(hierarchy.global, null, 2));
      console.log();
    } else {
      console.log('Global (~/.age/config.json): (not found)\n');
    }

    if (hierarchy.vault) {
      console.log('Vault (.age/config.json):');
      console.log(JSON.stringify(hierarchy.vault, null, 2));
      console.log();
    } else {
      console.log('Vault (.age/config.json): (not found)\n');
    }

    if (hierarchy.local) {
      console.log('Local (.age/config.json):');
      console.log(JSON.stringify(hierarchy.local, null, 2));
      console.log();
    } else {
      console.log('Local (.age/config.json): (not found)\n');
    }

    console.log('Effective Configuration:');
    console.log(JSON.stringify(hierarchy.effective, null, 2));
  });

configCmd
  .command('init')
  .description('Initialize Age configuration in current directory')
  .action(async () => {
    const configManager = ConfigManager.getInstance();
    configManager.createLocalConfig('.');
  });

// Main aging command (placeholder)
program
  .argument('<file>', 'markdown file to age')
  .option('-b, --batch', 'process directory in batch mode')
  .option('-u, --undo', 'restore document from backup')
  .action((file: string, options) => {
    if (options.undo) {
      console.log(`Restoring: ${file}`);
      console.log('TODO: Implement undo functionality');
    } else if (options.batch) {
      console.log(`Processing directory: ${file}`);
      console.log('TODO: Implement batch processing');
    } else {
      console.log(`Aging document: ${file}`);
      console.log('TODO: Implement aging functionality');
    }
  });

program.parse();