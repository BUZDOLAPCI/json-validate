import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
/**
 * Create and start STDIO transport for MCP server
 */
export async function startStdioTransport(server) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        await server.close();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await server.close();
        process.exit(0);
    });
}
//# sourceMappingURL=stdio.js.map