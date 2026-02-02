import { DatalakeLibConfig, Logger } from "./types";
import { createDatalakeClient, defaultLogger } from "./datalake/client";
import { BucketManager } from "./datalake/bucket";
import { UploadService } from "./datalake/upload";
import { DownloadService } from "./datalake/download";
import { ListenerManager } from "./datalake/listeners";
import { OpenHIMService } from "./openhim/mediator";
import { mediatorEvents } from "./events/emitter";

/**
 * Creates a configured datalake library instance
 *
 * @param config - Configuration for the datalake and optional OpenHIM integration
 * @returns Object containing all services and utilities
 *
 * @example
 * ```typescript
 * import { createDatalakeLib } from '@jembi/openhim-datalake-lib';
 *
 * const lib = createDatalakeLib({
 *   datalake: {
 *     endPoint: 'localhost',
 *     port: 9000,
 *     useSSL: false,
 *     accessKey: 'your-access-key',
 *     secretKey: 'your-secret-key',
 *   },
 *   openhim: {
 *     apiURL: 'https://localhost:8080',
 *     username: 'root@openhim.org',
 *     password: 'password',
 *     mediatorUrn: 'urn:mediator:my-mediator',
 *   },
 * });
 *
 * // Upload a file
 * const result = await lib.upload.uploadBuffer(
 *   buffer,
 *   'file.json',
 *   'application/json',
 *   { bucket: 'my-bucket', createBucketIfNotExists: true }
 * );
 *
 * // Register a file processor
 * lib.listeners.registerProcessor({
 *   canProcess: (file) => file.endsWith('.json'),
 *   process: async (ctx) => console.log('Processing:', ctx.file),
 * });
 *
 * // Listen for uploads from other mediators
 * lib.events.onUpload((event) => {
 *   console.log('File uploaded:', event.file);
 * });
 * ```
 */
export function createDatalakeLib(config: DatalakeLibConfig) {
  const logger: Logger = config.logger || defaultLogger;
  const client = createDatalakeClient(config.datalake);
  const bucketManager = new BucketManager(client, logger);

  const openhimService = config.openhim
    ? new OpenHIMService(config.openhim, logger)
    : undefined;

  const uploadService = new UploadService(
    client,
    bucketManager,
    openhimService,
    logger,
  );
  const downloadService = new DownloadService(client, bucketManager, logger);
  const listenerManager = new ListenerManager(client, bucketManager, logger);

  return {
    /** The underlying MinIO client */
    client,
    /** Service for uploading files to the datalake */
    upload: uploadService,
    /** Service for downloading files from the datalake */
    download: downloadService,
    /** Manager for bucket operations */
    buckets: bucketManager,
    /** Manager for bucket notification listeners */
    listeners: listenerManager,
    /** Optional OpenHIM integration service */
    openhim: openhimService,
    /** Event emitter for cross-mediator communication */
    events: mediatorEvents,
  };
}

// Re-export types
export * from "./types";

// Re-export modules for advanced usage
export * from "./datalake";
export * from "./openhim";
export * from "./events";
