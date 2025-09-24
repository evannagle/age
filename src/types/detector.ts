import type { ParsedDocument, TypeScore, DetectionResult } from './document.js';
import type { AgeConfig } from './config.js';

interface ScoreResult {
  score: number;
  reasons: string[];
  warnings?: string[];
}

export class DocumentTypeDetector {
  private config: AgeConfig;

  constructor(config: AgeConfig) {
    this.config = config;
  }

  detectDocumentType(document: ParsedDocument): DetectionResult {
    const documentTypes = Object.keys(this.config.documentTypes || {});
    const scores: TypeScore[] = [];

    for (const typeName of documentTypes) {
      const typeConfig = this.config.documentTypes![typeName];
      let totalScore = 0;
      const allReasons: string[] = [];
      const allWarnings: string[] = [];

      // Frontmatter scoring (40% weight)
      const frontmatterResult = this.scoreFrontmatter(document, typeName, typeConfig);
      totalScore += frontmatterResult.score * 0.4;
      allReasons.push(...frontmatterResult.reasons);
      if (frontmatterResult.warnings) {
        allWarnings.push(...frontmatterResult.warnings);
      }

      // Content pattern scoring (40% weight)
      const contentResult = this.scoreContentPatterns(document, typeName);
      totalScore += contentResult.score * 0.4;
      allReasons.push(...contentResult.reasons);

      // File path scoring (20% weight)
      const pathResult = this.scoreFilePath(document, typeName);
      totalScore += pathResult.score * 0.2;
      allReasons.push(...pathResult.reasons);

      scores.push({
        type: typeName,
        confidence: Math.min(totalScore, 1.0),
        reasons: allReasons.filter(reason => reason.length > 0),
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
      });
    }

    // Sort by confidence (highest first)
    scores.sort((a, b) => b.confidence - a.confidence);

    return {
      primaryType: scores[0]?.type || 'unknown',
      allScores: scores,
      recommendations: this.generateRecommendations(document, scores),
    };
  }

  private scoreFrontmatter(
    document: ParsedDocument,
    typeName: string,
    typeConfig: any
  ): ScoreResult {
    const result: ScoreResult = { score: 0, reasons: [], warnings: [] };
    const frontmatter = document.frontmatter;
    const rules = typeConfig.frontmatter;

    if (!rules) return result;

    let matches = 0;
    let total = 0;

    // Check for required/kept fields
    if (rules.keep) {
      for (const field of rules.keep) {
        total++;
        if (frontmatter[field] !== undefined) {
          matches++;
          result.reasons.push(`Contains: ${field}`);

          // Special validation for certain fields
          if (field === 'date' && this.isValidDate(frontmatter[field])) {
            result.reasons.push('Date format valid');
          } else if (field === 'attendees' && Array.isArray(frontmatter[field])) {
            result.reasons.push(`${frontmatter[field].length} attendees listed`);
          } else if (field === 'tags' && Array.isArray(frontmatter[field])) {
            result.reasons.push(`${frontmatter[field].length} tags`);
          }
        }
      }
    }

    // Check for fields that should be removed (penalties)
    if (rules.remove) {
      for (const field of rules.remove) {
        if (frontmatter[field] !== undefined) {
          result.warnings!.push(`Contains '${field}' field (usually removed for this type)`);
        }
      }
    }

    // Calculate score based on field matches
    if (total > 0) {
      result.score = matches / total;
    }

    // Bonus points for having many relevant fields
    if (matches >= 3) {
      result.score *= 1.2; // 20% bonus
      result.reasons.push('Rich frontmatter structure');
    }

    return result;
  }

  private scoreContentPatterns(document: ParsedDocument, typeName: string): ScoreResult {
    const result: ScoreResult = { score: 0, reasons: [] };
    const structure = document.structure;
    const content = document.content.toLowerCase();

    switch (typeName) {
      case 'meeting-notes':
        return this.scoreMeetingNotesPatterns(structure, content, result);
      case 'research':
        return this.scoreResearchPatterns(structure, content, result);
      case 'project-work':
        return this.scoreProjectWorkPatterns(structure, content, result);
      case 'personal-notes':
        return this.scorePersonalNotesPatterns(structure, content, result);
      default:
        return result;
    }
  }

