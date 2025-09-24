import type { ParsedDocument } from '../types/document.js';
import type { FrontmatterRules } from '../types/config.js';
import type { FrontmatterChange } from '../types/changes.js';

export class FrontmatterProcessor {
  private templateFunctions: Record<string, (doc: ParsedDocument) => string>;

  constructor() {
    this.templateFunctions = {
      current_date: () => new Date().toISOString().split('T')[0],
      current_datetime: () => new Date().toISOString(),
      aged_date: () => new Date().toISOString().split('T')[0],
      file_size: (doc: ParsedDocument) => String(doc.metadata.size),
      word_count: (doc: ParsedDocument) => String(doc.structure.wordCount),
      next_review: () => {
        const date = new Date();
        date.setDate(date.getDate() + 60);
        return date.toISOString().split('T')[0];
      },
      summary_length: (doc: ParsedDocument) => {
        const wordCount = doc.structure.wordCount;
        if (wordCount < 100) return 'very_short';
        if (wordCount < 300) return 'short';
        if (wordCount < 800) return 'medium';
        return 'long';
      }
    };
  }

  planFrontmatterChanges(
    document: ParsedDocument,
    rules: FrontmatterRules,
    documentType: string
  ): FrontmatterChange[] {
    const changes: FrontmatterChange[] = [];
    const currentFrontmatter = { ...document.frontmatter };

    // Plan removals
    for (const field of rules.remove || []) {
      if (currentFrontmatter[field] !== undefined) {
        changes.push({
          type: 'remove',
          field,
          oldValue: currentFrontmatter[field],
          reason: `Document type '${documentType}' removes '${field}' field`
        });
      }
    }

    // Plan additions
    for (const [field, template] of Object.entries(rules.add || {})) {
      if (currentFrontmatter[field] === undefined) {
        const newValue = this.processTemplate(template, document);
        changes.push({
          type: 'add',
          field,
          newValue,
          reason: `Document type '${documentType}' adds '${field}' field`
        });
      }
    }

    // Plan modifications
    for (const [field, modRule] of Object.entries(rules.modify || {})) {
      if (currentFrontmatter[field] !== undefined) {
        const newValue = this.applyModification(currentFrontmatter[field], modRule);
        if (newValue !== currentFrontmatter[field]) {
          changes.push({
            type: 'modify',
            field,
            oldValue: currentFrontmatter[field],
            newValue,
            reason: `Document type '${documentType}' modifies '${field}' field`
          });
        }
      }
    }

    return changes;
  }

  applyFrontmatterChanges(
    frontmatter: Record<string, any>,
    changes: FrontmatterChange[]
  ): Record<string, any> {
    const result = { ...frontmatter };

    for (const change of changes) {
      switch (change.type) {
        case 'remove':
          delete result[change.field];
          break;
        case 'add':
        case 'modify':
          result[change.field] = change.newValue;
          break;
      }
    }

    return result;
  }

  private processTemplate(template: string | Function, document: ParsedDocument): any {
    if (typeof template === 'function') {
      return template(document);
    }

    if (typeof template !== 'string') {
      return template;
    }

    // Process template strings like "{{current_date}}"
    return template.replace(/\{\{(\w+)\}\}/g, (match, funcName) => {
      const templateFunc = this.templateFunctions[funcName];
      if (templateFunc) {
        try {
          return templateFunc(document);
        } catch (error) {
          console.warn(`Warning: Template function '${funcName}' failed: ${error}`);
          return match; // Return original if function fails
        }
      }
      console.warn(`Warning: Unknown template function '${funcName}'`);
      return match; // Return original if function not found
    });
  }

  private applyModification(currentValue: any, modRule: any): any {
    if (!modRule || typeof modRule !== 'object') {
      return currentValue;
    }

    const { type, value } = modRule;

    switch (type) {
      case 'append':
        if (Array.isArray(currentValue)) {
          const valuesToAdd = Array.isArray(value) ? value : [value];
          return [...currentValue, ...valuesToAdd];
        } else if (typeof currentValue === 'string') {
          return currentValue + String(value);
        }
        break;

      case 'prepend':
        if (Array.isArray(currentValue)) {
          const valuesToAdd = Array.isArray(value) ? value : [value];
          return [...valuesToAdd, ...currentValue];
        } else if (typeof currentValue === 'string') {
          return String(value) + currentValue;
        }
        break;

      case 'replace':
        return value;

      default:
        console.warn(`Warning: Unknown modification type '${type}'`);
        return currentValue;
    }

    return currentValue;
  }

  validateFrontmatter(frontmatter: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate date fields
    for (const [field, value] of Object.entries(frontmatter)) {
      if (field.includes('date') && typeof value === 'string') {
        if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
          errors.push(`Field '${field}' should be in YYYY-MM-DD format`);
        }
      }

      // Validate array fields
      if (field === 'tags' || field === 'attendees') {
        if (value !== undefined && !Array.isArray(value)) {
          errors.push(`Field '${field}' should be an array`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  generateFrontmatterDiff(changes: FrontmatterChange[]): string {
    const lines: string[] = [];

    for (const change of changes) {
      switch (change.type) {
        case 'add':
          lines.push(`+ ${change.field}: ${this.formatValue(change.newValue)}`);
          break;
        case 'remove':
          lines.push(`- ${change.field}: ${this.formatValue(change.oldValue)}`);
          break;
        case 'modify':
          lines.push(`~ ${change.field}: ${this.formatValue(change.oldValue)} → ${this.formatValue(change.newValue)}`);
          break;
      }
    }

    return lines.join('\n');
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return `[${value.join(', ')}]`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'string' && value.includes(' ')) {
      return `"${value}"`;
    }
    return String(value);
  }
}