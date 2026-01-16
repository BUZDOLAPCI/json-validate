import type { ServerConfig } from './types.js';
/**
 * Load configuration from environment variables
 */
export declare function loadConfig(overrides?: Partial<ServerConfig>): ServerConfig;
/**
 * Validate configuration
 */
export declare function validateConfig(config: ServerConfig): void;
//# sourceMappingURL=config.d.ts.map