import type { AgeConfig } from '../types/config.js';

export const DEFAULT_CONFIG: AgeConfig = {
  ai: {
    provider: 'none',
  },
  backup: {
    retention: '30d',
    compress: false,
    maxSize: '100MB',
  },
  processing: {
    interactive: true,
    batchSize: 10,
    parallel: false,
  },
  documentTypes: {
    'meeting-notes': {
      frontmatter: {
        keep: ['date', 'attendees', 'project', 'tags'],
        remove: ['author', 'status', 'draft'],
        add: {
          aged_date: '{{current_date}}',
          summary_length: 'short',
        },
      },
      content: {
        summarize: false, // Requires AI provider
        preserve: ['action-items', 'decisions'],
        urlProcessing: true,
        linkVerification: true,
      },
    },
    'research': {
      frontmatter: {
        keep: ['source', 'methodology', 'tags', 'references'],
        remove: ['author', 'status', 'draft'],
        add: {
          aged_date: '{{current_date}}',
          key_findings: '{{extract_key_findings}}',
        },
      },
      content: {
        summarize: false,
        preserve: ['methodology', 'findings', 'conclusions'],
        urlProcessing: true,
        linkVerification: true,
      },
    },
    'project-work': {
      frontmatter: {
        keep: ['project', 'priority', 'due_date', 'tags'],
        remove: ['status', 'draft'],
        add: {
          aged_date: '{{current_date}}',
          completion_status: '{{calculate_completion}}',
        },
      },
      content: {
        summarize: false,
        preserve: ['requirements', 'blockers', 'progress'],
        urlProcessing: false,
        linkVerification: true,
      },
    },
    'personal-notes': {
      frontmatter: {
        keep: ['date', 'tags', 'mood'],
        remove: ['author', 'draft'],
        add: {
          aged_date: '{{current_date}}',
          reflection_type: '{{detect_reflection_type}}',
        },
      },
      content: {
        summarize: false,
        preserve: ['insights', 'ideas'],
        urlProcessing: false,
        linkVerification: false,
      },
    },
  },
};