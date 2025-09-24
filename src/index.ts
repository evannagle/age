#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('age')
  .description('A CLI for aging markdown documents')
  .version('0.1.0');

program
  .command('detect <file>')
  .description('Detect document type and show possible matches')
  .action((file: string) => {
    console.log(`Detecting type for: ${file}`);
    // TODO: Implement type detection
  });

program
  .argument('<file>', 'markdown file to age')
  .option('-b, --batch', 'process directory in batch mode')
  .option('-u, --undo', 'restore document from backup')
  .action((file: string, options) => {
    if (options.undo) {
      console.log(`Restoring: ${file}`);
      // TODO: Implement undo functionality
    } else if (options.batch) {
      console.log(`Processing directory: ${file}`);
      // TODO: Implement batch processing
    } else {
      console.log(`Aging document: ${file}`);
      // TODO: Implement aging functionality
    }
  });

program.parse();