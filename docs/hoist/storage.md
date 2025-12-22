# Storage

Hoist provides S3-compatible object storage for files and assets.

## Create a Bucket

```bash
hoist storage create --app my-app --name uploads
```

## Access Keys

Generate access keys for your bucket:

```bash
hoist storage keys create --app my-app --bucket uploads --name api-key
```

Returns:
```
Access Key: ak_xxxxxxxxxxxxxxxxxxxx
Secret Key: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Save these credentials - the secret key won't be shown again.
```

## Using the SDK

Install the Hoist SDK:

```bash
bun add @hoist/sdk
```

Use in your app:

```typescript
import { createStorage } from "@hoist/sdk"

const storage = createStorage({
  endpoint: process.env.HOIST_STORAGE_ENDPOINT,
  accessKey: process.env.HOIST_ACCESS_KEY,
  secretKey: process.env.HOIST_SECRET_KEY,
  bucket: "uploads"
})

// Upload file
await storage.put("images/photo.jpg", fileBuffer, {
  contentType: "image/jpeg"
})

// Download file
const data = await storage.get("images/photo.jpg")

// List files
const files = await storage.list("images/")

// Delete file
await storage.delete("images/photo.jpg")
```

## Direct Upload from Browser

For large files, upload directly from the browser:

```typescript
// Server: Generate presigned URL
const url = await storage.getPresignedUrl("images/photo.jpg", {
  method: "PUT",
  expiresIn: 3600
})

// Client: Upload directly
await fetch(url, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": file.type }
})
```

## Static Asset Hosting

Serve static files from storage:

```typescript
app.get("/files/*", async (req, res) => {
  const path = req.params["*"]
  const file = await storage.get(path)

  if (!file) {
    return res.status(404).send("Not found")
  }

  res.type(file.contentType)
  res.send(file.data)
})
```

## Permissions

Keys can have different permission levels:

```bash
# Read-only key
hoist storage keys create --app my-app --bucket uploads --permissions read

# Read-write key
hoist storage keys create --app my-app --bucket uploads --permissions read-write
```
