import * as fs from 'fs';
import * as path from 'path';
import type { Link } from '../types/document.js';
import type { LinkChange } from '../types/changes.js';

export interface LinkVerificationResult {
  url: string;
  status: 'valid' | 'broken' | 'redirect' | 'timeout' | 'error' | 'unknown';
  statusCode?: number;
  redirectUrl?: string;
  responseTime?: number;
  error?: string;
}

export interface VaultLinkResult {
  link: string;
  status: 'valid' | 'broken' | 'ambiguous';
  resolvedPath?: string;
  alternatives?: string[];
}

export class LinkProcessor {
  private linkCache = new Map<string, LinkVerificationResult>();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  async planLinkChanges(
    links: Link[],
    documentPath: string,
    verifyExternal: boolean = true,
    verifyInternal: boolean = true
  ): Promise<LinkChange[]> {
    const changes: LinkChange[] = [];

    for (const link of links) {
      if (link.type === 'external' && verifyExternal && link.url) {
        const verification = await this.verifyExternalLink(link.url);

        if (verification.status === 'broken') {
          changes.push({
            type: 'remove',
            url: link.url,
            status: 'broken',
            reason: `External link is broken (${verification.statusCode || 'unreachable'})`
          });
        } else if (verification.status === 'redirect' && verification.redirectUrl) {
          changes.push({
            type: 'update',
            url: link.url,
            newUrl: verification.redirectUrl,
            status: 'redirect',
            reason: `External link redirects to ${verification.redirectUrl}`
          });
        } else {
          changes.push({
            type: 'verify',
            url: link.url,
            status: verification.status,
            reason: `External link verified (${verification.statusCode})`
          });
        }
      }

      if (link.type === 'internal' && verifyInternal && link.link) {
        const verification = await this.verifyVaultLink(link.link, documentPath);

        if (verification.status === 'broken') {
          changes.push({
            type: 'remove',
            link: link.link,
            status: 'broken',
            reason: 'Internal vault link target not found'
          });
        } else if (verification.status === 'ambiguous') {
          changes.push({
            type: 'verify',
            link: link.link,
            status: 'valid',
            reason: `Internal link found multiple matches: ${verification.alternatives?.join(', ')}`
          });
        } else {
          changes.push({
            type: 'verify',
            link: link.link,
            status: 'valid',
            reason: `Internal link verified: ${verification.resolvedPath}`
          });
        }
      }
    }

    return changes;
  }

  async verifyExternalLink(url: string): Promise<LinkVerificationResult> {
    // Check cache first
    const cached = this.linkCache.get(url);
    if (cached && Date.now() - (cached as any).timestamp < this.cacheExpiry) {
      return cached;
    }

    const startTime = Date.now();
    const result: LinkVerificationResult = {
      url,
      status: 'error',
      responseTime: 0
    };

    try {
      // Use fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD to avoid downloading full content
        signal: controller.signal,
        headers: {
          'User-Agent': 'Age CLI Link Checker/1.0'
        }
      });

      clearTimeout(timeoutId);
      result.responseTime = Date.now() - startTime;
      result.statusCode = response.status;

