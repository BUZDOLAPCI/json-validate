/**
 * Parse command-line arguments
 */
export function parseArgs(args) {
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            result.help = true;
        }
        else if (arg === '--transport' || arg === '-t') {
            const value = args[++i];
            if (value === 'stdio' || value === 'http') {
                result.transport = value;
            }
            else {
                throw new Error(`Invalid transport: ${value}. Must be 'stdio' or 'http'.`);
            }
        }
        else if (arg === '--port' || arg === '-p') {
            const value = parseInt(args[++i], 10);
            if (isNaN(value) || value < 1 || value > 65535) {
                throw new Error(`Invalid port: ${args[i]}. Must be a number between 1 and 65535.`);
            }
            result.port = value;
        }
        else if (arg === '--host' || arg === '-H') {
            result.host = args[++i];
        }
        else if (arg === '--log-level' || arg === '-l') {
            const value = args[++i];
            if (['debug', 'info', 'warn', 'error'].includes(value)) {
                result.logLevel = value;
            }
            else {
                throw new Error(`Invalid log level: ${value}. Must be 'debug', 'info', 'warn', or 'error'.`);
            }
        }
    }
    return result;
}
/**
 * Print help message
 */
export function printHelp() {
    console.log(`
json-validate - MCP server for JSON Schema validation and repair

Usage: json-validate [options]

Options:
  -t, --transport <type>  Transport type: 'stdio' or 'http' (default: http)
  -p, --port <number>     HTTP server port (default: 8080)
  -H, --host <address>    HTTP server host (default: 127.0.0.1)
  -l, --log-level <level> Log level: 'debug', 'info', 'warn', 'error' (default: info)
  -h, --help              Show this help message

Environment Variables:
  TRANSPORT    Transport type
  PORT         HTTP server port
  HOST         HTTP server host
  LOG_LEVEL    Log level

Examples:
  # Run with HTTP transport (default, port 8080)
  json-validate

  # Run with STDIO transport
  json-validate --transport stdio

  # Run with environment variables
  TRANSPORT=stdio json-validate
`);
}
//# sourceMappingURL=cli.js.map