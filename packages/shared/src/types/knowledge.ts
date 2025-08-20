import { z } from 'zod';
import { SourceReferenceSchema, FrameworkSchema } from './core';

// 文档源
export const DocumentSourceSchema = z.object({
  url: z.string(),
  title: z.string(),
  content: z.string(),
  codeBlocks: z.array(z.object({
    language: z.string(),
    code: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
  })),
  lastModified: z.string(), // ISO date string
  sourceRef: SourceReferenceSchema.optional(),
});
export type DocumentSource = z.infer<typeof DocumentSourceSchema>;

// 组件源码
export const ComponentSourceSchema = z.object({
  filePath: z.string(),
  framework: FrameworkSchema,
  content: z.string(),
  lastModified: z.string(),
  dependencies: z.array(z.string()).optional(),
  exports: z.array(z.string()).optional(),
});
export type ComponentSource = z.infer<typeof ComponentSourceSchema>;

// 仓库快照
export const RepoSnapshotSchema = z.object({
  commit: z.string(),
  timestamp: z.string(),
  components: z.array(ComponentSourceSchema),
  docs: z.array(DocumentSourceSchema),
  metadata: z.object({
    branch: z.string(),
    author: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
});
export type RepoSnapshot = z.infer<typeof RepoSnapshotSchema>;

// 搜索过滤器
export const SearchFilterSchema = z.object({
  framework: FrameworkSchema.optional(),
  componentName: z.string().optional(),
  category: z.string().optional(),
  minScore: z.number().min(0).max(1).optional(),
  limit: z.number().positive().optional(),
});
export type SearchFilter = z.infer<typeof SearchFilterSchema>;

// 搜索结果
export const SearchResultSchema = z.object({
  content: z.string(),
  score: z.number().min(0).max(1),
  metadata: z.object({
    componentName: z.string().optional(),
    framework: FrameworkSchema.optional(),
    sourceRef: SourceReferenceSchema,
    type: z.enum(['documentation', 'code_example', 'component_definition']),
  }),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

// 知识图谱节点
export const GraphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['Component', 'Prop', 'Event', 'Slot', 'StyleToken', 'Pattern']),
  properties: z.record(z.any()),
  labels: z.array(z.string()).optional(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

// 知识图谱关系
export const GraphRelationshipSchema = z.object({
  id: z.string(),
  type: z.string(),
  startNode: z.string(),
  endNode: z.string(),
  properties: z.record(z.any()).optional(),
});
export type GraphRelationship = z.infer<typeof GraphRelationshipSchema>;

// 图谱查询结果
export const GraphResultSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  relationships: z.array(GraphRelationshipSchema),
  metadata: z.object({
    executionTime: z.number(),
    resultCount: z.number(),
  }).optional(),
});
export type GraphResult = z.infer<typeof GraphResultSchema>;