import { Server as HttpServer } from 'http';
export interface HttpTransportConfig {
    port: number;
    host?: string;
}
/**
 * Start HTTP transport for MCP server using StreamableHTTPServerTransport
 */
export declare function startHttpTransport(config: HttpTransportConfig): Promise<HttpServer>;
//# sourceMappingURL=http.d.ts.map