  private scoreMeetingNotesPatterns(structure: any, content: string, result: ScoreResult): ScoreResult {
    let score = 0;

    // Check for meeting-specific headers
    const meetingHeaders = /agenda|discussion|action.?items|notes|attendees|decisions/i;
    const matchingHeaders = structure.headers.filter((h: any) => meetingHeaders.test(h.text));
    if (matchingHeaders.length > 0) {
      score += 0.3;
      result.reasons.push(`Meeting headers: ${matchingHeaders.map((h: any) => h.text).join(', ')}`);
    }

    // Action items are strong indicators
    if (structure.actionItems.length > 0) {
      score += 0.4;
      result.reasons.push(`${structure.actionItems.length} action items found`);
    }

    // Meeting-specific language patterns
    const meetingWords = /discussed|decided|agreed|meeting|agenda|follow.?up/gi;
    const matches = content.match(meetingWords);
    if (matches && matches.length > 2) {
      score += 0.2;
      result.reasons.push('Meeting language patterns');
    }

    // Time references
    if (/\d{1,2}:\d{2}|am|pm|morning|afternoon/i.test(content)) {
      score += 0.1;
      result.reasons.push('Time references found');
    }

    result.score = Math.min(score, 1.0);
    return result;
  }

  private scoreResearchPatterns(structure: any, content: string, result: ScoreResult): ScoreResult {
    let score = 0;

    // Research-specific headers
    const researchHeaders = /methodology|findings|conclusion|results|analysis|summary|abstract/i;
    const matchingHeaders = structure.headers.filter((h: any) => researchHeaders.test(h.text));
    if (matchingHeaders.length > 0) {
      score += 0.3;
      result.reasons.push(`Research headers: ${matchingHeaders.map((h: any) => h.text).join(', ')}`);
    }

    // External links/references (strong indicator)
    const externalLinks = structure.links.filter((l: any) => l.type === 'external').length;
    if (externalLinks > 0) {
      score += 0.4;
      result.reasons.push(`${externalLinks} external references`);
    }

    // Academic/research language
    const researchWords = /study|research|analysis|methodology|findings|hypothesis|evidence|data/gi;
    const matches = content.match(researchWords);
    if (matches && matches.length > 3) {
      score += 0.2;
      result.reasons.push('Research terminology');
    }

    // Citations or formal references
    if (/\[\d+\]|\(.*\d{4}.*\)|doi:|arxiv:/i.test(content)) {
      score += 0.1;
      result.reasons.push('Citations/references found');
    }

    result.score = Math.min(score, 1.0);
    return result;
  }

  private scoreProjectWorkPatterns(structure: any, content: string, result: ScoreResult): ScoreResult {
    let score = 0;

    // Project-specific headers
    const projectHeaders = /requirements|implementation|plan|progress|blockers|tasks|todo/i;
    const matchingHeaders = structure.headers.filter((h: any) => projectHeaders.test(h.text));
    if (matchingHeaders.length > 0) {
      score += 0.3;
      result.reasons.push(`Project headers: ${matchingHeaders.map((h: any) => h.text).join(', ')}`);
    }

    // Code blocks indicate technical work
    if (structure.codeBlocks.length > 0) {
      score += 0.3;
      result.reasons.push(`${structure.codeBlocks.length} code blocks`);
    }

    // Task/project language
    const projectWords = /task|project|implement|develop|build|feature|requirement|deadline/gi;
    const matches = content.match(projectWords);
    if (matches && matches.length > 2) {
      score += 0.2;
      result.reasons.push('Project terminology');
    }

    // Progress indicators
    if (/progress|status|completed?|in.?progress|todo|done/gi.test(content)) {
      score += 0.2;
      result.reasons.push('Progress indicators');
    }

    result.score = Math.min(score, 1.0);
    return result;
  }

