# SSE Server for kluster.ai Verify

HTTP/SSE server providing kluster.ai Verify tools as REST endpoints for platforms that don't support native MCP.

## Quick Start

### Prerequisites

- **kluster.ai API key** - [Get one here](https://kluster.ai){target=_blank}.
- **Node.js** version 18 or higher.

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/kluster-ai/verify-mcp
   cd verify-mcp
   npm install
   npm run build
   ```

2. **Start SSE server**
   ```bash
   npm run sse:start -- --api-key YOUR_KLUSTER_API_KEY --port 3001
   ```

3. **Verify server is running**
   ```bash
   curl http://localhost:3001/health
   ```

## Available Endpoints

- **Health Check** - `GET http://localhost:3001/health`
- **Tools List** - `GET http://localhost:3001/tools`  
- **SSE Stream** - `GET http://localhost:3001/sse`
- **Verify Tool** - `POST http://localhost:3001/tools/verify`
- **Verify Document** - `POST http://localhost:3001/tools/verify_document`

## Usage Examples

### Verify Tool

```bash
curl -X POST http://localhost:3001/tools/verify \
  -H "Content-Type: application/json" \
  -d '{
    "claim": "The Eiffel Tower is located in Rome",
    "return_search_results": true
  }'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "tool": "verify",
    "claim": "The Eiffel Tower is located in Rome",
    "is_hallucination": true,
    "explanation": "The response provides a wrong location for the Eiffel Tower...",
    "usage": {
      "completion_tokens": 343,
      "prompt_tokens": 939,
      "total_tokens": 1282
    },
    "search_results": []
  },
  "timestamp": "2025-06-11T10:30:00.000Z"
}
```

### Verify Document Tool

```bash
curl -X POST http://localhost:3001/tools/verify_document \
  -H "Content-Type: application/json" \
  -d '{
    "claim": "This employment contract allows unlimited remote work",
    "document_content": "Section 4.2: Employee must maintain primary residence within 50 miles of headquarters and work on-site minimum 3 days per week...",
    "return_search_results": true
  }'
```

## Configuration

### Command Line Options

- `--api-key <key>` - Your kluster.ai API key (required).
- `--base-url <url>` - API base URL (default: https://api.kluster.ai/v1).
- `--port <port>` - Server port (default: 3001).

### Environment Variables

```bash
export KLUSTER_API_KEY=your_api_key_here
export KLUSTER_AI_BASE_URL=https://api.kluster.ai/v1
```

## Integration Examples

### n8n Workflow

1. Add HTTP Request node.
2. Configure:
   - **Method**: POST
   - **URL**: `http://localhost:3001/tools/verify`
   - **Body**: JSON with `claim` parameter

### Dify Custom Tool

1. Add Custom Tool node.
2. Configure:
   - **Method**: POST  
   - **URL**: `http://localhost:3001/tools/verify`
   - **Headers**: `Content-Type: application/json`

## Troubleshooting

**Connection Issues**: Verify server is running with `curl http://localhost:3001/health`.

**Authentication Errors**: Check your API key is correct and has proper permissions.

**Port Conflicts**: Change port with `--port` option if 3001 is in use.

## License

MIT License - see LICENSE file for details.