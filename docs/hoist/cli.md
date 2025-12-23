# Hoist CLI

The Hoist CLI provides command-line access to all Hoist features.

## Installation

```bash
bun add -g @verb-js/hoist
```

## Authentication

```bash
# Login to server
hoist login https://hoist.example.com

# Check current user
hoist whoami

# Logout
hoist logout
```

## Apps

```bash
# List apps
hoist apps list

# Create app
hoist apps create my-app

# Delete app
hoist apps delete my-app
```

## Deployments

```bash
# Deploy current directory
hoist deploy

# Deploy specific directory
hoist deploy ./path/to/app

# Deploy to specific app
hoist deploy --app my-app

# List deployments
hoist deployments list --app my-app

# Rollback
hoist rollback <deployment-id>
```

## Environment Variables

```bash
# List env vars
hoist env list --app my-app

# Set env var
hoist env set --app my-app DATABASE_URL=postgres://...

# Set multiple
hoist env set --app my-app KEY1=value1 KEY2=value2

# Remove env var
hoist env remove --app my-app DATABASE_URL
```

## Logs

```bash
# View logs
hoist logs --app my-app

# Stream logs
hoist logs --app my-app --follow

# Last N lines
hoist logs --app my-app --lines 100
```

## Domains

```bash
# List domains
hoist domains list --app my-app

# Add domain
hoist domains add --app my-app example.com

# Remove domain
hoist domains remove --app my-app example.com
```

## Databases

```bash
# List databases
hoist db list --app my-app

# Create database
hoist db create --app my-app --name mydb

# Get connection string
hoist db url --app my-app --name mydb
```
