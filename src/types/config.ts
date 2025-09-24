export interface AgeConfig {
  ai?: AIConfig;
  backup?: BackupConfig;
  processing?: ProcessingConfig;
  documentTypes?: Record<string, DocumentTypeConfig>;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'none';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface BackupConfig {
  retention: string; // e.g., '30d', '7d'
  compress?: boolean;
  maxSize?: string; // e.g., '100MB'
}

export interface ProcessingConfig {
  interactive: boolean;
  batchSize?: number;
  parallel?: boolean;
}

export interface DocumentTypeConfig {
  frontmatter: FrontmatterRules;
  content: ContentRules;
}

export interface FrontmatterRules {
  keep: string[];
  remove: string[];
  add: Record<string, string | TemplateFunction>;
  modify?: Record<string, ModificationRule>;
}

export interface ContentRules {
  summarize: boolean;
  preserve?: string[];
  urlProcessing?: boolean;
  linkVerification?: boolean;
}

export interface ModificationRule {
  type: 'append' | 'prepend' | 'replace';
  value: string | string[];
}

export type TemplateFunction = (doc: any) => string;

export interface ConfigHierarchy {
  global?: AgeConfig;
  vault?: AgeConfig;
  local?: AgeConfig;
  effective: AgeConfig;
}