  private scorePersonalNotesPatterns(structure: any, content: string, result: ScoreResult): ScoreResult {
    let score = 0;

    // Personal language patterns
    const personalWords = /i think|i feel|my|personally|reflection|thoughts|ideas/gi;
    const matches = content.match(personalWords);
    if (matches && matches.length > 2) {
      score += 0.4;
      result.reasons.push('First-person language');
    }

    // Emotional or reflective content
    if (/feel|emotion|reflect|wonder|hope|wish|dream/gi.test(content)) {
      score += 0.3;
      result.reasons.push('Reflective/emotional content');
    }

    // Informal tone indicators
    if (/really|actually|basically|honestly|whatever|anyway/gi.test(content)) {
      score += 0.2;
      result.reasons.push('Informal tone');
    }

    // Random thoughts structure
    const randomHeaders = /random|thoughts|ideas|misc|various/i;
    const matchingHeaders = structure.headers.filter((h: any) => randomHeaders.test(h.text));
    if (matchingHeaders.length > 0) {
      score += 0.1;
      result.reasons.push('Personal note structure');
    }

    result.score = Math.min(score, 1.0);
    return result;
  }

  private scoreFilePath(document: ParsedDocument, typeName: string): ScoreResult {
    const result: ScoreResult = { score: 0, reasons: [] };
    const filePath = document.filePath.toLowerCase();
    const fileName = require('path').basename(filePath).toLowerCase();

    const pathPatterns: Record<string, RegExp[]> = {
      'meeting-notes': [/meeting/, /notes/, /agenda/],
      'research': [/research/, /papers?/, /studies/, /analysis/],
      'project-work': [/projects?/, /tasks?/, /work/, /dev/],
      'personal-notes': [/personal/, /journal/, /diary/, /thoughts/],
    };

    const patterns = pathPatterns[typeName] || [];
    for (const pattern of patterns) {
      if (pattern.test(filePath) || pattern.test(fileName)) {
        result.score = 0.8;
        result.reasons.push(`File path matches ${typeName} pattern`);
        break;
      }
    }

    return result;
  }

  private generateRecommendations(document: ParsedDocument, scores: TypeScore[]): string[] {
    const recommendations: string[] = [];
    const primaryType = scores[0];
    const frontmatter = document.frontmatter;

    if (!primaryType || primaryType.confidence < 0.5) {
      recommendations.push('Low confidence in type detection - consider adding more specific frontmatter');
    }

    // Check for common problematic fields
    const problematicFields = ['author', 'status', 'draft'];
    const foundProblematic = problematicFields.filter(field => frontmatter[field] !== undefined);
    if (foundProblematic.length > 0) {
      recommendations.push(`Consider removing temporary fields: ${foundProblematic.join(', ')}`);
    }

    // Check for missing recommended fields based on primary type
    if (primaryType?.type === 'meeting-notes') {
      if (!frontmatter.date) recommendations.push('Add date field for meeting context');
      if (!frontmatter.attendees) recommendations.push('Add attendees field for reference');
    } else if (primaryType?.type === 'research') {
      if (!frontmatter.source) recommendations.push('Add source field for citation');
      if (!frontmatter.methodology) recommendations.push('Add methodology field for context');
    } else if (primaryType?.type === 'project-work') {
      if (!frontmatter.project) recommendations.push('Add project field for categorization');
      if (!frontmatter.priority) recommendations.push('Add priority field for task management');
    }

    // Check document structure
    if (document.structure.actionItems.length > 5) {
      recommendations.push('Many action items found - consider breaking into separate documents');
    }

    if (document.structure.links.filter(l => l.type === 'external').length > 10) {
      recommendations.push('Many external links - aging process will verify and potentially summarize these');
    }

    return recommendations;
  }

  private isValidDate(value: any): boolean {
    if (typeof value === 'string') {
      // Check for ISO date format (YYYY-MM-DD)
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
    }
    return false;
  }
}