import type { ErrorObject } from 'ajv';
import {
  createSuccessResponse,
  createErrorResponse,
  type ResponseEnvelope,
  type ExplanationResult,
  type ErrorExplanation,
  type ValidationError,
  type ExplainValidationInput
} from '../types.js';

/**
 * Generate human-readable explanation for a validation error keyword
 */
function getKeywordExplanation(keyword: string, params: Record<string, unknown>, path: string): { explanation: string; suggestion: string } {
  const location = path === '/' || path === '' ? 'root' : `"${path}"`;

  switch (keyword) {
    case 'type':
      return {
        explanation: `The value at ${location} has the wrong type. Expected "${params.type}" but got a different type.`,
        suggestion: `Change the value at ${location} to be of type "${params.type}".`
      };

    case 'required':
      return {
        explanation: `The required property "${params.missingProperty}" is missing at ${location}.`,
        suggestion: `Add the missing property "${params.missingProperty}" with an appropriate value.`
      };

    case 'additionalProperties':
      return {
        explanation: `The property "${params.additionalProperty}" at ${location} is not allowed by the schema.`,
        suggestion: `Remove the unexpected property "${params.additionalProperty}" or update the schema to allow it.`
      };

    case 'enum':
      const allowedValues = (params.allowedValues as unknown[])?.map(v => JSON.stringify(v)).join(', ') || 'specified values';
      return {
        explanation: `The value at ${location} must be one of the allowed enum values: ${allowedValues}.`,
        suggestion: `Change the value at ${location} to one of: ${allowedValues}.`
      };

    case 'const':
      return {
        explanation: `The value at ${location} must be exactly ${JSON.stringify(params.allowedValue)}.`,
        suggestion: `Set the value at ${location} to ${JSON.stringify(params.allowedValue)}.`
      };

    case 'minimum':
      return {
        explanation: `The value at ${location} is less than the minimum allowed value of ${params.limit}.`,
        suggestion: `Increase the value at ${location} to be at least ${params.limit}.`
      };

    case 'maximum':
      return {
        explanation: `The value at ${location} exceeds the maximum allowed value of ${params.limit}.`,
        suggestion: `Decrease the value at ${location} to be at most ${params.limit}.`
      };

    case 'exclusiveMinimum':
      return {
        explanation: `The value at ${location} must be greater than ${params.limit} (exclusive).`,
        suggestion: `Increase the value at ${location} to be strictly greater than ${params.limit}.`
      };

    case 'exclusiveMaximum':
      return {
        explanation: `The value at ${location} must be less than ${params.limit} (exclusive).`,
        suggestion: `Decrease the value at ${location} to be strictly less than ${params.limit}.`
      };

    case 'minLength':
      return {
        explanation: `The string at ${location} is too short. Minimum length is ${params.limit} characters.`,
        suggestion: `Add more characters to the string at ${location} to reach at least ${params.limit} characters.`
      };

    case 'maxLength':
      return {
        explanation: `The string at ${location} is too long. Maximum length is ${params.limit} characters.`,
        suggestion: `Shorten the string at ${location} to at most ${params.limit} characters.`
      };

    case 'pattern':
      return {
        explanation: `The string at ${location} does not match the required pattern: ${params.pattern}.`,
        suggestion: `Modify the string at ${location} to match the pattern "${params.pattern}".`
      };

    case 'format':
      return {
        explanation: `The string at ${location} does not match the required format "${params.format}".`,
        suggestion: `Correct the string at ${location} to be a valid "${params.format}" format.`
      };

    case 'minItems':
      return {
        explanation: `The array at ${location} has too few items. Minimum is ${params.limit} items.`,
        suggestion: `Add more items to the array at ${location} to have at least ${params.limit} items.`
      };

    case 'maxItems':
      return {
        explanation: `The array at ${location} has too many items. Maximum is ${params.limit} items.`,
        suggestion: `Remove items from the array at ${location} to have at most ${params.limit} items.`
      };

    case 'uniqueItems':
      return {
        explanation: `The array at ${location} contains duplicate items at positions ${params.i} and ${params.j}.`,
        suggestion: `Remove duplicate items from the array at ${location}.`
      };

    case 'minProperties':
      return {
        explanation: `The object at ${location} has too few properties. Minimum is ${params.limit} properties.`,
        suggestion: `Add more properties to the object at ${location} to have at least ${params.limit} properties.`
      };

    case 'maxProperties':
      return {
        explanation: `The object at ${location} has too many properties. Maximum is ${params.limit} properties.`,
        suggestion: `Remove properties from the object at ${location} to have at most ${params.limit} properties.`
      };

    case 'propertyNames':
      return {
        explanation: `A property name at ${location} does not match the required pattern.`,
        suggestion: `Rename the invalid property to match the schema's property name requirements.`
      };

    case 'dependencies':
    case 'dependentRequired':
      return {
        explanation: `The property at ${location} requires additional properties: ${(params.deps as string[])?.join(', ') || params.missingProperty}.`,
        suggestion: `Add the required dependent properties when using this field.`
      };

    case 'if':
    case 'then':
    case 'else':
      return {
        explanation: `The value at ${location} does not satisfy the conditional schema (${keyword} clause).`,
        suggestion: `Modify the value at ${location} to satisfy the conditional requirements.`
      };

    case 'oneOf':
      return {
        explanation: `The value at ${location} must match exactly one of the allowed schemas, but it ${params.passingSchemas ? 'matches multiple' : 'matches none'}.`,
        suggestion: `Modify the value at ${location} to match exactly one of the allowed alternatives.`
      };

    case 'anyOf':
      return {
        explanation: `The value at ${location} must match at least one of the allowed schemas, but it matches none.`,
        suggestion: `Modify the value at ${location} to match at least one of the allowed alternatives.`
      };

    case 'allOf':
      return {
        explanation: `The value at ${location} must match all of the required schemas, but it fails to match some.`,
        suggestion: `Modify the value at ${location} to satisfy all the required conditions.`
      };

    case 'not':
      return {
        explanation: `The value at ${location} matches a schema that it should NOT match.`,
        suggestion: `Modify the value at ${location} so it does not match the forbidden schema.`
      };

    case 'multipleOf':
      return {
        explanation: `The number at ${location} must be a multiple of ${params.multipleOf}.`,
        suggestion: `Change the value at ${location} to be a multiple of ${params.multipleOf}.`
      };

    default:
      return {
        explanation: `Validation failed at ${location} due to "${keyword}" constraint.`,
        suggestion: `Review and fix the value at ${location} to satisfy the "${keyword}" constraint.`
      };
  }
}

