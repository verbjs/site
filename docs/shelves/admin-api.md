# Admin API Reference

The Admin API runs on port 9001 and provides management endpoints.

## Endpoints

### Get Statistics

```
GET /api/stats
```

Returns storage statistics:

```json
{
  "buckets": 3,
  "objects": 156,
  "size": 52428800
}
```

### List Buckets

```
GET /api/buckets
```

Returns JSON array of buckets with metadata.

### Create Bucket

```
POST /api/buckets
Content-Type: application/json

{
  "name": "my-bucket"
}
```

### Delete Bucket

```
DELETE /api/buckets/{name}
```

### List Objects

```
GET /api/buckets/{name}/objects
```

Query parameters:
- `prefix` - Filter by key prefix

## Admin Dashboard

The web dashboard at `http://localhost:9001` provides:

- Total storage usage
- Number of objects
- Bucket overview
- Object browser
- Upload/download interface
