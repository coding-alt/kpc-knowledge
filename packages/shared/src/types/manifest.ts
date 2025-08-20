import { z } from 'zod';
import { PropDefinitionSchema, EventDefinitionSchema, SlotDefinitionSchema, StyleTokenSchema, SourceReferenceSchema, FrameworkSchema } from './core';

// 导入规格
export const ImportSpecSchema = z.object({
  module: z.string(),
  named: z.string(),
  default: z.boolean().default(false),
});
export type ImportSpec = z.infer<typeof ImportSpecSchema>;

// 属性映射
export const PropMappingSchema = z.object({
  name: z.string(),
  frameworkName: z.string().optional(),
  type: z.string(),
  transform: z.string().optional(),
});
export type PropMapping = z.infer<typeof PropMappingSchema>;

// 事件映射
export const EventMappingSchema = z.object({
  name: z.string(),
  frameworkName: z.string().optional(),
  type: z.string(),
  transform: z.string().optional(),
});
export type EventMapping = z.infer<typeof EventMappingSchema>;

// 插槽映射
export const SlotMappingSchema = z.object({
  name: z.string(),
  frameworkName: z.string().optional(),
  type: z.string().optional(),
});
export type SlotMapping = z.infer<typeof SlotMappingSchema>;

// 代码示例
export const CodeExampleSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  code: z.string(),
  framework: FrameworkSchema,
  category: z.string().optional(),
  sourceRef: SourceReferenceSchema.optional(),
});
export type CodeExample = z.infer<typeof CodeExampleSchema>;

// 框架绑定
export const FrameworkBindingSchema = z.object({
  framework: FrameworkSchema,
  import: ImportSpecSchema,
  props: z.array(PropMappingSchema),
  events: z.array(EventMappingSchema),
  slots: z.array(SlotMappingSchema),
  examples: z.array(CodeExampleSchema),
});
export type FrameworkBinding = z.infer<typeof FrameworkBindingSchema>;

// 组合规则
export const ComposabilityRuleSchema = z.object({
  type: z.enum(['allows_child', 'forbids_child', 'requires_parent', 'conflicts_with']),
  target: z.string(),
  condition: z.string().optional(),
  message: z.string().optional(),
});
export type ComposabilityRule = z.infer<typeof ComposabilityRuleSchema>;

// 反模式
export const AntiPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  badExample: z.string(),
  goodExample: z.string(),
  reason: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
});
export type AntiPattern = z.infer<typeof AntiPatternSchema>;

// 破坏性变更
export const BreakingChangeSchema = z.object({
  version: z.string(),
  description: z.string(),
  migration: z.string().optional(),
});
export type BreakingChange = z.infer<typeof BreakingChangeSchema>;

// 组件规格
export const ComponentSpecSchema = z.object({
  name: z.string(),
  alias: z.array(z.string()).optional(),
  import: ImportSpecSchema,
  category: z.string(),
  description: z.string(),
  frameworks: z.array(FrameworkBindingSchema),
  props: z.array(PropDefinitionSchema),
  events: z.array(EventDefinitionSchema),
  slots: z.array(SlotDefinitionSchema),
  styleTokens: z.array(StyleTokenSchema),
  composability: z.array(ComposabilityRuleSchema),
  antiPatterns: z.array(AntiPatternSchema),
  version: z.object({
    since: z.string(),
    deprecated: z.string().optional(),
    breaking: z.array(BreakingChangeSchema).optional(),
  }),
  sourceRefs: z.array(SourceReferenceSchema),
});
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;

// 使用模式
export const UsagePatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  components: z.array(z.string()),
  template: z.string(),
  examples: z.array(CodeExampleSchema),
  bestPractices: z.array(z.string()),
});
export type UsagePattern = z.infer<typeof UsagePatternSchema>;

// 组件清单
export const ComponentManifestSchema = z.object({
  library: z.string(),
  version: z.string(),
  components: z.array(ComponentSpecSchema),
  patterns: z.array(UsagePatternSchema),
  antiPatterns: z.array(AntiPatternSchema),
  metadata: z.object({
    generatedAt: z.string(),
    sourceCommit: z.string().optional(),
    confidence: z.number().min(0).max(1),
  }),
});
export type ComponentManifest = z.infer<typeof ComponentManifestSchema>;