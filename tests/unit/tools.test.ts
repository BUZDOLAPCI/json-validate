import { describe, it, expect } from 'vitest';
import { validateJson } from '../../src/tools/validate.js';
import { explainValidation } from '../../src/tools/explain.js';
import { repairJson } from '../../src/tools/repair.js';

describe('validate_json', () => {
  const simpleSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer', minimum: 0 }
    },
    required: ['name']
  };

  it('should validate a valid JSON instance', () => {
    const result = validateJson({
      schema: simpleSchema,
      instance: { name: 'John', age: 30 }
    });

    expect(result.ok).toBe(true);
    expect(result.data?.valid).toBe(true);
    expect(result.data?.errors).toHaveLength(0);
  });

  it('should detect missing required property', () => {
    const result = validateJson({
      schema: simpleSchema,
      instance: { age: 30 }
    });

    expect(result.ok).toBe(true);
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0].keyword).toBe('required');
    expect(result.data?.errors[0].params.missingProperty).toBe('name');
  });

  it('should detect type mismatch', () => {
    const result = validateJson({
      schema: simpleSchema,
      instance: { name: 123, age: 30 }
    });

    expect(result.ok).toBe(true);
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors[0].keyword).toBe('type');
    expect(result.data?.errors[0].path).toBe('/name');
  });

  it('should detect minimum constraint violation', () => {
    const result = validateJson({
      schema: simpleSchema,
      instance: { name: 'John', age: -5 }
    });

    expect(result.ok).toBe(true);
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors[0].keyword).toBe('minimum');
  });

  it('should return error for invalid schema', () => {
    const result = validateJson({
      schema: null as unknown as Record<string, unknown>,
      instance: { name: 'John' }
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('should validate against format constraints', () => {
    const emailSchema = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' }
      }
    };

    const validResult = validateJson({
      schema: emailSchema,
      instance: { email: 'test@example.com' }
    });
    expect(validResult.data?.valid).toBe(true);

    const invalidResult = validateJson({
      schema: emailSchema,
      instance: { email: 'not-an-email' }
    });
    expect(invalidResult.data?.valid).toBe(false);
    expect(invalidResult.data?.errors[0].keyword).toBe('format');
  });

  it('should handle enum constraints', () => {
    const enumSchema = {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive', 'pending'] }
      }
    };

    const validResult = validateJson({
      schema: enumSchema,
      instance: { status: 'active' }
    });
    expect(validResult.data?.valid).toBe(true);

    const invalidResult = validateJson({
      schema: enumSchema,
      instance: { status: 'unknown' }
    });
    expect(invalidResult.data?.valid).toBe(false);
    expect(invalidResult.data?.errors[0].keyword).toBe('enum');
  });

  it('should validate nested objects', () => {
    const nestedSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            profile: {
              type: 'object',
              properties: {
                age: { type: 'integer' }
              }
            }
          }
        }
      }
    };

    const result = validateJson({
      schema: nestedSchema,
      instance: { user: { profile: { age: 'not-a-number' } } }
    });

    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors[0].path).toBe('/user/profile/age');
  });

  it('should validate arrays', () => {
    const arraySchema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1
        }
      }
    };

    const validResult = validateJson({
      schema: arraySchema,
      instance: { tags: ['a', 'b'] }
    });
    expect(validResult.data?.valid).toBe(true);

    const emptyResult = validateJson({
      schema: arraySchema,
      instance: { tags: [] }
    });
    expect(emptyResult.data?.valid).toBe(false);
    expect(emptyResult.data?.errors[0].keyword).toBe('minItems');
  });
});

