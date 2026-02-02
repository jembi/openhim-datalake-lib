# @jembi/openhim-datalake-lib

Reusable datalake (MinIO/S3) upload and bucket management library for OpenHIM mediators.

## Features

- **Upload Service**: Upload files from buffers or paths with automatic metadata handling
- **Bucket Management**: Create, validate, and manage buckets
- **Listener Manager**: Plugin-based file processing with bucket notifications
- **OpenHIM Integration**: Automatic mediator registration and bucket config sync
- **Event System**: Cross-mediator communication via typed events

## Installation

```bash
npm install @jembi/openhim-datalake-lib minio openhim-mediator-utils
```

## Quick Start

```typescript
import { createDatalakeLib } from "@jembi/openhim-datalake-lib";

const lib = createDatalakeLib({
  datalake: {
    endPoint: "localhost",
    port: 9000,
    useSSL: false,
    accessKey: "your-access-key",
    secretKey: "your-secret-key",
  },
  openhim: {
    apiURL: "https://localhost:8080",
    username: "root@openhim.org",
    password: "password",
    mediatorUrn: "urn:mediator:my-mediator",
  },
});

// Upload a file
const result = await lib.upload.uploadBuffer(
  fileBuffer,
  "data.json",
  "application/json",
  { bucket: "my-bucket", createBucketIfNotExists: true },
);
```

## File Processing Plugins

Register processors to handle specific file types:

```typescript
lib.listeners.registerProcessor({
  canProcess: (file, mimeType) => mimeType === "application/json",
  process: async (ctx) => {
    const data = JSON.parse(ctx.buffer.toString());
    // Process the data...
  },
});

// Start listening for bucket notifications
await lib.listeners.startListening(["my-bucket"]);
```

## Cross-Mediator Events

Listen for events from other mediators:

```typescript
import { mediatorEvents } from "@jembi/openhim-datalake-lib";

mediatorEvents.onUpload((event) => {
  console.log(`File ${event.file} uploaded to ${event.bucket}`);
});
```

## API Reference

### `createDatalakeLib(config)`

Creates a configured library instance. Returns:

| Property    | Type                   | Description             |
| ----------- | ---------------------- | ----------------------- |
| `client`    | `Minio.Client`         | Underlying MinIO client |
| `upload`    | `UploadService`        | File upload operations  |
| `buckets`   | `BucketManager`        | Bucket management       |
| `listeners` | `ListenerManager`      | Notification listeners  |
| `openhim`   | `OpenHIMService?`      | OpenHIM integration     |
| `events`    | `MediatorEventEmitter` | Event emitter           |

### `UploadService`

- `uploadBuffer(buffer, fileName, mimeType, options)` - Upload from buffer
- `uploadFromPath(path, fileName, mimeType, options)` - Upload from file path

### `BucketManager`

- `ensureExists(bucket, createIfNotExists?)` - Ensure bucket exists
- `checkFileExists(bucket, fileName)` - Check if file exists
- `BucketManager.validateName(name)` - Validate bucket name
- `BucketManager.sanitizeName(name)` - Sanitize to valid name

### `ListenerManager`

- `registerProcessor(processor)` - Register file processor
- `startListening(buckets)` - Start listening for notifications
- `stopListening()` - Stop all listeners

## License

Apache-2.0
