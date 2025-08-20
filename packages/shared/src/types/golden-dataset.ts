/**
 * Golden Dataset Types
 * 
 * Defines the structure for golden dataset used in testing and validation
 */

export interface GoldenDatasetEntry {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'intermediate' | 'advanced' | 'edge-case';
  framework: 'react' | 'vue' | 'intact' | 'multi-framework';
  requirement: RequirementSpec;
  expectedUAST: UASTNode;
  expectedCode: GeneratedCode;
  testCases: TestCase[];
  metadata: EntryMetadata;
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

export interface RequirementSpec {
  naturalLanguage: string;
  structuredRequirements: {
    components: ComponentRequirement[];
    layout: LayoutRequirement;
    interactions: InteractionRequirement[];
    styling: StylingRequirement;
    accessibility: AccessibilityRequirement;
    performance: PerformanceRequirement;
  };
  constraints: Constraint[];
  context: RequirementContext;
}

export interface ComponentRequirement {
  type: string;
  name?: string;
  props: PropRequirement[];
  children?: ComponentRequirement[];
  events?: EventRequirement[];
  validation?: ValidationRule[];
}

export interface PropRequirement {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  validation?: ValidationRule[];
  description?: string;
}

export interface EventRequirement {
  name: string;
  type: string;
  payload?: any;
  description?: string;
}

export interface LayoutRequirement {
  type: 'flex' | 'grid' | 'absolute' | 'flow';
  direction?: 'row' | 'column';
  alignment?: string;
  spacing?: string;
  responsive?: ResponsiveBreakpoint[];
}

export interface InteractionRequirement {
  type: 'click' | 'hover' | 'focus' | 'input' | 'submit' | 'navigation';
  trigger: string;
  action: string;
  target?: string;
  conditions?: string[];
}

export interface StylingRequirement {
  theme?: string;
  colors?: ColorScheme;
  typography?: TypographyScheme;
  spacing?: SpacingScheme;
  customStyles?: Record<string, any>;
}

export interface AccessibilityRequirement {
  level: 'AA' | 'AAA';
  features: AccessibilityFeature[];
  screenReaderSupport: boolean;
  keyboardNavigation: boolean;
  colorContrast: boolean;
}

export interface PerformanceRequirement {
  maxRenderTime: number;
  maxBundleSize: number;
  lazyLoading: boolean;
  caching: boolean;
}

export interface Constraint {
  type: 'component-whitelist' | 'prop-validation' | 'style-restriction' | 'performance-limit';
  description: string;
  rule: any;
}

export interface RequirementContext {
  userType: 'developer' | 'designer' | 'product-manager';
  experienceLevel: 'beginner' | 'intermediate' | 'expert';
  projectType: 'web-app' | 'mobile-app' | 'desktop-app' | 'component-library';
  designSystem?: string;
  existingCodebase?: boolean;
}

export interface UASTNode {
  type: 'component' | 'element' | 'text' | 'expression';
  name: string;
  props?: Record<string, any>;
  children?: UASTNode[];
  events?: Record<string, string>;
  metadata?: {
    framework: string;
    componentLibrary?: string;
    semanticRole?: string;
    accessibility?: AccessibilityMetadata;
  };
}

export interface GeneratedCode {
  react?: FrameworkCode;
  vue?: FrameworkCode;
  intact?: FrameworkCode;
}

export interface FrameworkCode {
  component: string;
  styles?: string;
  types?: string;
  tests?: string;
  stories?: string;
  documentation?: string;
}

export interface TestCase {
  id: string;
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'visual' | 'accessibility' | 'performance';
  description: string;
  setup?: string;
  steps: TestStep[];
  assertions: TestAssertion[];
  expectedResults: TestResult[];
  framework?: string;
}

export interface TestStep {
  action: string;
  target?: string;
  input?: any;
  wait?: number;
  description?: string;
}

export interface TestAssertion {
  type: 'exists' | 'visible' | 'text' | 'attribute' | 'style' | 'event' | 'accessibility';
  target: string;
  expected: any;
  description?: string;
}

export interface TestResult {
  type: 'render' | 'interaction' | 'validation' | 'performance' | 'accessibility';
  expected: any;
  tolerance?: number;
  description?: string;
}

export interface EntryMetadata {
  difficulty: number; // 1-10 scale
  estimatedTime: number; // minutes
  tags: string[];
  author: string;
  reviewers: string[];
  validationStatus: 'pending' | 'validated' | 'needs-review';
  usageCount: number;
  successRate: number;
  commonErrors: string[];
  relatedEntries: string[];
}

// Helper types
export interface ResponsiveBreakpoint {
  breakpoint: string;
  layout: Partial<LayoutRequirement>;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  error: string;
  warning: string;
  success: string;
}

export interface TypographyScheme {
  fontFamily: string;
  fontSize: Record<string, string>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, number>;
  letterSpacing: Record<string, string>;
}

export interface SpacingScheme {
  unit: string;
  scale: number[];
  semantic: Record<string, string>;
}

export interface AccessibilityFeature {
  type: 'aria-labels' | 'focus-management' | 'screen-reader' | 'keyboard-nav' | 'color-contrast';
  description: string;
  implementation: string;
}

export interface AccessibilityMetadata {
  role?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  tabIndex?: number;
  focusable?: boolean;
}

export interface ValidationRule {
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  rule: any;
  message: string;
}

// Dataset management types
export interface GoldenDataset {
  version: string;
  entries: GoldenDatasetEntry[];
  metadata: DatasetMetadata;
  statistics: DatasetStatistics;
}

export interface DatasetMetadata {
  name: string;
  description: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  authors: string[];
  license: string;
  tags: string[];
}

export interface DatasetStatistics {
  totalEntries: number;
  byCategory: Record<string, number>;
  byFramework: Record<string, number>;
  byDifficulty: Record<string, number>;
  averageSuccessRate: number;
  coverageMetrics: CoverageMetrics;
}

export interface CoverageMetrics {
  componentTypes: string[];
  interactionPatterns: string[];
  layoutTypes: string[];
  accessibilityFeatures: string[];
  performanceScenarios: string[];
}