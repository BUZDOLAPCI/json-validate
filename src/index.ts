#!/usr/bin/env node

import { parseArgs, printHelp } from './cli.js';
import { loadConfig, validateConfig } from './config.js';
import { createServer } from './server.js';
import { startStdioTransport, startHttpTransport } from './transport/index.js';

async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
      printHelp();
      process.exit(0);
    }

    // Load and validate configuration
    const config = loadConfig({
      transport: args.transport,
      port: args.port,
      host: args.host,
      logLevel: args.logLevel
    });
    validateConfig(config);

    // Create the MCP server
    const server = createServer();

    // Start the appropriate transport
    if (config.transport === 'http') {
      console.log('Starting json-validate MCP server with HTTP transport...');
      await startHttpTransport(server, config);
    } else {
      // STDIO transport - no console output as it interferes with the protocol
      await startStdioTransport(server);
    }
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