/**
 * Normalize error object to handle both Ajv ErrorObject and our ValidationError
 */
function normalizeError(error: ValidationError | ErrorObject): { path: string; keyword: string; message: string; params: Record<string, unknown> } {
  if ('instancePath' in error) {
    // Ajv ErrorObject
    return {
      path: error.instancePath || '/',
      keyword: error.keyword,
      message: error.message || 'Validation failed',
      params: error.params as Record<string, unknown>
    };
  }
  // Our ValidationError
  return {
    path: error.path,
    keyword: error.keyword,
    message: error.message,
    params: error.params
  };
}

/**
 * Explain validation errors in human-readable format
 */
export function explainValidation(input: ExplainValidationInput): ResponseEnvelope<ExplanationResult> {
  try {
    // Validate input
    if (!input.errors || !Array.isArray(input.errors)) {
      return createErrorResponse(
        'INVALID_INPUT',
        'Errors must be an array of validation error objects',
        { received: typeof input.errors }
      );
    }

    if (input.errors.length === 0) {
      return createSuccessResponse<ExplanationResult>(
        { explanations: [] },
        { source: 'json-validate' }
      );
    }

    const explanations: ErrorExplanation[] = input.errors.map((error) => {
      const normalized = normalizeError(error as ValidationError | ErrorObject);
      const { explanation, suggestion } = getKeywordExplanation(
        normalized.keyword,
        normalized.params,
        normalized.path
      );

      return {
        path: normalized.path,
        error: normalized.message,
        explanation,
        suggestion
      };
    });

    return createSuccessResponse<ExplanationResult>(
      { explanations },
      { source: 'json-validate' }
    );
  } catch (err) {
    return createErrorResponse(
      'INTERNAL_ERROR',
      `Failed to explain errors: ${err instanceof Error ? err.message : String(err)}`,
      { error: err instanceof Error ? err.stack : undefined }
    );
  }
}
