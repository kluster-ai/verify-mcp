# Self-hosted MCP

Deploy kluster.ai's MCP server locally for development and testing. This self-hosted implementation gives you full control over your infrastructure while providing the same verification tools as Cloud MCP.

## Prerequisites

Before deploying the self-hosted MCP server, ensure you have:

- **kluster.ai API key** from [kluster.ai platform](https://platform.kluster.ai)
- **Docker Desktop** or **Node.js 18+**
- **Git** for cloning the repository

## Clone repository

First, clone the MCP server repository:

```bash
git clone https://github.com/kluster-ai/verify-mcp
cd verify-mcp
```

## Deployment options

### Docker

Build and run with Docker:

```bash
docker build -t kluster-verify-mcp .
docker run --rm -p 3001:3001 kluster-verify-mcp --api-key YOUR_API_KEY
```

### Node.js

Install dependencies and run:

```bash
npm install
npm run build
npm start -- --api-key YOUR_API_KEY
```

The server will start on `http://localhost:3001` with the MCP endpoint at `/stream`.

## Client integration

Once your self-hosted server is running, configure your AI clients. For Claude Desktop, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kluster-verify-local": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3001/stream"
      ]
    }
  }
}
```

Use these connection details:

- **MCP endpoint**: `http://localhost:3001/stream`

## Available tools

Your self-hosted deployment provides the same verification tools as Cloud MCP:

- **`verify`**: Validates claims against reliable online sources
- **`verify_document`**: Verifies claims about uploaded document content

For detailed parameters and response formats, see the [Tools reference](https://docs.kluster.ai/get-started/mcp/tools/).
