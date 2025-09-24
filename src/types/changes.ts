export interface FrontmatterChange {
  type: 'add' | 'remove' | 'modify';
  field: string;
  oldValue?: any;
  newValue?: any;
  reason: string;
}

export interface ContentChange {
  type: 'summarize' | 'preserve' | 'modify';
  section: string;
  oldContent: string;
  newContent: string;
  reason: string;
}

export interface LinkChange {
  type: 'verify' | 'update' | 'remove';
  url?: string;
  link?: string;
  status?: 'valid' | 'broken' | 'redirect' | 'timeout' | 'error' | 'unknown';
  newUrl?: string;
  reason: string;
}

export interface ChangePlan {
  frontmatterChanges: FrontmatterChange[];
  contentChanges: ContentChange[];
  linkChanges: LinkChange[];
  metadata: ChangePlanMetadata;
}

export interface ChangePlanMetadata {
  originalSize: number;
  estimatedNewSize: number;
  sizeChangePercent: number;
  processingComplexity: 'simple' | 'moderate' | 'complex';
  requiresAI: boolean;
  estimatedTime: string;
}

export interface ProcessingContext {
  originalDocument: any;
  currentDocument: any;
  plan: ChangePlan;
  config: any;
  errors: string[];
  warnings: string[];
}