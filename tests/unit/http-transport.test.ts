import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHttpTransport } from '../../src/transport/http.js';
import type { Server as HttpServer } from 'http';

/**
 * Parse SSE response to extract JSON-RPC messages
 */
function parseSSEResponse(sseText: string): unknown[] {
  const messages: unknown[] = [];
  const lines = sseText.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data && data !== '[DONE]') {
        try {
          messages.push(JSON.parse(data));
        } catch {
          // Skip non-JSON data
        }
      }
    }
  }

  return messages;
}

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

  it('should respond to tools/list JSON-RPC request on /mcp', async () => {
    const jsonRpcRequest = {
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

    const response = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(jsonRpcRequest),
    });

    expect(response.status).toBe(200);

    const responseText = await response.text();
    expect(responseText).toBeTruthy();

    // Parse the response - could be SSE or JSON
    let jsonResponse: Record<string, unknown>;
    if (responseText.startsWith('event:') || responseText.startsWith('data:')) {
      // Parse SSE format
      const messages = parseSSEResponse(responseText);
      expect(messages.length).toBeGreaterThan(0);
      jsonResponse = messages[0] as Record<string, unknown>;
    } else {
      jsonResponse = JSON.parse(responseText);
    }

    expect(jsonResponse.jsonrpc).toBe('2.0');
    expect(jsonResponse.id).toBe(1);
    expect(jsonResponse.result).toBeDefined();

    const result = jsonResponse.result as Record<string, unknown>;
    expect(result.serverInfo).toBeDefined();

    const serverInfo = result.serverInfo as Record<string, unknown>;
    expect(serverInfo.name).toBe('json-validate');

    // Get the session ID for the next request
    const sessionId = response.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    // Now make a tools/list request using the session
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
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId!,
      },
      body: JSON.stringify(toolsListRequest),
    });

    expect(toolsResponse.status).toBe(200);

    const toolsResponseText = await toolsResponse.text();

    // Parse tools response - could be SSE or JSON
    let toolsJsonResponse: Record<string, unknown>;
    if (toolsResponseText.startsWith('event:') || toolsResponseText.startsWith('data:')) {
      const messages = parseSSEResponse(toolsResponseText);
      expect(messages.length).toBeGreaterThan(0);
      toolsJsonResponse = messages[0] as Record<string, unknown>;
    } else {
      toolsJsonResponse = JSON.parse(toolsResponseText);
    }

    expect(toolsJsonResponse.jsonrpc).toBe('2.0');
    expect(toolsJsonResponse.id).toBe(2);
    expect(toolsJsonResponse.result).toBeDefined();

    const toolsResult = toolsJsonResponse.result as Record<string, unknown>;
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
    expect(body.timestamp).toBeDefined();
  });
});
