import { ValidationResult, ValidationResultSchema } from '../types/core';

/**
 * 创建成功的验证结果
 */
export function createSuccessResult(metadata?: Record<string, any>): ValidationResult {
  return {
    success: true,
    errors: [],
    warnings: [],
    metadata,
  };
}

/**
 * 创建失败的验证结果
 */
export function createErrorResult(
  message: string,
  severity: 'error' | 'warning' | 'info' = 'error',
  metadata?: Record<string, any>
): ValidationResult {
  return {
    success: false,
    errors: [{
      message,
      severity,
    }],
    warnings: [],
    metadata,
  };
}

/**
 * 合并多个验证结果
 */
export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const merged: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
  };

  for (const result of results) {
    merged.errors.push(...result.errors);
    merged.warnings.push(...result.warnings);
    
    if (!result.success) {
      merged.success = false;
    }
  }

  return merged;
}

/**
 * 验证数据是否符合指定的schema
 */
export function validateWithSchema<T>(data: unknown, schema: any): ValidationResult & { data?: T } {
  try {
    const parsed = schema.parse(data);
    return {
      ...createSuccessResult(),
      data: parsed,
    };
  } catch (error: any) {
    return createErrorResult(
      error.message || 'Schema validation failed',
      'error',
      { zodError: error }
    );
  }
}