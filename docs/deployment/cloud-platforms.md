# Cloud Platform Deployment

Deploy your Verb applications to popular cloud platforms with platform-specific optimizations.

## Railway

Railway offers zero-config deployments with automatic HTTPS and custom domains.

### Quick Deploy

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Configuration

Create `railway.toml`:
```toml
[build]
builder = "nixpacks"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[[deploy.environmentVariables]]
name = "NODE_ENV"
value = "production"

[[deploy.environmentVariables]]
name = "PORT"
value = "$PORT"
```

### Environment Variables
```bash
# Set via CLI
railway variables set DATABASE_URL="postgresql://..."
railway variables set JWT_SECRET="your-secret"

# Or via Railway dashboard
# Variables tab in your project
```

### Custom Start Command
```json
{
  "scripts": {
    "start": "bun src/server.ts",
    "build": "echo 'No build needed for Bun'"
  }
}
```

### Database Integration
```bash
# Add PostgreSQL
railway add postgresql

# Get connection string
railway variables
# Copy DATABASE_URL value
```

## Fly.io

Fly.io provides global edge deployment with strong Docker support.

### Setup

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login and launch
fly auth login
fly launch
```

### Configuration

`fly.toml`:
```toml
app = "my-verb-app"
primary_region = "sjc"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[services]]
  protocol = "tcp"
  internal_port = 3000

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

[[services.tcp_checks]]
  interval = "15s"
  timeout = "2s"
  grace_period = "1s"
  restart_limit = 0

[[services.http_checks]]
  interval = "10s"
  timeout = "2s"
  grace_period = "5s"
  restart_limit = 0
  method = "get"
  path = "/health"
  protocol = "http"
  tls_skip_verify = false

[env]
  NODE_ENV = "production"
  PORT = "3000"
```

### Dockerfile for Fly.io
```dockerfile
FROM oven/bun:1-slim
WORKDIR /app

# Copy files
COPY package.json bun.lockb ./
RUN bun install --production --frozen-lockfile

COPY . .

# Create user
RUN adduser --disabled-password --gecos "" --uid 1001 bun
RUN chown -R bun:bun /app
USER bun

EXPOSE 3000
CMD ["bun", "src/server.ts"]
```

### Secrets Management
```bash
# Set secrets
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="your-secret"

# List secrets
fly secrets list
```

### Scale and Regions
```bash
# Scale to multiple regions
fly scale count 2 --region sjc,ord

# Set machine specs
fly scale vm shared-cpu-1x --memory 256
```

## Vercel

Vercel excels at serverless deployments with automatic scaling.

### Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Configuration

`vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/bun"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/server.ts": {
      "runtime": "bun"
    }
  }
}
```

### Serverless Optimization

```typescript
// src/server.ts - Vercel optimized
import { createServer, ServerProtocol } from 'verb';

const app = createServer(ServerProtocol.HTTP);

// Your routes here
app.get('/api/health', async (req, res) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export for Vercel
export default app.createFetchHandler();
```

### Environment Variables
```bash
# Set via CLI
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production

# Or via Vercel dashboard
# Settings > Environment Variables
```

### Limitations
- **WebSockets**: Not supported in serverless
- **Long-running processes**: Functions timeout
- **File system**: Read-only, use external storage

## AWS Lambda

Deploy Verb applications as Lambda functions with API Gateway.

### Setup with Serverless Framework

```yaml
# serverless.yml
service: verb-app

provider:
  name: aws
  runtime: provided.al2
  region: us-east-1
  environment:
    NODE_ENV: production

functions:
  app:
    handler: src/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
      - http:
          path: /
          method: ANY
          cors: true

plugins:
  - serverless-bun

custom:
  bun:
    install: true
```

### Lambda Handler

```typescript
// src/lambda.ts
import { createServer, ServerProtocol } from 'verb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

const app = createServer(ServerProtocol.HTTP);

// Your routes
app.get('/health', async (req, res) => {
  return res.json({ status: 'ok' });
});

// Lambda handler
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Convert Lambda event to Request
  const request = new Request(`https://${event.headers.Host}${event.path}`, {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : undefined,
  });

  // Process with Verb
  const response = await app.createFetchHandler()(request);
  
  // Convert Response to Lambda result
  const body = await response.text();
  
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    isBase64Encoded: false,
  };
};
```

## Digital Ocean App Platform

Simple PaaS deployment with automatic scaling.

### Configuration

`.do/app.yaml`:
```yaml
name: verb-app
services:
- name: web
  source_dir: /
  github:
    repo: your-username/your-repo
    branch: main
  run_command: bun src/server.ts
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 3000
  health_check:
    http_path: /health
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    type: SECRET
    value: your-database-url
```

### Deploy
```bash
# Install doctl
# Deploy
doctl apps create --spec .do/app.yaml
```

## Render

Zero-config deployments with automatic SSL.

### Configuration

```yaml
# render.yaml
services:
  - type: web
    name: verb-app
    env: node
    plan: free
    buildCommand: bun install
    startCommand: bun src/server.ts
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: postgres
          property: connectionString
    healthCheckPath: /health

databases:
  - name: postgres
    plan: free
```

## Platform Comparison

| Platform | Best For | Pricing | Scaling | Database |
|----------|----------|---------|---------|----------|
| Railway | Rapid prototyping | Usage-based | Manual | Built-in PostgreSQL |
| Fly.io | Global apps | VM-based | Auto/manual | External required |
| Vercel | Static + API | Request-based | Automatic | External required |
| AWS Lambda | Enterprise | Pay-per-request | Automatic | External required |
| Digital Ocean | Simple apps | Fixed pricing | Manual | Managed databases |
| Render | MVPs | Tiered pricing | Automatic | Built-in PostgreSQL |

## Best Practices

### Health Checks
Always implement health check endpoints:
```typescript
app.get('/health', async (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});
```

### Environment Configuration
Use environment variables for configuration:
```typescript
const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
};
```

### Graceful Shutdown
Handle shutdown signals properly:
```typescript
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.stop();
});
```

## Next Steps

- [Production Configuration](./production-config.md)
- [Health Checks](./health-checks.md)
- [Graceful Shutdown](./graceful-shutdown.md)