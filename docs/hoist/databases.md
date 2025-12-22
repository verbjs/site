# Managed Databases

Hoist provides managed PostgreSQL databases for your apps.

## Create a Database

```bash
hoist db create --app my-app --name main
```

This creates:
- A new PostgreSQL database
- A dedicated user with limited permissions
- Automatic password generation

## Connection String

Get the connection string for your database:

```bash
hoist db url --app my-app --name main
# postgres://myapp_main:generated-pass@localhost:5432/myapp_main
```

## Using in Your App

Set the connection string as an environment variable:

```bash
hoist env set --app my-app DATABASE_URL=$(hoist db url --app my-app --name main)
```

Then use it in your code:

```typescript
import { connect } from "hull"

const repo = connect({ url: process.env.DATABASE_URL })
```

## Multiple Databases

Apps can have multiple databases:

```bash
hoist db create --app my-app --name main
hoist db create --app my-app --name analytics
hoist db create --app my-app --name cache
```

## Reset Password

If you need to regenerate credentials:

```bash
hoist db reset-password --app my-app --name main
```

## Database Info

```bash
# List databases
hoist db list --app my-app

# Show database details
hoist db info --app my-app --name main
```

## Backups

Databases are backed up automatically. Manual backup:

```bash
hoist db backup --app my-app --name main
```

## Delete Database

```bash
hoist db delete --app my-app --name main
```

**Warning**: This permanently deletes all data.
