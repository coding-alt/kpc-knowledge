export interface ComponentInfo {
  id?: string;
  name: string;
  alias?: string[];
  framework: string;
  category?: string;
  description?: string;
  import?: ImportInfo;
  props?: PropInfo[];
  events?: EventInfo[];
  slots?: SlotInfo[];
  examples?: ExampleInfo[];
  styleTokens?: StyleTokenInfo[];
  composability?: ComposabilityRule[];
  antiPatterns?: AntiPatternInfo[];
  version?: VersionInfo;
  sourceRefs?: SourceReference[];
  docs?: string;
  score?: number;
  sourceRef?: SourceReference;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportInfo {
  module: string;
  named: string;
  default: boolean;
}

export interface PropInfo {
  id?: string;
  name: string;
  type: string;
  required: boolean;
  default?: string;
  enum?: string[];
  constraints?: ConstraintInfo[];
  deprecated: boolean;
  docs?: string;
  description?: string;
}

export interface EventInfo {
  id?: string;
  name: string;
  type?: string;
  payload?: string;
  docs?: string;
  description?: string;
  deprecated: boolean;
}

export interface SlotInfo {
  id?: string;
  name: string;
  type?: string;
  props?: PropInfo[];
  docs?: string;
  description?: string;
  deprecated: boolean;
}

export interface ExampleInfo {
  id?: string;
  title: string;
  description?: string;
  code: string;
  framework: string;
  category?: string;
}

export interface StyleTokenInfo {
  id?: string;
  name: string;
  value: string;
  category: string;
  docs?: string;
}

export interface ComposabilityRule {
  type: string;
  target: string;
  condition?: string;
  message?: string;
}

export interface AntiPatternInfo {
  id?: string;
  name: string;
  description: string;
  badExample: string;
  goodExample: string;
  reason: string;
  severity: string;
}

export interface VersionInfo {
  since: string;
  deprecated?: string;
  breaking?: BreakingChangeInfo[];
}

export interface BreakingChangeInfo {
  version: string;
  description: string;
  migration?: string;
}

export interface ConstraintInfo {
  type: string;
  value: string;
  message?: string;
}

export interface SourceReference {
  filePath: string;
  startLine?: number;
  endLine?: number;
  url?: string;
  commit?: string;
}

export interface SearchOptions {
  framework?: string;
  componentName?: string;
  category?: string;
  minScore?: number;
  limit?: number;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationIssue {
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule: string;
  fixable: boolean;
}

export interface ValidationSuggestion {
  line: number;
  column: number;
  message: string;
  fix: string;
}

export interface GenerationOptions {
  framework?: string;
  typescript?: boolean;
  includeTests?: boolean;
  includeStories?: boolean;
  includeTypes?: boolean;
  outputDir?: string;
}

export interface GenerationResult {
  component: string;
  tests?: string;
  stories?: string;
  types?: string;
  metadata: GenerationMetadata;
}

export interface GenerationMetadata {
  componentName: string;
  framework: string;
  confidence: number;
  generatedAt: string;
}

export interface ComponentTreeItem {
  id: string;
  name: string;
  framework: string;
  category?: string;
  description?: string;
  children?: ComponentTreeItem[];
  collapsibleState?: number;
  iconPath?: string;
  command?: {
    command: string;
    title: string;
    arguments?: any[];
  };
}

export interface DiagnosticInfo {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source: string;
  code?: string;
  relatedInformation?: {
    location: {
      uri: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    };
    message: string;
  }[];
}

export interface CodeActionInfo {
  title: string;
  kind: string;
  isPreferred?: boolean;
  edit?: {
    changes: {
      [uri: string]: {
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        newText: string;
      }[];
    };
  };
  command?: {
    command: string;
    title: string;
    arguments?: any[];
  };
}

export interface TelemetryEvent {
  name: string;
  properties?: { [key: string]: string | number | boolean };
  measurements?: { [key: string]: number };
}

export interface PreviewOptions {
  port?: number;
  host?: string;
  theme?: 'light' | 'dark' | 'auto';
  responsive?: boolean;
  hotReload?: boolean;
}

export interface SnippetInfo {
  name: string;
  prefix: string;
  body: string[];
  description: string;
  scope?: string;
}