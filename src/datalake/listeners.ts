import * as Minio from "minio";
import { FileProcessor, Logger, ProcessorContext } from "../types";
import { mediatorEvents } from "../events/emitter";
import { defaultLogger } from "./client";
import { BucketManager } from "./bucket";

/**
 * Manages bucket notification listeners with plugin-based file processing
 */
export class ListenerManager {
  private processors: FileProcessor[] = [];
  private registeredBuckets: Set<string> = new Set();
  private listeners: Map<string, Minio.NotificationPoller> = new Map();

  constructor(
    private client: Minio.Client,
    private bucketManager: BucketManager,
    private logger: Logger = defaultLogger,
    private prefix: string = "",
    private suffix: string = "",
  ) {}

  /**
   * Registers a file processor plugin
   * Processors are called in order of registration
   * @param processor - FileProcessor implementation
   */
  registerProcessor(processor: FileProcessor): void {
    this.processors.push(processor);
    this.logger.debug(
      `Registered file processor: ${processor.constructor.name}`,
    );
  }

  /**
   * Starts listening for bucket notifications on the specified buckets
   * @param buckets - List of bucket names to listen on
   */
  async startListening(buckets: string[]): Promise<void> {
    for (const bucket of buckets) {
      if (this.registeredBuckets.has(bucket)) {
        this.logger.debug(`Bucket ${bucket} already has a listener`);
        continue;
      }

      const listener = this.client.listenBucketNotification(
        bucket,
        this.prefix,
        this.suffix,
        ["s3:ObjectCreated:*"],
      );

      this.registeredBuckets.add(bucket);
      this.listeners.set(bucket, listener);

      this.logger.info(`Listening for notifications on bucket ${bucket}`);

      listener.on("notification", async (notification) => {
        await this.handleNotification(bucket, notification);
      });

      listener.on("error", (error) => {
        this.logger.error(`Listener error on bucket ${bucket}: ${error}`);
      });
    }
  }

  /**
   * Stops listening on all buckets
   */
  stopListening(): void {
    for (const [bucket, listener] of this.listeners) {
      listener.stop();
      this.logger.info(`Stopped listening on bucket ${bucket}`);
    }
    this.listeners.clear();
    this.registeredBuckets.clear();
  }

  /**
   * Handles a bucket notification
   */
  private async handleNotification(
    bucket: string,
    notification: any,
  ): Promise<void> {
    const file = notification.s3?.object?.key;
    if (!file) {
      this.logger.warn("Received notification without file key");
      return;
    }

    this.logger.info(`File received: ${file} from bucket ${bucket}`);

    // Emit notification event
    mediatorEvents.emitNotification({
      bucket,
      file,
      eventType: "s3:ObjectCreated:*",
    });

    // Download file for processing
    try {
      const tmpPath = `tmp/${file}`;
      await this.client.fGetObject(bucket, file, tmpPath);

      const { readFile, rm } = await import("fs/promises");
      const buffer = await readFile(tmpPath);
      const mimeType = this.detectMimeType(file);

      const context: ProcessorContext = {
        bucket,
        file,
        buffer,
        mimeType,
        metadata: {},
      };

      // Run matching processors
      for (const processor of this.processors) {
        if (processor.canProcess(file, mimeType)) {
          try {
            await processor.process(context);
            this.logger.debug(
              `Processed ${file} with ${processor.constructor.name}`,
            );
          } catch (err) {
            this.logger.error(
              `Processor ${processor.constructor.name} failed for ${file}: ${err}`,
            );
          }
        }
      }

      // Clean up temp file
      await rm(tmpPath);
      this.logger.debug(`Cleaned up temp file ${tmpPath}`);
    } catch (error) {
      this.logger.error(`Error processing file ${file}: ${error}`);
    }
  }

  /**
   * Detects MIME type based on file extension
   */
  private detectMimeType(file: string): string {
    const ext = file.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      json: "application/json",
      csv: "text/csv",
      txt: "text/plain",
      xml: "application/xml",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      mp4: "video/mp4",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  /**
   * Gets the list of registered processors
   */
  getProcessors(): FileProcessor[] {
    return [...this.processors];
  }
}
