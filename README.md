# json-validate

MCP server for validating JSON against JSON Schema and repairing malformed/invalid JSON.

## Features

- **validate_json**: Validate a JSON instance against a JSON Schema (draft-07 supported)
- **explain_validation**: Get human-readable explanations and fix suggestions for validation errors
- **repair_json**: Attempt to repair invalid JSON to match a schema (conservative approach)

## Installation

```bash
npm install
npm run build
```

## Usage

### STDIO Transport (Default)

```bash
npm start
# or
node dist/index.js
```

### HTTP Transport

```bash
npm start -- --transport http --port 3000
# or
TRANSPORT=http PORT=3000 node dist/index.js
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "json-validate": {
      "command": "node",
      "args": ["/path/to/json-validate/dist/index.js"]
    }
  }
}
```

## Tools

### validate_json

Validate a JSON instance against a JSON Schema.

**Input:**
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "integer", "minimum": 0 }
    },
    "required": ["name"]
  },
  "instance": {
    "name": "John",
    "age": 30
  }
}
```

**Output (Success):**
```json
{
  "ok": true,
  "data": {
    "valid": true,
    "errors": []
  },
  "meta": {
    "source": "json-validate",
    "retrieved_at": "2024-01-15T10:30:00.000Z",
    "pagination": { "next_cursor": null },
    "warnings": []
  }
}
```

**Output (Validation Errors):**
```json
{
  "ok": true,
  "data": {
    "valid": false,
    "errors": [
      {
        "path": "/age",
        "keyword": "minimum",
        "message": "must be >= 0",
        "params": { "limit": 0 },
        "schemaPath": "#/properties/age/minimum"
      }
    ]
  },
  "meta": {
    "source": "json-validate",
    "retrieved_at": "2024-01-15T10:30:00.000Z",
    "pagination": { "next_cursor": null },
    "warnings": []
  }
}
```

### explain_validation

Get human-readable explanations for validation errors.

**Input:**
```json
{
  "errors": [
    {
      "path": "",
      "keyword": "required",
      "message": "must have required property 'name'",
      "params": { "missingProperty": "name" },
      "schemaPath": "#/required"
    }
  ]
}
```

**Output:**
```json
{
  "ok": true,
  "data": {
    "explanations": [
      {
        "path": "",
        "error": "must have required property 'name'",
        "explanation": "The required property \"name\" is missing at root.",
        "suggestion": "Add the missing property \"name\" with an appropriate value."
      }
    ]
  },
  "meta": {
    "source": "json-validate",
    "retrieved_at": "2024-01-15T10:30:00.000Z",
    "pagination": { "next_cursor": null },
    "warnings": []
  }
}
```

### repair_json

Attempt to repair invalid JSON to match a schema.

**Features:**
- Parse malformed JSON (trailing commas, single quotes, unquoted keys)
- Apply schema defaults
- Remove additional properties when `additionalProperties: false`
- Coerce types when safe (e.g., `"123"` to `123` for number schema)
- Conservative: never invents unknown fields unless schema requires defaults

**Input:**
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "integer" },
      "active": { "type": "boolean", "default": true }
    },
    "additionalProperties": false
  },
  "instance_or_text": "{'name': 'John', 'age': '30', 'extra': 'field',}"
}
```

**Output:**
```json
{
  "ok": true,
  "data": {
    "repaired": {
      "name": "John",
      "age": 30,
      "active": true
    },
    "changes": [
      {
        "path": "/extra",
        "action": "removed",
        "from": "field",
        "reason": "Property not allowed by schema (additionalProperties: false)"
      },
      {
        "path": "/age",
        "action": "coerced",
        "from": "30",
        "to": 30,
        "reason": "Coerced string to integer"
      },
      {
        "path": "/active",
        "action": "defaulted",
        "to": true,
        "reason": "Applied schema default value"
      }
    ],
    "parseErrors": [
      "Standard JSON parse failed, attempting repairs...",
      "JSON repaired successfully with syntax fixes"
    ]
  },
  "meta": {
    "source": "json-validate",
    "retrieved_at": "2024-01-15T10:30:00.000Z",
    "pagination": { "next_cursor": null },
    "warnings": []
  }
}
```

## CLI Options

```
Usage: json-validate [options]

Options:
  -t, --transport <type>  Transport type: 'stdio' or 'http' (default: stdio)
  -p, --port <number>     HTTP server port (default: 3000)
  -H, --host <address>    HTTP server host (default: 127.0.0.1)
  -l, --log-level <level> Log level: 'debug', 'info', 'warn', 'error' (default: info)
  -h, --help              Show this help message
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRANSPORT` | Transport type: `stdio` or `http` | `stdio` |
| `PORT` | HTTP server port | `3000` |
| `HOST` | HTTP server host | `127.0.0.1` |
| `LOG_LEVEL` | Log level: `debug`, `info`, `warn`, `error` | `info` |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Build
npm run build
```

## Response Envelope

All tools return responses in a standard envelope format:

**Success:**
```json
{
  "ok": true,
  "data": { ... },
  "meta": {
    "source": "json-validate",
    "retrieved_at": "ISO-8601 timestamp",
    "pagination": { "next_cursor": null },
    "warnings": []
  }
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT | PARSE_ERROR | INTERNAL_ERROR",
    "message": "Human readable message",
    "details": { ... }
  },
  "meta": {
    "retrieved_at": "ISO-8601 timestamp"
  }
}
```

## License

MIT
