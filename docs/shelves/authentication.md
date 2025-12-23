# Authentication

Shelves supports two authentication methods.

## Header-Based Authentication

The simplest method uses custom headers:

```bash
curl -H "x-shelves-access-key: your-access-key" \
     -H "x-shelves-secret-key: your-secret-key" \
     http://localhost:9000/my-bucket/file.txt
```

## AWS Signature V4

For compatibility with AWS SDKs, Shelves supports AWS Signature V4 authentication.

### JavaScript Example

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
  Body: 'Hello!',
}))
```

### AWS CLI

```bash
aws configure --profile shelves
# Access Key: shelvesadmin
# Secret Key: shelvesadmin
# Region: us-east-1

aws --profile shelves --endpoint-url http://localhost:9000 s3 ls
```

## Security Best Practices

1. **Change default credentials** in production
2. **Use HTTPS** via reverse proxy (nginx, Caddy)
3. **Rotate credentials** periodically
4. **Limit network access** using firewall rules
5. **Monitor access logs** for suspicious activity
