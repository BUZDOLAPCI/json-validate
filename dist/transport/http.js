import { createServer as createHttpServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from '../server.js';
import { randomUUID } from 'crypto';
// Store active sessions with their transports
const sessions = new Map();
/**
 * Handle MCP protocol requests
 */
async function handleMcpRequest(req, res) {
    // Check for existing session
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && sessions.has(sessionId)) {
        // Existing session - reuse transport
        const session = sessions.get(sessionId);
        await session.transport.handleRequest(req, res);
    }
    else {
        // New session - create transport and server
        const newSessionId = randomUUID();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
        });
        // Create a new MCP server for this session
        const mcpServer = createServer();
        sessions.set(newSessionId, { transport, server: mcpServer });
        // Handle session close
        transport.onclose = () => {
            sessions.delete(newSessionId);
            console.log(`[${newSessionId}] Session closed`);
        };
        // Connect the MCP server to this transport
        await mcpServer.connect(transport);
        console.log(`[${newSessionId}] New MCP session established`);
        // Handle the initial request
        await transport.handleRequest(req, res);
    }
}
/**
 * Handle health check requests
 */
function handleHealthCheck(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
}
/**
 * Handle 404 Not Found
 */
function handleNotFound(res) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}
/**
 * Handle 405 Method Not Allowed
 */
function handleMethodNotAllowed(res) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
}
/**
 * Start HTTP transport for MCP server using StreamableHTTPServerTransport
 */
export async function startHttpTransport(config) {
    const host = config.host ?? '127.0.0.1';
    const httpServer = createHttpServer();
    httpServer.on('request', async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        try {
            switch (url.pathname) {
                case '/mcp':
                    if (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE') {
                        await handleMcpRequest(req, res);
                    }
                    else {
                        handleMethodNotAllowed(res);
                    }
                    break;
                case '/health':
                    if (req.method === 'GET') {
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
            console.error('Error handling request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    });
    httpServer.listen(config.port, host, () => {
        console.log(`HTTP server listening on http://${host}:${config.port}`);
        console.log(`MCP endpoint: http://${host}:${config.port}/mcp`);
        console.log(`Health check: http://${host}:${config.port}/health`);
    });
    // Handle graceful shutdown
    const shutdown = async () => {
        console.log('Shutting down HTTP server...');
        // Close all sessions
        for (const [sessionId, session] of sessions) {
            try {
                await session.transport.close();
                await session.server.close();
                console.log(`[${sessionId}] Session closed`);
            }
            catch {
                // Ignore errors during shutdown
            }
        }
        sessions.clear();
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