      if (response.status >= 200 && response.status < 300) {
        result.status = 'valid';
      } else if (response.status >= 300 && response.status < 400) {
        result.status = 'redirect';
        result.redirectUrl = response.headers.get('location') || undefined;
      } else if (response.status >= 400) {
        result.status = 'broken';
      } else {
        result.status = 'error';
        result.error = `Unexpected status code: ${response.status}`;
      }
    } catch (error: any) {
      result.responseTime = Date.now() - startTime;

      if (error.name === 'AbortError') {
        result.status = 'timeout';
        result.error = 'Request timed out after 10 seconds';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        result.status = 'broken';
        result.error = 'Host not found or connection refused';
      } else {
        result.status = 'error';
        result.error = error.message;
      }
    }

    // Cache result
    (result as any).timestamp = Date.now();
    this.linkCache.set(url, result);

    return result;
  }

  async verifyVaultLink(link: string, documentPath: string): Promise<VaultLinkResult> {
    // Parse Obsidian link format [[filename|display]] or [[filename]]
    const cleanLink = link.replace(/^\[\[|\]\]$/g, '');
    const [linkPath, displayText] = cleanLink.split('|');

    const result: VaultLinkResult = {
      link: cleanLink,
      status: 'broken'
    };

    // Find the vault root (directory containing documentPath)
    const vaultRoot = this.findVaultRoot(documentPath);
    if (!vaultRoot) {
      result.status = 'broken';
      return result;
    }

    // Search for matching files
    const matches = await this.findMatchingFiles(linkPath.trim(), vaultRoot);

    if (matches.length === 0) {
      result.status = 'broken';
    } else if (matches.length === 1) {
      result.status = 'valid';
      result.resolvedPath = matches[0];
    } else {
      result.status = 'ambiguous';
      result.resolvedPath = matches[0]; // Use first match as default
      result.alternatives = matches.slice(1);
    }

    return result;
  }

  private findVaultRoot(documentPath: string): string | null {
    let currentDir = path.dirname(path.resolve(documentPath));
    const homeDir = require('os').homedir();
    const startDir = currentDir;

    // Only search up 5 levels maximum to avoid scanning entire filesystem
    let levelsUp = 0;
    const maxLevels = 5;

    while (currentDir !== path.dirname(currentDir) && levelsUp < maxLevels) {
      // Stop if we've reached the home directory or root
      if (currentDir === homeDir || currentDir === '/') {
        break;
      }

      // Look for .obsidian directory (clear vault indicator)
      if (fs.existsSync(path.join(currentDir, '.obsidian'))) {
        return currentDir;
      }

      // Look for .age directory (our own indicator)
      if (fs.existsSync(path.join(currentDir, '.age'))) {
        return currentDir;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
      levelsUp++;
    }

    // Fallback to directory containing the document (safe default)
    return startDir;
  }

  private async findMatchingFiles(linkPath: string, vaultRoot: string): Promise<string[]> {
    const matches: string[] = [];

    // If link path includes extension or is a full path, search for exact matches
    if (linkPath.includes('.') || linkPath.includes('/')) {
      const fullPath = path.resolve(vaultRoot, linkPath);
      if (fs.existsSync(fullPath)) {
        matches.push(fullPath);
      }

      // Also try with .md extension
      if (!linkPath.endsWith('.md')) {
        const mdPath = path.resolve(vaultRoot, linkPath + '.md');
        if (fs.existsSync(mdPath)) {
          matches.push(mdPath);
        }
      }
    } else {
      // Search for files with matching basename
      const searchName = linkPath.toLowerCase();
      const allFiles = await this.getAllMarkdownFiles(vaultRoot);

      for (const filePath of allFiles) {
        const basename = path.basename(filePath, '.md').toLowerCase();
        if (basename === searchName) {
          matches.push(filePath);
        }
      }
    }

    return matches;
  }

  private async getAllMarkdownFiles(directory: string, maxDepth: number = 3, currentDepth: number = 0): Promise<string[]> {
    const files: string[] = [];

    // Safety check - don't recurse too deep or scan protected directories
    if (currentDepth > maxDepth) {
      return files;
    }

    const homeDir = require('os').homedir();
    if (directory.startsWith(path.join(homeDir, 'Library')) ||
        directory.startsWith('/System') ||
        directory.startsWith('/private')) {
      return files; // Skip system and library directories
    }

    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden directories and common system directories
        if (entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'Library' ||
            entry.name === 'System') {
          continue;
        }

        const fullPath = path.join(directory, entry.name);

        if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        } else if (entry.isDirectory()) {
          // Recursively search subdirectories with depth limit
          const subdirFiles = await this.getAllMarkdownFiles(fullPath, maxDepth, currentDepth + 1);
          files.push(...subdirFiles);
        }
      }
    } catch (error) {
      // Silently ignore permission errors - they're expected for protected directories
      // Only log if it's not a permission error
      if ((error as any).code !== 'EPERM' && (error as any).code !== 'EACCES') {
        console.warn(`Warning: Could not scan directory ${directory}: ${error}`);
      }
    }

    return files;
  }

  generateLinkReport(changes: LinkChange[]): string {
    const sections: string[] = [];

    const verifications = changes.filter(c => c.type === 'verify');
    const updates = changes.filter(c => c.type === 'update');
    const removals = changes.filter(c => c.type === 'remove');

    if (verifications.length > 0) {
      sections.push('Verified Links:');
      for (const change of verifications) {
        const target = change.url || change.link || 'unknown';
        sections.push(`  ✓ ${target} - ${change.reason}`);
      }
    }

    if (updates.length > 0) {
      sections.push('\nLink Updates:');
      for (const change of updates) {
        sections.push(`  → ${change.url} → ${change.newUrl}`);
        sections.push(`    Reason: ${change.reason}`);
      }
    }

    if (removals.length > 0) {
      sections.push('\nBroken Links (will be removed):');
      for (const change of removals) {
        const target = change.url || change.link || 'unknown';
        sections.push(`  ✗ ${target} - ${change.reason}`);
      }
    }

    return sections.join('\n');
  }

  clearLinkCache(): void {
    this.linkCache.clear();
  }

  getLinkCacheStats(): { size: number; oldestEntry?: string } {
    const now = Date.now();
    let oldestTimestamp = now;
    let oldestUrl = '';

    for (const [url, result] of this.linkCache.entries()) {
      const timestamp = (result as any).timestamp || now;
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
        oldestUrl = url;
      }
    }

    return {
      size: this.linkCache.size,
      oldestEntry: oldestUrl || undefined
    };
  }
}