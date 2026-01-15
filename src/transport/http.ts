import express from 'express';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { ServerConfig } from '../types.js';

/**
 * Create and start HTTP transport for MCP server using SSE
 */
export async function startHttpTransport(server: Server, config: ServerConfig): Promise<void> {
  const app = express();

  // Store active transports for cleanup
  const transports: Map<string, SSEServerTransport> = new Map();

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // SSE endpoint for MCP
  app.get('/sse', async (req, res) => {
    const sessionId = crypto.randomUUID();

    console.log(`[${sessionId}] New SSE connection established`);

    const transport = new SSEServerTransport('/message', res);
    transports.set(sessionId, transport);

    // Handle connection close
    res.on('close', () => {
      console.log(`[${sessionId}] SSE connection closed`);
      transports.delete(sessionId);
    });

    await server.connect(transport);
  });

  // Message endpoint for client-to-server messages
  app.post('/message', express.json(), async (req, res) => {
    // Find the transport that matches (in practice, you'd use session IDs)
    // For simplicity, we'll broadcast to all transports
    const messageHandled = false;

    for (const transport of transports.values()) {
      try {
        await transport.handlePostMessage(req, res);
        return;
      } catch {
        // Try next transport
      }
    }

    if (!messageHandled) {
      res.status(400).json({ error: 'No active transport found' });
    }
  });

  // Start the server
  const httpServer = app.listen(config.port, config.host, () => {
    console.log(`HTTP server listening on http://${config.host}:${config.port}`);
    console.log(`SSE endpoint: http://${config.host}:${config.port}/sse`);
    console.log(`Health check: http://${config.host}:${config.port}/health`);
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down HTTP server...');

    // Close all transports
    for (const transport of transports.values()) {
      try {
        // Transports will be cleaned up when connections close
      } catch {
        // Ignore errors during shutdown
      }
    }
    transports.clear();

    await server.close();

    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
