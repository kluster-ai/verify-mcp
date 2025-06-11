# Client Configurations

This directory contains configuration files for different MCP clients to connect to the kluster verify MCP Server.

## Supported Clients

### Direct MCP Clients (via Docker)

#### Claude Desktop
- **Config file**: `claude_desktop/config.json`
- **Location**: Add to your Claude Desktop configuration
- **Features**: Full support for both tools with automatic document content handling

#### VS Code Copilot Chat
- **Config file**: `vscode/mcp.json`
- **Location**: Place in `.vscode/mcp.json` in your workspace
- **Features**: Both tools available in Agent Mode with secure API key input

### HTTP/SSE Clients (via SSE Server)

#### SSE Server
- **Location**: `sse-server/`
- **Setup Guide**: `sse-server/README.md`
- **Features**: HTTP/SSE interface for any HTTP-capable client
- **Supported clients**:
  - **n8n** - Workflow automation platform
  - **Dify** - AI application development (localhost)
  - **Custom integrations** - Any HTTP client
  - **Web applications** - Browser-based tools

## Setup Instructions

### Claude Desktop
1. Copy the content from `claude_desktop/config.json`
2. Replace `YOUR_KLUSTER_API_KEY` with your actual API key
3. Add to your Claude Desktop configuration file
4. Restart Claude Desktop

### VS Code
1. Copy `vscode/mcp.json` to `.vscode/mcp.json` in your workspace
2. Enable MCP in VS Code settings: `"chat.mcp.enabled": true`
3. Restart VS Code
4. VS Code will securely prompt for your API key when first used

### HTTP/SSE Clients (n8n, Dify, etc.)
1. Install dependencies: `npm install`
2. Start SSE server: `npm run dev:sse -- --api-key YOUR_API_KEY`
3. Configure your client to use `http://localhost:3001`
4. See `sse-server/README.md` for detailed setup instructions

#### Quick Examples:
- **n8n**: Use MCP Tool node with SSE endpoint `http://localhost:3001/sse`
- **Dify**: Use Custom Tool with POST requests to `http://localhost:3001/tools/{toolName}`
- **Custom**: See integration examples in `sse-server/README.md`

## Requirements

- Docker installed and running
- kluster.ai API key
- Built Docker image: `kluster-verify-mcp`

## Build Docker Image

```bash
docker build -t kluster-verify-mcp .
```

## Available Tools

Both clients support:
- **`verify`**: Verify standalone claims against reliable sources using kluster.ai Verify service
- **`verify_document`**: Verify claims against document content using kluster.ai Verify service (with automatic document parsing in supported clients)