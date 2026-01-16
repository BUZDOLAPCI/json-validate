import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { validateJson, explainValidation, repairJson } from './tools/index.js';
import type {
  ValidateJsonInput,
  ExplainValidationInput,
  RepairJsonInput
} from './types.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'json-validate',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'validate_json',
          description: 'Validate a JSON instance against a JSON Schema. Returns validation result with detailed errors including paths, keywords, and messages.',
          inputSchema: {
            type: 'object',
            properties: {
              schema: {
                type: 'object',
                description: 'The JSON Schema to validate against (draft-07 supported)'
              },
              instance: {
                description: 'The JSON value to validate (can be any JSON type)'
              }
            },
            required: ['schema', 'instance']
          }
        },
        {
          name: 'explain_validation',
          description: 'Take validation errors from validate_json and provide human-readable explanations with fix suggestions for each error.',
          inputSchema: {
            type: 'object',
            properties: {
              errors: {
                type: 'array',
                description: 'Array of validation error objects from validate_json',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    keyword: { type: 'string' },
                    message: { type: 'string' },
                    params: { type: 'object' },
                    schemaPath: { type: 'string' }
                  }
                }
              }
            },
            required: ['errors']
          }
        },
        {
          name: 'repair_json',
          description: 'Attempt to repair invalid JSON to match a schema. Handles malformed JSON strings, applies schema defaults, removes unknown fields if additionalProperties is false, and coerces types when safe. Conservative: never invents unknown fields unless schema requires defaults.',
          inputSchema: {
            type: 'object',
            properties: {
              schema: {
                type: 'object',
                description: 'The JSON Schema the repaired JSON should conform to'
              },
              instance_or_text: {
                description: 'The JSON value or malformed JSON string to repair'
              }
            },
            required: ['schema', 'instance_or_text']
          }
        }
      ]
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'validate_json': {
        const input = args as unknown as ValidateJsonInput;
        const result = validateJson(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'explain_validation': {
        const input = args as unknown as ExplainValidationInput;
        const result = explainValidation(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'repair_json': {
        const input = args as unknown as RepairJsonInput;
        const result = repairJson(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: false,
                error: {
                  code: 'INVALID_INPUT',
                  message: `Unknown tool: ${name}`,
                  details: { availableTools: ['validate_json', 'explain_validation', 'repair_json'] }
                },
                meta: {
                  retrieved_at: new Date().toISOString()
                }
              }, null, 2)
            }
          ]
        };
    }
  });

  return server;
}

