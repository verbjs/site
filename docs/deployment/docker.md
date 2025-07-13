# Docker Deployment

Deploy your Verb applications using Docker with optimized multi-stage builds for production.

## Quick Start

Create a `Dockerfile` in your project root:

```dockerfile
# Multi-stage build for optimal production image
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies (cached layer)
FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS build
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build 2>/dev/null || echo "No build script found"

# Production stage
FROM oven/bun:1-slim AS production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 verb

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build --chown=verb:nodejs /app .

USER verb

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --eval "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "src/server.ts"]
```

## Build and Run

```bash
# Build the image
docker build -t my-verb-app .

# Run the container
docker run -p 3000:3000 my-verb-app
```

## Docker Compose

For local development and testing:

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/myapp
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

## Production Optimizations

### Multi-stage Build Benefits
- **Smaller image size**: Only production dependencies included
- **Security**: No build tools in production image
- **Caching**: Dependencies cached separately from source code

### Environment-specific Dockerfiles

#### Development
```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "--hot", "src/server.ts"]
```

#### Production with Build Step
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 verb

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build --chown=verb:nodejs /app/dist ./dist
COPY --from=build --chown=verb:nodejs /app/package.json ./

USER verb
EXPOSE 3000
CMD ["bun", "dist/server.js"]
```

## Database Integration

### PostgreSQL Example
```yaml
services:
  app:
    build: .
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/myapp
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### SQLite Example
```dockerfile
# Create volume for SQLite database
VOLUME ["/app/data"]

# Ensure data directory exists
RUN mkdir -p /app/data && chown verb:nodejs /app/data

# SQLite database will be at /app/data/database.sqlite
ENV DATABASE_URL=sqlite:///app/data/database.sqlite
```

## Security Best Practices

### Non-root User
```dockerfile
# Create user with specific UID/GID
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 verb

# Change ownership of app files
COPY --chown=verb:nodejs . .
USER verb
```

### Secrets Management
```dockerfile
# Use build secrets for sensitive data
# syntax=docker/dockerfile:1
FROM oven/bun:1
RUN --mount=type=secret,id=database_url \
    DATABASE_URL=$(cat /run/secrets/database_url)
```

```bash
# Build with secrets
echo "postgresql://user:pass@host:5432/db" | docker build --secret id=database_url,src=- .
```

## Registry and CI/CD

### GitHub Actions Example
```yaml
name: Build and Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t my-verb-app .
      
      - name: Run tests in container
        run: |
          docker run --rm my-verb-app bun test
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker tag my-verb-app username/my-verb-app:${{ github.sha }}
          docker push username/my-verb-app:${{ github.sha }}
```

## Common Issues

### Bun Cache
```dockerfile
# Clear Bun cache if needed
RUN bun pm cache rm
```

### File Permissions
```dockerfile
# Fix file permissions
COPY --chown=verb:nodejs . .
RUN chmod +x scripts/*.sh
```

### Health Check Timeout
```dockerfile
# Increase timeout for slow startup
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD bun --eval "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

## Next Steps

- [Cloud Platform Deployment](./cloud-platforms.md)
- [Production Configuration](./production-config.md)
- [Health Checks](./health-checks.md)