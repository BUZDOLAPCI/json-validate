import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHttpTransport } from '../../src/transport/http.js';
import type { Server as HttpServer } from 'http';

describe('HTTP Transport /mcp endpoint', () => {
  let httpServer: HttpServer;
  const testPort = 18080;

  beforeAll(async () => {
    // Suppress console output during tests
    const originalLog = console.log;
    console.log = () => {};

    httpServer = await startHttpTransport({ port: testPort, host: '127.0.0.1' });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log = originalLog;
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  it('should respond to initialize and tools/list JSON-RPC requests on /mcp', async () => {
    // First, send initialize request
    const initializeRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };

    const initResponse = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initializeRequest),
    });

    expect(initResponse.status).toBe(200);

    const initJson = await initResponse.json() as Record<string, unknown>;

    expect(initJson.jsonrpc).toBe('2.0');
    expect(initJson.id).toBe(1);
    expect(initJson.result).toBeDefined();

    const result = initJson.result as Record<string, unknown>;
    expect(result.serverInfo).toBeDefined();

    const serverInfo = result.serverInfo as Record<string, unknown>;
    expect(serverInfo.name).toBe('json-validate');

    // Stateless implementation - no session ID required
    // Now make a tools/list request (no session needed)
    const toolsListRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    const toolsResponse = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toolsListRequest),
    });

    expect(toolsResponse.status).toBe(200);

    const toolsJson = await toolsResponse.json() as Record<string, unknown>;

    expect(toolsJson.jsonrpc).toBe('2.0');
    expect(toolsJson.id).toBe(2);
    expect(toolsJson.result).toBeDefined();

    const toolsResult = toolsJson.result as Record<string, unknown>;
    expect(toolsResult.tools).toBeDefined();

    const tools = toolsResult.tools as Array<{ name: string }>;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(3);

    // Verify the tools include the expected ones
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('validate_json');
    expect(toolNames).toContain('explain_validation');
    expect(toolNames).toContain('repair_json');
  });

  it('should return 404 for unknown paths', async () => {
    const response = await fetch(`http://127.0.0.1:${testPort}/unknown`, {
      method: 'GET',
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Not found');
  });

  it('should return 405 for invalid methods on /mcp', async () => {
    const response = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'PUT',
    });

    expect(response.status).toBe(405);
    const body = await response.json();
    expect(body.error).toBe('Method not allowed');
  });

  it('should respond to health check', async () => {
    const response = await fetch(`http://127.0.0.1:${testPort}/health`, {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('json-validate');
  });
});
