import { createServer as createHttpServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
// Store active sessions with their transports
const sessions = new Map();
/**
 * Handle MCP protocol requests
 */
async function handleMcpRequest(req, res, mcpServer) {
    // Check for existing session
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && sessions.has(sessionId)) {
        // Existing session - reuse transport
        const session = sessions.get(sessionId);
        await session.transport.handleRequest(req, res);
    }
    else {
        // New session - create transport
        const newSessionId = randomUUID();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
        });
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
 * Create and start HTTP transport for MCP server using StreamableHTTPServerTransport
 */
export async function startHttpTransport(server, config) {
    const httpServer = createHttpServer();
    httpServer.on('request', async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        try {
            switch (url.pathname) {
                case '/mcp':
                    if (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE') {
                        await handleMcpRequest(req, res, server);
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
    httpServer.listen(config.port, config.host, () => {
        console.log(`HTTP server listening on http://${config.host}:${config.port}`);
        console.log(`MCP endpoint: http://${config.host}:${config.port}/mcp`);
        console.log(`Health check: http://${config.host}:${config.port}/health`);
    });
    // Handle graceful shutdown
    const shutdown = async () => {
        console.log('Shutting down HTTP server...');
        // Close all sessions
        for (const [sessionId, session] of sessions) {
            try {
                await session.transport.close();
                console.log(`[${sessionId}] Transport closed`);
            }
            catch {
                // Ignore errors during shutdown
            }
        }
        sessions.clear();
        await server.close();
        httpServer.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
//# sourceMappingURL=http.js.map