interface ParsedArgs {
    transport?: 'stdio' | 'http';
    port?: number;
    host?: string;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    help?: boolean;
}
/**
 * Parse command-line arguments
 */
export declare function parseArgs(args: string[]): ParsedArgs;
/**
 * Print help message
 */
export declare function printHelp(): void;
export {};
//# sourceMappingURL=cli.d.ts.map