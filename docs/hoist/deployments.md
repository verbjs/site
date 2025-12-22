# Deployments

Hoist uses Docker containers for application deployments.

## How Deployments Work

1. **Upload** - Your code is uploaded to Hoist
2. **Build** - Docker image is built from your code
3. **Deploy** - Container is started with your image
4. **Route** - Proxy routes traffic to your container

## Dockerfile

Hoist looks for a `Dockerfile` in your project root:

```docker
FROM oven/bun:1

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000
CMD ["bun", "run", "start"]
```

## Auto-Detection

If no Dockerfile exists, Hoist auto-detects your framework:

| Framework | Build Command | Start Command |
|-----------|--------------|---------------|
| Bun | `bun install` | `bun run start` |
| Node.js | `npm install` | `npm start` |
| Static | - | Serve files |

## Environment Variables

Env vars are injected at runtime:

```bash
# Set before deploy
hoist env set --app my-app NODE_ENV=production
hoist env set --app my-app DATABASE_URL=postgres://...

# Then deploy
hoist deploy
```

## Health Checks

Hoist checks `/health` endpoint to verify deployment success:

```typescript
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})
```

## Rollbacks

Instantly rollback to any previous deployment:

```bash
# List deployments
hoist deployments list --app my-app

# Rollback to specific version
hoist rollback <deployment-id>
```

## Deployment Status

| Status | Meaning |
|--------|---------|
| `pending` | Build queued |
| `building` | Docker build in progress |
| `deploying` | Container starting |
| `running` | Live and healthy |
| `failed` | Build or health check failed |
| `stopped` | Manually stopped |
