# Configuration

Configure Shelves using environment variables.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SHELVES_PORT` | `9000` | S3 API port |
| `SHELVES_ADMIN_PORT` | `9001` | Admin dashboard port |
| `SHELVES_DATA_DIR` | `./data` | Storage directory |
| `SHELVES_ACCESS_KEY` | `shelvesadmin` | Default access key |
| `SHELVES_SECRET_KEY` | `shelvesadmin` | Default secret key |

## Example

```bash
SHELVES_PORT=8000 \
SHELVES_ACCESS_KEY=mykey \
SHELVES_SECRET_KEY=mysecret \
SHELVES_DATA_DIR=/var/shelves \
bun run start
```

## Docker Configuration

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -e SHELVES_ACCESS_KEY=production-key \
  -e SHELVES_SECRET_KEY=production-secret \
  -v /data/shelves:/data \
  verbjs/shelves
```

## Production Recommendations

1. **Change default credentials** - Never use `shelvesadmin` in production
2. **Use persistent storage** - Mount a volume for `/data`
3. **Run behind proxy** - Use nginx/Caddy for SSL termination
4. **Set resource limits** - Configure memory/CPU limits in Docker
