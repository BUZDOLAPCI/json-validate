import { Server } from 'http';
export interface HttpTransportConfig {
    port: number;
    host?: string;
}
/**
 * Create and configure the HTTP server
 */
export declare function createHttpServer(): Server;
/**
 * Start HTTP transport for MCP server using stateless JSON-RPC handling
 */
export declare function startHttpTransport(config: HttpTransportConfig): Promise<Server>;
//# sourceMappingURL=http.d.ts.map