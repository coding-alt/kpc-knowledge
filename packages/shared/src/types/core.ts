import { z } from 'zod';

// 框架类型
export const FrameworkSchema = z.enum(['react', 'vue', 'intact']);
export type Framework = z.infer<typeof FrameworkSchema>;

// 源码引用
export const SourceReferenceSchema = z.object({
  filePath: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  url: z.string().optional(),
  commit: z.string().optional(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

// 验证结果
export const ValidationResultSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
    line: z.number().optional(),
    column: z.number().optional(),
    rule: z.string().optional(),
  })),
  warnings: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// 属性约束
export const PropConstraintSchema = z.object({
  type: z.enum(['required', 'enum', 'pattern', 'range', 'custom']),
  value: z.any(),
  message: z.string().optional(),
});
export type PropConstraint = z.infer<typeof PropConstraintSchema>;

// 属性定义
export const PropDefinitionSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().default(false),
  default: z.any().optional(),
  enum: z.array(z.string()).optional(),
  constraints: z.array(PropConstraintSchema).optional(),
  deprecated: z.boolean().default(false),
  docs: z.string().optional(),
  sourceRef: SourceReferenceSchema,
});
export type PropDefinition = z.infer<typeof PropDefinitionSchema>;

// 事件定义
export const EventDefinitionSchema = z.object({
  name: z.string(),
  type: z.string(),
  payload: z.string().optional(),
  docs: z.string().optional(),
  deprecated: z.boolean().default(false),
  sourceRef: SourceReferenceSchema,
});
export type EventDefinition = z.infer<typeof EventDefinitionSchema>;

// 插槽定义
export const SlotDefinitionSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  props: z.array(PropDefinitionSchema).optional(),
  docs: z.string().optional(),
  deprecated: z.boolean().default(false),
  sourceRef: SourceReferenceSchema,
});
export type SlotDefinition = z.infer<typeof SlotDefinitionSchema>;

// 样式Token定义
export const StyleTokenSchema = z.object({
  name: z.string(),
  value: z.string(),
  category: z.string(),
  docs: z.string().optional(),
  sourceRef: SourceReferenceSchema,
});
export type StyleToken = z.infer<typeof StyleTokenSchema>;

// 组件定义
export const ComponentDefinitionSchema = z.object({
  name: z.string(),
  framework: FrameworkSchema,
  props: z.array(PropDefinitionSchema),
  events: z.array(EventDefinitionSchema),
  slots: z.array(SlotDefinitionSchema),
  styleTokens: z.array(StyleTokenSchema),
  sourceRefs: z.array(SourceReferenceSchema),
  docs: z.string().optional(),
  category: z.string().optional(),
  deprecated: z.boolean().default(false),
});
export type ComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;