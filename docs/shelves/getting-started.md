# Getting Started

Get Shelves running in minutes.

## Installation

### From Source

```bash
git clone https://github.com/verbjs/shelves.git
cd shelves
bun install
bun run start
```

### With Docker

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -v shelves-data:/data \
  -e SHELVES_ACCESS_KEY=mykey \
  -e SHELVES_SECRET_KEY=mysecret \
  verbjs/shelves
```

### With Docker Compose

```yaml
version: '3.8'
services:
  shelves:
    image: verbjs/shelves
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - SHELVES_ACCESS_KEY=mykey
      - SHELVES_SECRET_KEY=mysecret
    volumes:
      - shelves-data:/data

volumes:
  shelves-data:
```

## Verify Installation

Check that Shelves is running:

```bash
curl http://localhost:9000/
```

Access the admin dashboard at `http://localhost:9001`

## Create Your First Bucket

```bash
curl -X PUT \
  -H "x-shelves-access-key: shelvesadmin" \
  -H "x-shelves-secret-key: shelvesadmin" \
  http://localhost:9000/my-bucket
```

## Upload a File

```bash
curl -X PUT \
  -H "x-shelves-access-key: shelvesadmin" \
  -H "x-shelves-secret-key: shelvesadmin" \
  -H "Content-Type: text/plain" \
  -d "Hello, Shelves!" \
  http://localhost:9000/my-bucket/hello.txt
```

## Download a File

```bash
curl -H "x-shelves-access-key: shelvesadmin" \
     -H "x-shelves-secret-key: shelvesadmin" \
     http://localhost:9000/my-bucket/hello.txt
```

## Next Steps

- [Configuration](./configuration.md) - Environment variables and options
- [S3 API Reference](./api-reference.md) - Full API documentation
- [Authentication](./authentication.md) - Auth methods and security
