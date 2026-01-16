/**
 * Default configuration values
 */
const defaults = {
    transport: 'http',
    port: 8080,
    host: '127.0.0.1',
    logLevel: 'info'
};
/**
 * Load configuration from environment variables
 */
export function loadConfig(overrides) {
    const transport = process.env.TRANSPORT;
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
    const host = process.env.HOST;
    const logLevel = process.env.LOG_LEVEL;
    return {
        transport: overrides?.transport ?? transport ?? defaults.transport,
        port: overrides?.port ?? port ?? defaults.port,
        host: overrides?.host ?? host ?? defaults.host,
        logLevel: overrides?.logLevel ?? logLevel ?? defaults.logLevel
    };
}
/**
 * Validate configuration
 */
export function validateConfig(config) {
    if (!['stdio', 'http'].includes(config.transport)) {
        throw new Error(`Invalid transport: ${config.transport}. Must be 'stdio' or 'http'.`);
    }
    if (config.port < 1 || config.port > 65535) {
        throw new Error(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
    }
    if (!['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
        throw new Error(`Invalid log level: ${config.logLevel}. Must be 'debug', 'info', 'warn', or 'error'.`);
    }
}
//# sourceMappingURL=config.js.map