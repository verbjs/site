# Hoist

Hoist is a self-hosted Platform-as-a-Service (PaaS) built with the Verb ecosystem. Deploy applications, manage databases, and handle storage on your own infrastructure.

## Features

- **Container Deployments** - Docker-based app deployments
- **Managed Databases** - Per-app PostgreSQL instances
- **Object Storage** - S3-compatible file storage
- **Static Hosting** - Deploy static sites and SPAs
- **Custom Domains** - Route traffic with custom domains
- **Environment Variables** - Secure config management
- **Rollbacks** - Instant rollback to previous deployments

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CLI/Web   │────▶│    API      │────▶│   Docker    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌──────────┐  ┌──────────┐
              │ PostgreSQL│  │    S3    │
              └──────────┘  └──────────┘
```

## Quick Start

```bash
# Install CLI
bun add -g @hoist/cli

# Login to your Hoist server
hoist login https://hoist.yourserver.com

# Deploy an app
hoist deploy ./my-app
```

## Packages

| Package | Description |
|---------|-------------|
| `@hoist/api` | REST API server |
| `@hoist/web` | Dashboard UI |
| `@hoist/cli` | Command-line tool |
| `@hoist/proxy` | Reverse proxy for routing |
| `@hoist/sdk` | Client SDK for storage/databases |

## Built With

- **Verb** - HTTP server framework
- **Hull** - Database toolkit
- **Allow** - Authentication
- **Docker** - Container runtime
- **S3** - Object storage (MinIO compatible)
