import { createServer } from 'http';
import { validateJson, explainValidation, repairJson } from '../tools/index.js';
/**
 * MCP Tool definitions for json-validate
 */
const toolDefinitions = [
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
];
/**
 * Handle a single JSON-RPC request
 */
async function handleJsonRpcRequest(request) {
    const { id, method, params } = request;
    try {
        switch (method) {
            case 'initialize': {
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {},
                        },
                        serverInfo: {
                            name: 'json-validate',
                            version: '1.0.0',
                        },
                    },
                };
            }
            case 'tools/list': {
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        tools: toolDefinitions,
                    },
                };
            }
            case 'tools/call': {
                const toolName = params?.name;
                const args = params?.arguments;
                let result;
                switch (toolName) {
                    case 'validate_json': {
                        const input = args;
                        result = validateJson(input);
                        break;
                    }
                    case 'explain_validation': {
                        const input = args;
                        result = explainValidation(input);
                        break;
                    }
                    case 'repair_json': {
                        const input = args;
                        result = repairJson(input);
                        break;
                    }
                    default:
                        return {
                            jsonrpc: '2.0',
                            id,
                            error: {
                                code: -32601,
                                message: `Unknown tool: ${toolName}`,
                            },
                        };
                }
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    },
                };
            }
            default:
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`,
                    },
                };
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: -32603,
                message: `Internal error: ${message}`,
            },
        };
    }
}
/**
 * Read the request body as a string
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
/**
 * Send a JSON response
 */
function sendJson(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}
/**
 * Handle health check endpoint
 */
function handleHealthCheck(res) {
    sendJson(res, 200, { status: 'ok', service: 'json-validate' });
}
/**
 * Handle not found
 */
function handleNotFound(res) {
    sendJson(res, 404, { error: 'Not found' });
}
/**
 * Handle method not allowed
 */
function handleMethodNotAllowed(res) {
    sendJson(res, 405, { error: 'Method not allowed' });
}
/**
 * Handle MCP JSON-RPC endpoint
 */
async function handleMcpRequest(req, res) {
    try {
        const body = await readBody(req);
        const request = JSON.parse(body);
        if (!request.jsonrpc || request.jsonrpc !== '2.0') {
            sendJson(res, 400, {
                jsonrpc: '2.0',
                id: request.id || 0,
                error: {
                    code: -32600,
                    message: 'Invalid Request: missing or invalid jsonrpc version',
                },
            });
            return;
        }
        const response = await handleJsonRpcRequest(request);
        sendJson(res, 200, response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendJson(res, 500, {
            ok: false,
            error: message,
        });
    }
}
/**
 * Create and configure the HTTP server
 */
export function createHttpServer() {
    const httpServer = createServer();
    httpServer.on('request', async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const method = req.method?.toUpperCase();
        try {
            switch (url.pathname) {
                case '/mcp':
                    if (method === 'POST') {
                        await handleMcpRequest(req, res);
                    }
                    else {
                        handleMethodNotAllowed(res);
                    }
                    break;
                case '/health':
                    if (method === 'GET') {
                        handleHealthCheck(res);
                    }
                    else {
                        handleMethodNotAllowed(res);
                    }
                    break;
                default:
                    handleNotFound(res);
            }
        }
        catch (error) {
            console.error('Server error:', error);
            const message = error instanceof Error ? error.message : 'Internal server error';
            sendJson(res, 500, { ok: false, error: message });
        }
    });
    return httpServer;
}
/**
 * Start HTTP transport for MCP server using stateless JSON-RPC handling
 */
export async function startHttpTransport(config) {
    const host = config.host ?? '127.0.0.1';
    const httpServer = createHttpServer();
    httpServer.listen(config.port, host, () => {
        console.log(`json-validate HTTP server listening on http://${host}:${config.port}`);
        console.log(`MCP endpoint: http://${host}:${config.port}/mcp`);
        console.log(`Health check: http://${host}:${config.port}/health`);
    });
    // Handle graceful shutdown
    const shutdown = () => {
        console.log('Shutting down HTTP server...');
        httpServer.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return httpServer;
}
//# sourceMappingURL=http.js.map