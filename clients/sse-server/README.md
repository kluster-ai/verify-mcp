# SSE Server for HTTP-based MCP Clients

This Server-Sent Events (SSE) server provides an HTTP/SSE interface for kluster verify tools, allowing any HTTP-capable client to integrate with kluster.ai's verification capabilities.

## 🎯 Overview

The SSE server creates HTTP endpoints that expose kluster verify tools to any client that supports HTTP requests and Server-Sent Events. This is perfect for:

- **n8n** - Workflow automation with MCP Tool nodes
- **Dify** - AI application development platform (localhost only)
- **Custom integrations** - Any application that can make HTTP requests
- **Web applications** - Browser-based tools and dashboards
- **No-code platforms** - Zapier, Make.com, etc. (with HTTP support)

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the SSE Server
```bash
# Using npm script (recommended)
npm run dev:sse -- --api-key YOUR_KLUSTER_AI_API_KEY

# Or direct command
npx tsx clients/sse-server/sse-server.ts --api-key YOUR_KLUSTER_AI_API_KEY --port 3001
```

### 3. Server Endpoints

Once running, the server provides:
- **SSE Endpoint**: `http://localhost:3001/sse` - Real-time event stream
- **Tools Endpoint**: `http://localhost:3001/tools` - List available tools
- **Tool Execution**: `POST http://localhost:3001/tools/{toolName}`
- **Health Check**: `http://localhost:3001/health`

## 📡 Available Tools

### 1. fact_check
Verify standalone claims against reliable sources.

**Request:**
```bash
curl -X POST http://localhost:3001/tools/fact_check \
  -H "Content-Type: application/json" \
  -d '{
    "claim": "The Earth is flat",
    "return_search_results": true
  }'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "tool": "fact_check",
    "claim": "The Earth is flat",
    "is_accurate": false,
    "explanation": "This claim contradicts well-established scientific evidence...",
    "confidence": {
      "prompt_tokens": 50,
      "completion_tokens": 150,
      "total_tokens": 200
    },
    "search_results": [...]
  }
}
```

### 2. verify_document_claim
Verify if a claim accurately reflects document content.

**Request:**
```bash
curl -X POST http://localhost:3001/tools/verify_document_claim \
  -H "Content-Type: application/json" \
  -d '{
    "claim": "This document says coffee reduces cancer risk by 25%",
    "document_content": "Recent studies show coffee consumption may reduce cancer risk by 15-20%...",
    "return_search_results": true
  }'
```

## 🔌 Client Integration Examples

### n8n Integration

1. Add **MCP Client Tool** node to your workflow
2. Configure:
   - **SSE Endpoint URL**: `http://localhost:3001/sse`
   - **Connection Type**: Server-Sent Events (SSE)
3. Select tool: `fact_check` or `verify_document_claim`
4. Map input parameters from your workflow

### Dify Integration (Localhost)

1. In Dify, add a **Custom Tool** node
2. Configure HTTP request:
   - **Method**: POST
   - **URL**: `http://localhost:3001/tools/fact_check`
   - **Headers**: `Content-Type: application/json`
3. Map variables to request body:
   ```json
   {
     "claim": "{{claim_variable}}",
     "return_search_results": true
   }
   ```

### Custom Integration Example (Node.js)

```javascript
const EventSource = require('eventsource');

// Connect to SSE stream
const sse = new EventSource('http://localhost:3001/sse');

sse.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('SSE Event:', data);
};

// Execute tool
const response = await fetch('http://localhost:3001/tools/fact_check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    claim: 'The moon is made of cheese',
    return_search_results: true
  })
});

const result = await response.json();
console.log('Verification result:', result);
```

## 🔧 Configuration Options

### Command Line Arguments
- `--api-key <key>` - Your kluster.ai API key (required)
- `--base-url <url>` - API base URL (default: `https://api-r.klusterai.dev/v1`)
- `--port <port>` - Server port (default: `3001`)

### Environment Variables
```bash
export KLUSTER_AI_API_KEY=your_api_key_here
export KLUSTER_AI_BASE_URL=https://api-r.klusterai.dev/v1
export SSE_SERVER_PORT=3001
```

## 🚀 Production Deployment

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start "npx tsx clients/sse-server/sse-server.ts --api-key YOUR_KEY" --name kluster-sse

# Save configuration
pm2 save
pm2 startup
```

### Using Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3001
CMD ["npx", "tsx", "clients/sse-server/sse-server.ts"]
```

### Using systemd
```ini
[Unit]
Description=Kluster Verify SSE Server
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/path/to/kluster-verify
ExecStart=/usr/bin/node /path/to/clients/sse-server/sse-server.ts
Restart=on-failure
Environment="KLUSTER_AI_API_KEY=your_key_here"

[Install]
WantedBy=multi-user.target
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

Response includes:
- Server status
- Active SSE connections count
- Available endpoints
- Timestamp

### SSE Connection Events

The SSE stream broadcasts:
- **connection** - Initial connection confirmation
- **ping** - Keep-alive messages every 30 seconds
- **tool_execution** - Real-time tool execution results

## 🔒 Security Considerations

1. **API Key Protection**: Never expose your kluster.ai API key in client-side code
2. **CORS**: Configure CORS appropriately for production
3. **Rate Limiting**: Implement rate limiting for production use
4. **HTTPS**: Use HTTPS in production environments
5. **Authentication**: Add authentication layer for public deployments

## 🐛 Troubleshooting

### Connection Issues
- Verify server is running: `curl http://localhost:3001/health`
- Check firewall settings allow port 3001
- Ensure no other service is using the port

### Tool Execution Failures
- Check API key is valid
- Verify request format matches examples
- Monitor server console for detailed error messages
- Check kluster.ai API status

### SSE Connection Drops
- Normal behavior - clients should auto-reconnect
- Check for proxy timeout settings
- Monitor server logs for errors

## 📚 Additional Resources

- [kluster.ai Documentation](https://kluster.ai/docs)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [n8n MCP Tool Documentation](https://docs.n8n.io)
- [Dify Documentation](https://docs.dify.ai)