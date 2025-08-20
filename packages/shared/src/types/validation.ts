import { z } from 'zod';
import { FrameworkSchema } from './core';

// ESLint规则
export const ESLintRuleSchema = z.object({
  name: z.string(),
  severity: z.enum(['error', 'warn', 'off']),
  options: z.any().optional(),
  description: z.string().optional(),
});
export type ESLintRule = z.infer<typeof ESLintRuleSchema>;

// 测试规格
export const TestSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  framework: FrameworkSchema,
  code: z.string(),
  interactions: z.array(z.object({
    type: z.enum(['click', 'type', 'hover', 'scroll', 'wait']),
    selector: z.string(),
    value: z.string().optional(),
    timeout: z.number().optional(),
  })).optional(),
  assertions: z.array(z.object({
    type: z.enum(['visible', 'text', 'attribute', 'count', 'screenshot']),
    selector: z.string().optional(),
    expected: z.any(),
  })),
});
export type TestSpec = z.infer<typeof TestSpecSchema>;

// 渲染结果
export const RenderResultSchema = z.object({
  success: z.boolean(),
  html: z.string().optional(),
  screenshot: z.string().optional(), // base64 encoded
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  metadata: z.object({
    renderTime: z.number(),
    framework: FrameworkSchema,
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
  }),
});
export type RenderResult = z.infer<typeof RenderResultSchema>;

// 测试结果
export const TestResultSchema = z.object({
  success: z.boolean(),
  passed: z.number(),
  failed: z.number(),
  skipped: z.number(),
  duration: z.number(),
  results: z.array(z.object({
    name: z.string(),
    status: z.enum(['passed', 'failed', 'skipped']),
    error: z.string().optional(),
    screenshot: z.string().optional(),
    duration: z.number(),
  })),
  coverage: z.object({
    statements: z.number(),
    branches: z.number(),
    functions: z.number(),
    lines: z.number(),
  }).optional(),
});
export type TestResult = z.infer<typeof TestResultSchema>;

// 比较结果
export const ComparisonResultSchema = z.object({
  match: z.boolean(),
  difference: z.number().min(0).max(1),
  diffImage: z.string().optional(), // base64 encoded
  metadata: z.object({
    width: z.number(),
    height: z.number(),
    pixelDifference: z.number(),
    threshold: z.number(),
  }),
});
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;

// 修复结果
export const FixResultSchema = z.object({
  success: z.boolean(),
  fixedCode: z.string().optional(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  appliedFixes: z.array(z.object({
    rule: z.string(),
    description: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
  })),
});
export type FixResult = z.infer<typeof FixResultSchema>;

// 质量报告
export const QualityReportSchema = z.object({
  accuracy: z.object({
    componentExtraction: z.number().min(0).max(1),
    propExtraction: z.number().min(0).max(1),
    eventExtraction: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),
  compilation: z.object({
    react: z.number().min(0).max(1),
    vue: z.number().min(0).max(1),
    intact: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),
  visual: z.object({
    snapshotStability: z.number().min(0).max(1),
    regressionCount: z.number(),
  }),
  performance: z.object({
    avgGenerationTime: z.number(),
    avgValidationTime: z.number(),
    throughput: z.number(),
  }),
  generatedAt: z.string(),
});
export type QualityReport = z.infer<typeof QualityReportSchema>;