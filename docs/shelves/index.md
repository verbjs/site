# Shelves

S3-compatible object storage for the Verb ecosystem.

## Overview

Shelves is a lightweight, self-hosted S3-compatible storage server built with Bun and Verb. It provides a drop-in replacement for Amazon S3, MinIO, or other object storage services.

## Features

- **S3-Compatible API** - Works with AWS SDKs, CLI tools, and existing S3 code
- **Simple Authentication** - Header-based auth or AWS Signature V4
- **File System Storage** - Objects stored directly on disk
- **Admin Dashboard** - Web UI for management on port 9001
- **Lightweight** - Minimal dependencies, fast startup
- **Part of Verb Ecosystem** - Seamless integration with Hoist

## Quick Start

```bash
# Install
bun add @verb-js/shelves

# Start the server
bun run shelves
```

Or with Docker:

```bash
docker run -d -p 9000:9000 -p 9001:9001 verbjs/shelves
```

## Default Ports

| Service | Port | Description |
|---------|------|-------------|
| S3 API | 9000 | S3-compatible REST API |
| Dashboard | 9001 | Admin web interface |

## Default Credentials

```
Access Key: shelvesadmin
Secret Key: shelvesadmin
```

> **Warning**: Change these credentials in production!

## Usage Example

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const client = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'shelvesadmin',
    secretAccessKey: 'shelvesadmin',
  },
  forcePathStyle: true,
})

await client.send(new PutObjectCommand({
  Bucket: 'my-bucket',
  Key: 'hello.txt',
  Body: 'Hello from Shelves!',
}))
```

## With Hoist

Shelves is automatically started when using Hoist's development environment:

```bash
hoist dev
```

## Verb Ecosystem

| Package | Description |
|---------|-------------|
| [Verb](https://github.com/verbjs/verb) | HTTP framework for Bun |
| [Hull](https://github.com/verbjs/hull) | Database toolkit |
| [Allow](https://github.com/verbjs/allow) | Authentication library |
| [Hoist](https://github.com/verbjs/hoist) | Self-hosted PaaS |
| **Shelves** | S3-compatible storage |
