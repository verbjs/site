# Getting Started with Hoist

## Prerequisites

- Docker installed and running
- PostgreSQL database
- S3-compatible storage (MinIO, AWS S3, etc.)

## Server Setup

```bash
# Clone Hoist
git clone https://github.com/verbjs/hoist
cd hoist

# Install dependencies
bun install

# Configure environment
cp .env.example .env
```

Edit `.env`:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/hoist
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=hoist
AUTH_SECRET=your-secret-key-here
```

## Start Services

```bash
# Start all services
bun run dev

# Or individually
bun run dev:api    # API on :3001
bun run dev:web    # Dashboard on :3000
bun run dev:proxy  # Proxy on :80
```

## Install CLI

```bash
bun add -g @hoist/cli
```

## Login

```bash
hoist login http://localhost:3001
```

## Create Your First App

```bash
# Create app
hoist apps create my-app

# Deploy
cd /path/to/your/app
hoist deploy
```

## Dashboard

Access the web dashboard at `http://localhost:3000` to:

- View all apps
- Monitor deployments
- Manage environment variables
- Configure domains
- View logs
