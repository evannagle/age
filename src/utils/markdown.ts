import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Node } from 'unist';
import type {
  ParsedDocument,
  ContentStructure,
  FileMetadata,
  Header,
  Link,
  CodeBlock,
  ActionItem
} from '../types/document.js';

interface MarkdownNode extends Node {
  type: string;
  depth?: number;
  value?: string;
  children?: MarkdownNode[];
  url?: string;
  title?: string;
  lang?: string;
  meta?: string;
  checked?: boolean | null;
}

export class MarkdownParser {
  async parseDocument(filePath: string): Promise<ParsedDocument> {
    // Validate file
    this.validateFile(filePath);

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse frontmatter
    const matterResult = matter(content);

    // Parse markdown content
    const structure = await this.parseContent(matterResult.content);

    // Get file metadata
    const metadata = this.getFileMetadata(filePath);

    return {
      filePath: path.resolve(filePath),
      frontmatter: matterResult.data,
      frontmatterRaw: matterResult.matter,
      content: matterResult.content,
      structure,
      metadata,
    };
  }

  private validateFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File '${filePath}' not found`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.md' && ext !== '.markdown') {
      throw new Error(`File must have .md or .markdown extension, got '${ext}'`);
    }

    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Permission denied reading '${filePath}'`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size > 10 * 1024 * 1024) { // 10MB
      console.warn(`Warning: File is ${(stats.size / 1024 / 1024).toFixed(1)}MB, processing may be slow`);
    }
  }

  private async parseContent(content: string): Promise<ContentStructure> {
    const structure: ContentStructure = {
      headers: [],
      links: [],
      codeBlocks: [],
      lists: [],
      actionItems: [],
      wordCount: this.countWords(content),
      lineCount: content.split('\n').length,
    };

    // Parse markdown AST
    const processor = unified().use(remarkParse);
    const tree = processor.parse(content);

    // Extract content structure
    visit(tree, (node: any, index, parent) => {
      const line = this.getLineNumber(content, node);

      switch (node.type) {
        case 'heading':
          if (node.children && node.depth) {
            const text = this.extractTextFromChildren(node.children);
            structure.headers.push({
              level: node.depth,
              text,
              line,
            });
          }
          break;

        case 'link':
          if (node.url && node.children) {
            const text = this.extractTextFromChildren(node.children);
            structure.links.push({
              type: 'external',
              url: node.url,
              text,
              line,
            });
          }
          break;

        case 'code':
          if (node.lang && node.value) {
            structure.codeBlocks.push({
              language: node.lang,
              content: node.value,
              line,
            });
          }
          break;

        case 'listItem':
          if (node.children) {
            const text = this.extractTextFromChildren(node.children);

            // Check if it's an action item
            if (typeof node.checked === 'boolean') {
              const actionItem: ActionItem = {
                text: text.replace(/^\[[ x]\]\s*/, ''), // Remove checkbox syntax
                completed: node.checked,
                line,
              };

              // Try to extract assignee (simple pattern: "Name:")
              const assigneeMatch = actionItem.text.match(/^([A-Za-z]+):\s*(.+)/);
              if (assigneeMatch) {
                actionItem.assignee = assigneeMatch[1];
                actionItem.text = assigneeMatch[2];
              }

              structure.actionItems.push(actionItem);
            }
          }
          break;
      }
    });

    // Parse Obsidian internal links [[link]]
    this.parseObsidianLinks(content, structure);

    return structure;
  }

  private parseObsidianLinks(content: string, structure: ContentStructure): void {
    const lines = content.split('\n');
    const linkPattern = /\[\[([^\]]+)\]\]/g;

    lines.forEach((line, index) => {
      let match;
      while ((match = linkPattern.exec(line)) !== null) {
        const linkText = match[1];
        const displayText = linkText.includes('|')
          ? linkText.split('|')[1]
          : linkText;

        structure.links.push({
          type: 'internal',
          link: linkText,
          text: displayText,
          line: index + 1,
        });
      }
      // Reset lastIndex for global regex
      linkPattern.lastIndex = 0;
    });
  }

  private extractTextFromChildren(children: MarkdownNode[]): string {
    return children
      .map(child => child.value || (child.children ? this.extractTextFromChildren(child.children) : ''))
      .join('');
  }

  private getLineNumber(content: string, node: any): number {
    // This is a simplified line number calculation
    // In practice, you might want to use the position information from the AST
    if (node.position && node.position.start) {
      return node.position.start.line;
    }
    return 1;
  }

  private countWords(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  private getFileMetadata(filePath: string): FileMetadata {
    const stats = fs.statSync(filePath);

    return {
      size: stats.size,
      lastModified: stats.mtime,
      encoding: 'utf8',
      extension: path.extname(filePath),
    };
  }
}