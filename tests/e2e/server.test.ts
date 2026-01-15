import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../../src/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

describe('MCP Server E2E', () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport)
    ]);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  describe('list tools', () => {
    it('should list all available tools', async () => {
      const result = await client.listTools();

      expect(result.tools).toHaveLength(3);

      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).toContain('validate_json');
      expect(toolNames).toContain('explain_validation');
      expect(toolNames).toContain('repair_json');
    });

    it('should have correct input schemas', async () => {
      const result = await client.listTools();

      const validateTool = result.tools.find(t => t.name === 'validate_json');
      expect(validateTool?.inputSchema.required).toContain('schema');
      expect(validateTool?.inputSchema.required).toContain('instance');

      const explainTool = result.tools.find(t => t.name === 'explain_validation');
      expect(explainTool?.inputSchema.required).toContain('errors');

      const repairTool = result.tools.find(t => t.name === 'repair_json');
      expect(repairTool?.inputSchema.required).toContain('schema');
      expect(repairTool?.inputSchema.required).toContain('instance_or_text');
    });
  });

  describe('validate_json tool', () => {
    it('should validate a valid JSON instance', async () => {
      const result = await client.callTool({
        name: 'validate_json',
        arguments: {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          },
          instance: { name: 'John' }
        }
      });

      const content = result.content[0];
      expect(content.type).toBe('text');

      const response = JSON.parse((content as { type: 'text'; text: string }).text);
      expect(response.ok).toBe(true);
      expect(response.data.valid).toBe(true);
      expect(response.data.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid JSON', async () => {
      const result = await client.callTool({
        name: 'validate_json',
        arguments: {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'integer', minimum: 0 }
            },
            required: ['name']
          },
          instance: { age: -5 }
        }
      });

      const content = result.content[0];
      const response = JSON.parse((content as { type: 'text'; text: string }).text);

      expect(response.ok).toBe(true);
      expect(response.data.valid).toBe(false);
      expect(response.data.errors.length).toBeGreaterThan(0);
    });
  });

  describe('explain_validation tool', () => {
    it('should explain validation errors', async () => {
      const result = await client.callTool({
        name: 'explain_validation',
        arguments: {
          errors: [
            {
              path: '',
              keyword: 'required',
              message: "must have required property 'name'",
              params: { missingProperty: 'name' },
              schemaPath: '#/required'
            }
          ]
        }
      });

      const content = result.content[0];
      const response = JSON.parse((content as { type: 'text'; text: string }).text);

      expect(response.ok).toBe(true);
      expect(response.data.explanations).toHaveLength(1);
      expect(response.data.explanations[0]).toHaveProperty('explanation');
      expect(response.data.explanations[0]).toHaveProperty('suggestion');
    });
  });

  describe('repair_json tool', () => {
    it('should repair invalid JSON', async () => {
      const result = await client.callTool({
        name: 'repair_json',
        arguments: {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              active: { type: 'boolean', default: true }
            },
            additionalProperties: false
          },
          instance_or_text: { name: 'John', extra: 'field' }
        }
      });

      const content = result.content[0];
      const response = JSON.parse((content as { type: 'text'; text: string }).text);

      expect(response.ok).toBe(true);
      expect(response.data.repaired).toEqual({ name: 'John', active: true });
      expect(response.data.changes.length).toBeGreaterThan(0);
    });

    it('should repair malformed JSON string', async () => {
      const result = await client.callTool({
        name: 'repair_json',
        arguments: {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          },
          instance_or_text: "{'name': 'John',}"
        }
      });

      const content = result.content[0];
      const response = JSON.parse((content as { type: 'text'; text: string }).text);

      expect(response.ok).toBe(true);
      expect(response.data.repaired).toEqual({ name: 'John' });
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await client.callTool({
        name: 'unknown_tool',
        arguments: {}
      });

      const content = result.content[0];
      const response = JSON.parse((content as { type: 'text'; text: string }).text);

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('INVALID_INPUT');
      expect(response.error.message).toContain('Unknown tool');
    });
  });

  describe('integration workflow', () => {
    it('should validate, explain, and repair in sequence', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'integer', minimum: 0 },
          active: { type: 'boolean', default: false }
        },
        required: ['name', 'email'],
        additionalProperties: false
      };

      const invalidInstance = {
        name: 'John',
        email: 'not-an-email',
        age: '25',
        extra: 'field'
      };

      // Step 1: Validate
      const validateResult = await client.callTool({
        name: 'validate_json',
        arguments: { schema, instance: invalidInstance }
      });

      const validateResponse = JSON.parse(
        (validateResult.content[0] as { type: 'text'; text: string }).text
      );

      expect(validateResponse.ok).toBe(true);
      expect(validateResponse.data.valid).toBe(false);
      const errors = validateResponse.data.errors;
      expect(errors.length).toBeGreaterThan(0);

      // Step 2: Explain
      const explainResult = await client.callTool({
        name: 'explain_validation',
        arguments: { errors }
      });

      const explainResponse = JSON.parse(
        (explainResult.content[0] as { type: 'text'; text: string }).text
      );

      expect(explainResponse.ok).toBe(true);
      expect(explainResponse.data.explanations.length).toBe(errors.length);

      // Step 3: Repair
      const repairResult = await client.callTool({
        name: 'repair_json',
        arguments: { schema, instance_or_text: invalidInstance }
      });

      const repairResponse = JSON.parse(
        (repairResult.content[0] as { type: 'text'; text: string }).text
      );

      expect(repairResponse.ok).toBe(true);
      expect(repairResponse.data.repaired).not.toHaveProperty('extra');
      expect(repairResponse.data.repaired.age).toBe(25); // Coerced from string
      expect(repairResponse.data.repaired.active).toBe(false); // Default applied

      // Step 4: Validate repaired
      const revalidateResult = await client.callTool({
        name: 'validate_json',
        arguments: { schema, instance: repairResponse.data.repaired }
      });

      const revalidateResponse = JSON.parse(
        (revalidateResult.content[0] as { type: 'text'; text: string }).text
      );

      // Email format still invalid (we can't fix content), but structure is correct
      expect(revalidateResponse.ok).toBe(true);
    });
  });
});