describe('explain_validation', () => {
  it('should explain required property error', () => {
    const errors = [
      {
        path: '',
        keyword: 'required',
        message: "must have required property 'name'",
        params: { missingProperty: 'name' },
        schemaPath: '#/required'
      }
    ];

    const result = explainValidation({ errors });

    expect(result.ok).toBe(true);
    expect(result.data?.explanations).toHaveLength(1);
    expect(result.data?.explanations[0].explanation).toContain('name');
    expect(result.data?.explanations[0].suggestion).toContain('Add');
  });

  it('should explain type error', () => {
    const errors = [
      {
        path: '/age',
        keyword: 'type',
        message: 'must be integer',
        params: { type: 'integer' },
        schemaPath: '#/properties/age/type'
      }
    ];

    const result = explainValidation({ errors });

    expect(result.ok).toBe(true);
    expect(result.data?.explanations[0].explanation).toContain('wrong type');
    expect(result.data?.explanations[0].suggestion).toContain('integer');
  });

  it('should explain minimum constraint error', () => {
    const errors = [
      {
        path: '/age',
        keyword: 'minimum',
        message: 'must be >= 0',
        params: { limit: 0 },
        schemaPath: '#/properties/age/minimum'
      }
    ];

    const result = explainValidation({ errors });

    expect(result.ok).toBe(true);
    expect(result.data?.explanations[0].explanation).toContain('less than');
    expect(result.data?.explanations[0].suggestion).toContain('Increase');
  });

  it('should explain additionalProperties error', () => {
    const errors = [
      {
        path: '',
        keyword: 'additionalProperties',
        message: 'must NOT have additional properties',
        params: { additionalProperty: 'extra' },
        schemaPath: '#/additionalProperties'
      }
    ];

    const result = explainValidation({ errors });

    expect(result.ok).toBe(true);
    expect(result.data?.explanations[0].explanation).toContain('extra');
    expect(result.data?.explanations[0].suggestion).toContain('Remove');
  });

  it('should explain enum error', () => {
    const errors = [
      {
        path: '/status',
        keyword: 'enum',
        message: 'must be equal to one of the allowed values',
        params: { allowedValues: ['active', 'inactive'] },
        schemaPath: '#/properties/status/enum'
      }
    ];

    const result = explainValidation({ errors });

    expect(result.ok).toBe(true);
    expect(result.data?.explanations[0].explanation).toContain('allowed enum');
    expect(result.data?.explanations[0].suggestion).toContain('active');
  });

  it('should handle empty errors array', () => {
    const result = explainValidation({ errors: [] });

    expect(result.ok).toBe(true);
    expect(result.data?.explanations).toHaveLength(0);
  });

  it('should return error for invalid input', () => {
    const result = explainValidation({ errors: 'not-an-array' as unknown as [] });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });
});

