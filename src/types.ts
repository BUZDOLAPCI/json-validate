import type { ErrorObject } from 'ajv';

/**
 * Standard response envelope for all tool responses
 */
export interface ResponseEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ResponseError;
  meta: ResponseMeta;
}

export interface ResponseError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'INTERNAL_ERROR';

export interface ResponseMeta {
  source?: string;
  retrieved_at: string;
  pagination?: {
    next_cursor: string | null;
  };
  warnings?: string[];
}

/**
 * Validation result data
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  keyword: string;
  message: string;
  params: Record<string, unknown>;
  schemaPath: string;
}

/**
 * Explanation result data
 */
export interface ExplanationResult {
  explanations: ErrorExplanation[];
}

export interface ErrorExplanation {
  path: string;
  error: string;
  explanation: string;
  suggestion: string;
}

/**
 * Repair result data
 */
export interface RepairResult {
  repaired: unknown;
  changes: RepairChange[];
  parseErrors?: string[];
}

export interface RepairChange {
  path: string;
  action: 'removed' | 'added' | 'coerced' | 'defaulted' | 'fixed';
  from?: unknown;
  to?: unknown;
  reason: string;
}

/**
 * Tool input types
 */
export interface ValidateJsonInput {
  schema: Record<string, unknown>;
  instance: unknown;
}

export interface ExplainValidationInput {
  errors: ValidationError[] | ErrorObject[];
}

export interface RepairJsonInput {
  schema: Record<string, unknown>;
  instance_or_text: unknown;
}


/**
 * Helper function to create success response
 */
export function createSuccessResponse<T>(
  data: T,
  options?: { source?: string; warnings?: string[] }
): ResponseEnvelope<T> {
  return {
    ok: true,
    data,
    meta: {
      source: options?.source,
      retrieved_at: new Date().toISOString(),
      pagination: { next_cursor: null },
      warnings: options?.warnings ?? []
    }
  };
}

/**
 * Helper function to create error response
 */
export function createErrorResponse<T = never>(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ResponseEnvelope<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      details
    },
    meta: {
      retrieved_at: new Date().toISOString()
    }
  };
}
