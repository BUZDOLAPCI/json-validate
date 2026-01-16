import { Server } from '@modelcontextprotocol/sdk/server/index.js';
/**
 * Create and configure the MCP server
 */
export declare function createServer(): Server;
/**
 * Create a standalone server instance for HTTP transport
 * This returns the server without connecting it to any transport,
 * allowing the HTTP transport to manage connections per-session.
 */
export declare function createStandaloneServer(): Server;
//# sourceMappingURL=server.d.ts.map