describe('repair_json', () => {
  const simpleSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      active: { type: 'boolean', default: true }
    },
    required: ['name'],
    additionalProperties: false
  };

  it('should apply schema defaults', () => {
    const result = repairJson({
      schema: simpleSchema,
      instance_or_text: { name: 'John', age: 30 }
    });

    expect(result.ok).toBe(true);
    expect(result.data?.repaired).toEqual({ name: 'John', age: 30, active: true });
    expect(result.data?.changes.some(c => c.action === 'defaulted')).toBe(true);
  });

  it('should remove additional properties when additionalProperties is false', () => {
    const result = repairJson({
      schema: simpleSchema,
      instance_or_text: { name: 'John', extra: 'field' }
    });

    expect(result.ok).toBe(true);
    expect(result.data?.repaired).not.toHaveProperty('extra');
    expect(result.data?.changes.some(c => c.action === 'removed' && c.path === '/extra')).toBe(true);
  });

  it('should coerce string to number', () => {
    const result = repairJson({
      schema: simpleSchema,
      instance_or_text: { name: 'John', age: '30' }
    });

    expect(result.ok).toBe(true);
    expect((result.data?.repaired as Record<string, unknown>).age).toBe(30);
    expect(result.data?.changes.some(c => c.action === 'coerced')).toBe(true);
  });

  it('should coerce string to boolean', () => {
    const schema = {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' }
      }
    };

    const trueResult = repairJson({
      schema,
      instance_or_text: { enabled: 'true' }
    });
    expect((trueResult.data?.repaired as Record<string, unknown>).enabled).toBe(true);

    const falseResult = repairJson({
      schema,
      instance_or_text: { enabled: 'false' }
    });
    expect((falseResult.data?.repaired as Record<string, unknown>).enabled).toBe(false);
  });

  it('should parse and repair malformed JSON with trailing comma', () => {
    const result = repairJson({
      schema: simpleSchema,
      instance_or_text: '{"name": "John", "age": 30,}'
    });

    expect(result.ok).toBe(true);
    expect(result.data?.repaired).toEqual({ name: 'John', age: 30, active: true });
    expect(result.data?.parseErrors).toBeDefined();
    expect(result.data?.parseErrors?.length).toBeGreaterThan(0);
  });

  it('should parse and repair malformed JSON with single quotes', () => {
    const result = repairJson({
      schema: simpleSchema,
      instance_or_text: "{'name': 'John', 'age': 30}"
    });

    expect(result.ok).toBe(true);
    expect(result.data?.repaired).toEqual({ name: 'John', age: 30, active: true });
  });

  it('should return error for completely unparseable JSON', () => {
    const result = repairJson({
      schema: simpleSchema,
      instance_or_text: 'this is not json at all {{{'
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PARSE_ERROR');
  });

  it('should handle nested objects with defaults', () => {
    const nestedSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            settings: {
              type: 'object',
              properties: {
                theme: { type: 'string', default: 'light' }
              }
            }
          }
        }
      }
    };

    const result = repairJson({
      schema: nestedSchema,
      instance_or_text: { user: { name: 'John', settings: {} } }
    });

    expect(result.ok).toBe(true);
    const repaired = result.data?.repaired as Record<string, Record<string, Record<string, string>>>;
    expect(repaired.user.settings.theme).toBe('light');
  });

  it('should not invent values for required fields without defaults', () => {
    const strictSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        data: { type: 'string' }
      },
      required: ['id', 'data']
    };

    const result = repairJson({
      schema: strictSchema,
      instance_or_text: {}
    });

    expect(result.ok).toBe(true);
    // Should NOT have invented values for id and data
    expect(result.data?.repaired).toEqual({});
    // The result will still be invalid, but we're being conservative
  });

  it('should handle array items', () => {
    const arraySchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              count: { type: 'integer' }
            }
          }
        }
      }
    };

    const result = repairJson({
      schema: arraySchema,
      instance_or_text: { items: [{ count: '5' }, { count: '10' }] }
    });

    expect(result.ok).toBe(true);
    const repaired = result.data?.repaired as Record<string, Array<Record<string, number>>>;
    expect(repaired.items[0].count).toBe(5);
    expect(repaired.items[1].count).toBe(10);
  });

  it('should return error for invalid schema', () => {
    const result = repairJson({
      schema: null as unknown as Record<string, unknown>,
      instance_or_text: { name: 'John' }
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('should handle JSON with unquoted keys', () => {
    const result = repairJson({
      schema: simpleSchema,
      instance_or_text: '{name: "John", age: 30}'
    });

    expect(result.ok).toBe(true);
    expect((result.data?.repaired as Record<string, unknown>).name).toBe('John');
  });
});

describe('response envelope format', () => {
  it('should return success response with correct envelope structure', () => {
    const result = validateJson({
      schema: { type: 'string' },
      instance: 'hello'
    });

    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toHaveProperty('retrieved_at');
    expect(result.meta).toHaveProperty('pagination');
    expect(result.meta.pagination?.next_cursor).toBeNull();
  });

  it('should return error response with correct envelope structure', () => {
    const result = validateJson({
      schema: null as unknown as Record<string, unknown>,
      instance: 'hello'
    });

    expect(result).toHaveProperty('ok', false);
    expect(result).toHaveProperty('error');
    expect(result.error).toHaveProperty('code');
    expect(result.error).toHaveProperty('message');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toHaveProperty('retrieved_at');
  });
});
