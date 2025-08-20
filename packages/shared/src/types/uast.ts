import { z } from 'zod';
import { FrameworkSchema, PropConstraintSchema } from './core';

// 约束定义
export const ConstraintSchema = z.object({
  type: z.enum(['prop_required', 'prop_enum', 'prop_pattern', 'child_allowed', 'child_forbidden', 'parent_required']),
  target: z.string(),
  value: z.any().optional(),
  message: z.string().optional(),
});
export type Constraint = z.infer<typeof ConstraintSchema>;

// UAST节点（递归定义）
export const UASTNodeSchema: z.ZodType<UASTNode> = z.lazy(() => z.object({
  type: z.string(),
  props: z.record(z.any()).optional(),
  children: z.array(UASTNodeSchema).optional(),
  metadata: z.object({
    componentName: z.string(),
    framework: FrameworkSchema,
    constraints: z.array(ConstraintSchema),
    sourceHint: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
}));

export type UASTNode = {
  type: string;
  props?: Record<string, any>;
  children?: UASTNode[];
  metadata: {
    componentName: string;
    framework: Framework;
    constraints: Constraint[];
    sourceHint?: string;
    confidence?: number;
  };
};

// UAST根节点
export const UASTSchema = UASTNodeSchema;
export type UAST = UASTNode;

// 需求解析结果
export const RequirementParseResultSchema = z.object({
  intent: z.string(),
  components: z.array(z.string()),
  layout: z.string().optional(),
  interactions: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});
export type RequirementParseResult = z.infer<typeof RequirementParseResultSchema>;

// 代码生成上下文
export const CodeGenerationContextSchema = z.object({
  framework: FrameworkSchema,
  uast: UASTSchema,
  manifest: z.any(), // ComponentManifest的引用
  options: z.object({
    typescript: z.boolean().default(true),
    cssModules: z.boolean().default(false),
    storybook: z.boolean().default(false),
    tests: z.boolean().default(false),
  }).optional(),
});
export type CodeGenerationContext = z.infer<typeof CodeGenerationContextSchema>;