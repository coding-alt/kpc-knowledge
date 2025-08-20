import { Field, ObjectType, InputType, ID, Int, Float, registerEnumType } from 'type-graphql';
import { Framework } from '@kpc/shared';

// 注册枚举类型
registerEnumType(Framework, {
  name: 'Framework',
  description: 'Supported frontend frameworks',
});

// 基础类型
@ObjectType()
export class SourceReference {
  @Field()
  filePath: string;

  @Field(() => Int)
  startLine: number;

  @Field(() => Int)
  endLine: number;

  @Field({ nullable: true })
  url?: string;

  @Field({ nullable: true })
  commit?: string;
}

@ObjectType()
export class PropConstraint {
  @Field()
  type: string;

  @Field()
  value: string;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class PropDefinition {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  type: string;

  @Field()
  required: boolean;

  @Field({ nullable: true })
  default?: string;

  @Field(() => [String], { nullable: true })
  enum?: string[];

  @Field(() => [PropConstraint], { nullable: true })
  constraints?: PropConstraint[];

  @Field()
  deprecated: boolean;

  @Field({ nullable: true })
  docs?: string;

  @Field(() => SourceReference)
  sourceRef: SourceReference;
}

@ObjectType()
export class EventDefinition {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  type: string;

  @Field({ nullable: true })
  payload?: string;

  @Field({ nullable: true })
  docs?: string;

  @Field()
  deprecated: boolean;

  @Field(() => SourceReference)
  sourceRef: SourceReference;
}

@ObjectType()
export class SlotDefinition {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  type?: string;

  @Field(() => [PropDefinition], { nullable: true })
  props?: PropDefinition[];

  @Field({ nullable: true })
  docs?: string;

  @Field()
  deprecated: boolean;

  @Field(() => SourceReference)
  sourceRef: SourceReference;
}

@ObjectType()
export class StyleToken {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  value: string;

  @Field()
  category: string;

  @Field({ nullable: true })
  docs?: string;

  @Field(() => SourceReference)
  sourceRef: SourceReference;
}

@ObjectType()
export class ComponentDefinition {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => Framework)
  framework: Framework;

  @Field(() => [PropDefinition])
  props: PropDefinition[];

  @Field(() => [EventDefinition])
  events: EventDefinition[];

  @Field(() => [SlotDefinition])
  slots: SlotDefinition[];

  @Field(() => [StyleToken])
  styleTokens: StyleToken[];

  @Field(() => [SourceReference])
  sourceRefs: SourceReference[];

  @Field({ nullable: true })
  docs?: string;

  @Field({ nullable: true })
  category?: string;

  @Field()
  deprecated: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class ImportSpec {
  @Field()
  module: string;

  @Field()
  named: string;

  @Field()
  default: boolean;
}

@ObjectType()
export class CodeExample {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  code: string;

  @Field(() => Framework)
  framework: Framework;

  @Field({ nullable: true })
  category?: string;

  @Field(() => SourceReference, { nullable: true })
  sourceRef?: SourceReference;
}

@ObjectType()
export class FrameworkBinding {
  @Field(() => Framework)
  framework: Framework;

  @Field(() => ImportSpec)
  import: ImportSpec;

  @Field(() => [PropDefinition])
  props: PropDefinition[];

  @Field(() => [EventDefinition])
  events: EventDefinition[];

  @Field(() => [SlotDefinition])
  slots: SlotDefinition[];

  @Field(() => [CodeExample])
  examples: CodeExample[];
}

@ObjectType()
export class ComposabilityRule {
  @Field()
  type: string;

  @Field()
  target: string;

  @Field({ nullable: true })
  condition?: string;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class AntiPattern {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field()
  badExample: string;

  @Field()
  goodExample: string;

  @Field()
  reason: string;

  @Field()
  severity: string;
}

@ObjectType()
export class BreakingChange {
  @Field()
  version: string;

  @Field()
  description: string;

  @Field({ nullable: true })
  migration?: string;
}

@ObjectType()
export class ComponentVersion {
  @Field()
  since: string;

  @Field({ nullable: true })
  deprecated?: string;

  @Field(() => [BreakingChange], { nullable: true })
  breaking?: BreakingChange[];
}

@ObjectType()
export class ComponentSpec {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => [String], { nullable: true })
  alias?: string[];

  @Field(() => ImportSpec)
  import: ImportSpec;

  @Field()
  category: string;

  @Field()
  description: string;

  @Field(() => [FrameworkBinding])
  frameworks: FrameworkBinding[];

  @Field(() => [PropDefinition])
  props: PropDefinition[];

  @Field(() => [EventDefinition])
  events: EventDefinition[];

  @Field(() => [SlotDefinition])
  slots: SlotDefinition[];

  @Field(() => [StyleToken])
  styleTokens: StyleToken[];

  @Field(() => [ComposabilityRule])
  composability: ComposabilityRule[];

  @Field(() => [AntiPattern])
  antiPatterns: AntiPattern[];

  @Field(() => ComponentVersion)
  version: ComponentVersion;

  @Field(() => [SourceReference])
  sourceRefs: SourceReference[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class UsagePattern {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => [String])
  components: string[];

  @Field()
  template: string;

  @Field(() => [CodeExample])
  examples: CodeExample[];

  @Field(() => [String])
  bestPractices: string[];
}

@ObjectType()
export class ComponentManifest {
  @Field(() => ID)
  id: string;

  @Field()
  library: string;

  @Field()
  version: string;

  @Field(() => [ComponentSpec])
  components: ComponentSpec[];

