# S3 API Reference

Shelves implements a subset of the S3 API for bucket and object operations.

## Bucket Operations

### List Buckets

```
GET /
```

Returns XML list of all buckets.

### Create Bucket

```
PUT /{bucket}
```

Creates a new bucket.

### Head Bucket

```
HEAD /{bucket}
```

Check if bucket exists. Returns 200 if exists, 404 if not.

### Delete Bucket

```
DELETE /{bucket}
```

Delete an empty bucket. Returns 409 if bucket is not empty.

## Object Operations

### List Objects

```
GET /{bucket}
```

Query parameters:
- `prefix` - Filter by key prefix
- `delimiter` - Group by delimiter
- `max-keys` - Maximum keys to return (default 1000)
- `continuation-token` - Pagination token

### Put Object

```
PUT /{bucket}/{key}
```

Headers:
- `Content-Type` - Object content type
- `Content-Length` - Object size

### Get Object

```
GET /{bucket}/{key}
```

Returns object data with appropriate content type.

### Head Object

```
HEAD /{bucket}/{key}
```

Returns object metadata without body.

### Delete Object

```
DELETE /{bucket}/{key}
```

Delete an object.

## Authentication

All requests require authentication via headers:

```
x-shelves-access-key: your-access-key
x-shelves-secret-key: your-secret-key
```

Or AWS Signature V4 in the `Authorization` header.

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (bucket not empty) |
| 500 | Server Error |
