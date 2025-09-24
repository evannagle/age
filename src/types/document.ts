export interface Header {
  level: number;
  text: string;
  line: number;
}

export interface Link {
  type: 'external' | 'internal';
  url?: string;
  link?: string;
  text: string;
  line: number;
}

export interface CodeBlock {
  language?: string;
  content: string;
  line: number;
}

export interface ListItem {
  type: 'ordered' | 'unordered';
  text: string;
  children?: ListItem[];
  line: number;
}

export interface ActionItem {
  text: string;
  completed: boolean;
  assignee?: string;
  line: number;
}

export interface ContentStructure {
  headers: Header[];
  links: Link[];
  codeBlocks: CodeBlock[];
  lists: ListItem[];
  actionItems: ActionItem[];
  wordCount: number;
  lineCount: number;
}

export interface FileMetadata {
  size: number;
  lastModified: Date;
  encoding: string;
  extension: string;
}

export interface ParsedDocument {
  filePath: string;
  frontmatter: Record<string, any>;
  frontmatterRaw: string;
  content: string;
  structure: ContentStructure;
  metadata: FileMetadata;
}

export interface TypeScore {
  type: string;
  confidence: number;
  reasons: string[];
  warnings?: string[];
}

export interface DetectionResult {
  primaryType: string;
  allScores: TypeScore[];
  recommendations: string[];
}