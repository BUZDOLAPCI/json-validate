import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import {
  createSuccessResponse,
  createErrorResponse,
  type ResponseEnvelope,
  type ValidationResult,
  type ValidationError,
  type ValidateJsonInput
} from '../types.js';

// Create shared Ajv instance with JSON Schema draft-07 support
const ajv = new Ajv.default({
  allErrors: true,
  verbose: true,
  strict: false,
  validateFormats: true
});
addFormats.default(ajv);

/**
 * Convert Ajv error to our ValidationError format
 */
function convertError(error: ErrorObject): ValidationError {
  return {
    path: error.instancePath || '/',
    keyword: error.keyword,
    message: error.message || 'Validation failed',
    params: error.params as Record<string, unknown>,
    schemaPath: error.schemaPath
  };
}

/**
 * Validate a JSON instance against a JSON Schema
 */
export function validateJson(input: ValidateJsonInput): ResponseEnvelope<ValidationResult> {
  try {
    // Validate input structure
    if (!input.schema || typeof input.schema !== 'object') {
      return createErrorResponse(
        'INVALID_INPUT',
        'Schema must be a valid JSON Schema object',
        { received: typeof input.schema }
      );
    }

    // Compile schema
    let validate;
    try {
      validate = ajv.compile(input.schema);
    } catch (err) {
      return createErrorResponse(
        'INVALID_INPUT',
        `Invalid JSON Schema: ${err instanceof Error ? err.message : String(err)}`,
        { schemaError: true }
      );
    }

    // Validate instance
    const valid = validate(input.instance);

    if (valid) {
      return createSuccessResponse<ValidationResult>(
        {
          valid: true,
          errors: []
        },
        { source: 'json-validate' }
      );
    }

    // Convert errors
    const errors = (validate.errors || []).map(convertError);

    return createSuccessResponse<ValidationResult>(
      {
        valid: false,
        errors
      },
      { source: 'json-validate' }
    );
  } catch (err) {
    return createErrorResponse(
      'INTERNAL_ERROR',
      `Validation failed: ${err instanceof Error ? err.message : String(err)}`,
      { error: err instanceof Error ? err.stack : undefined }
    );
  }
}

/**
 * Export the Ajv instance for use in other tools
 */
export { ajv };