  @Field(() => [UsagePattern])
  patterns: UsagePattern[];

  @Field(() => [AntiPattern])
  antiPatterns: AntiPattern[];

  @Field(() => ManifestMetadata)
  metadata: ManifestMetadata;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class ManifestMetadata {
  @Field()
  generatedAt: string;

  @Field({ nullable: true })
  sourceCommit?: string;

  @Field(() => Float)
  confidence: number;
}

// 搜索结果类型
@ObjectType()
export class SearchResult {
  @Field()
  content: string;

  @Field(() => Float)
  score: number;

  @Field(() => SearchMetadata)
  metadata: SearchMetadata;
}

@ObjectType()
export class SearchMetadata {
  @Field({ nullable: true })
  componentName?: string;

  @Field(() => Framework, { nullable: true })
  framework?: Framework;

  @Field(() => SourceReference)
  sourceRef: SourceReference;

  @Field()
  type: string;
}

// 知识图谱类型
@ObjectType()
export class GraphNode {
  @Field(() => ID)
  id: string;

  @Field()
  type: string;

  @Field()
  properties: string; // JSON string

  @Field(() => [String], { nullable: true })
  labels?: string[];
}

@ObjectType()
export class GraphRelationship {
  @Field(() => ID)
  id: string;

  @Field()
  type: string;

  @Field(() => ID)
  startNode: string;

  @Field(() => ID)
  endNode: string;

  @Field({ nullable: true })
  properties?: string; // JSON string
}

@ObjectType()
export class GraphResult {
  @Field(() => [GraphNode])
  nodes: GraphNode[];

  @Field(() => [GraphRelationship])
  relationships: GraphRelationship[];

  @Field(() => GraphMetadata, { nullable: true })
  metadata?: GraphMetadata;
}

@ObjectType()
export class GraphMetadata {
  @Field(() => Float)
  executionTime: number;

  @Field(() => Int)
  resultCount: number;
}

// 输入类型
@InputType()
export class ComponentFilter {
  @Field({ nullable: true })
  name?: string;

  @Field(() => Framework, { nullable: true })
  framework?: Framework;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  deprecated?: boolean;
}

@InputType()
export class SearchFilter {
  @Field(() => Framework, { nullable: true })
  framework?: Framework;

  @Field({ nullable: true })
  componentName?: string;

  @Field({ nullable: true })
  category?: string;

  @Field(() => Float, { nullable: true })
  minScore?: number;

  @Field(() => Int, { nullable: true })
  limit?: number;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 0 })
  offset: number;

  @Field(() => Int, { defaultValue: 20 })
  limit: number;
}

@InputType()
export class SortInput {
  @Field()
  field: string;

  @Field({ defaultValue: 'ASC' })
  direction: 'ASC' | 'DESC';
}

// 分页结果类型
@ObjectType()
export class PaginatedComponents {
  @Field(() => [ComponentSpec])
  items: ComponentSpec[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  offset: number;

  @Field(() => Int)
  limit: number;

  @Field()
  hasMore: boolean;
}

@ObjectType()
export class PaginatedSearchResults {
  @Field(() => [SearchResult])
  items: SearchResult[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  offset: number;

  @Field(() => Int)
  limit: number;

  @Field()
  hasMore: boolean;
}

// 订阅相关类型
@ObjectType()
export class ComponentUpdateNotification {
  @Field(() => ID)
  componentId: string;

  @Field()
  componentName: string;

  @Field()
  updateType: string; // 'created' | 'updated' | 'deleted' | 'deprecated'

  @Field(() => ComponentSpec, { nullable: true })
  component?: ComponentSpec;

  @Field(() => Date)
  timestamp: Date;

  @Field({ nullable: true })
  reason?: string;

  @Field(() => [String], { nullable: true })
  changedFields?: string[];
}

@ObjectType()
export class ManifestUpdateNotification {
  @Field(() => ID)
  manifestId: string;

  @Field()
  library: string;

  @Field()
  version: string;

  @Field()
  updateType: string; // 'updated' | 'rebuilt'

  @Field(() => Date)
  timestamp: Date;

  @Field(() => Int)
  componentsAffected: number;

  @Field(() => [String], { nullable: true })
  changedComponents?: string[];
}

@ObjectType()
export class SystemStatusNotification {
  @Field()
  service: string; // 'crawler' | 'parser' | 'knowledge' | 'api'

  @Field()
  status: string; // 'healthy' | 'warning' | 'error' | 'maintenance'

  @Field()
  message: string;

  @Field(() => Date)
  timestamp: Date;

  @Field({ nullable: true })
  details?: string;
}

@ObjectType()
export class CacheStats {
  @Field()
  hitRate: number;

  @Field(() => Int)
  totalHits: number;

  @Field(() => Int)
  totalMisses: number;

  @Field(() => Int)
  totalKeys: number;

  @Field(() => Float)
  memoryUsage: number; // MB

  @Field(() => Date)
  lastUpdated: Date;
}

// 订阅输入类型
@InputType()
export class ComponentSubscriptionFilter {
  @Field(() => [String], { nullable: true })
  componentNames?: string[];

  @Field(() => [Framework], { nullable: true })
  frameworks?: Framework[];

  @Field(() => [String], { nullable: true })
  categories?: string[];

  @Field(() => [String], { nullable: true })
  updateTypes?: string[];
}

@InputType()
export class SystemSubscriptionFilter {
  @Field(() => [String], { nullable: true })
  services?: string[];

  @Field(() => [String], { nullable: true })
  statuses?: string[];
}