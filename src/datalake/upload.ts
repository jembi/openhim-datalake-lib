import crypto from "crypto";
import fs from "fs/promises";
import * as Minio from "minio";
import { Logger, UploadOptions, UploadResult } from "../types";
import { mediatorEvents } from "../events/emitter";
import { defaultLogger } from "./client";
import { BucketManager } from "./bucket";
import { OpenHIMService } from "../openhim/mediator";

/**
 * Service for uploading files to the datalake
 */
export class UploadService {
  constructor(
    private client: Minio.Client,
    private bucketManager: BucketManager,
    private openhimService?: OpenHIMService,
    private logger: Logger = defaultLogger,
  ) {}

  /**
   * Uploads a buffer to the datalake
   * @param buffer - File buffer to upload
   * @param fileName - Name for the uploaded file
   * @param mimeType - MIME type of the file
   * @param options - Upload options
   * @returns Upload result
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    try {
      // Ensure bucket exists
      await this.bucketManager.ensureExists(
        options.bucket,
        options.createBucketIfNotExists,
      );

      // Check if file already exists
      const existsCheck = await this.bucketManager.checkFileExists(
        options.bucket,
        fileName,
        mimeType,
      );

      if (existsCheck.exists) {
        return {
          success: false,
          message: `File ${fileName} already exists in bucket ${options.bucket}`,
          bucket: options.bucket,
        };
      }

      // Build metadata
      const metadata = {
        "Content-Type": mimeType,
        "X-Upload-Id": crypto.randomUUID(),
        ...(options.customMetadata || {}),
      };

      // Upload the file
      await this.client.putObject(
        options.bucket,
        fileName,
        buffer,
        buffer.length,
        metadata,
      );

      const successMessage = `File uploaded as ${fileName} in bucket ${options.bucket}`;
      this.logger.info(successMessage);

      // Register bucket with OpenHIM if requested
      if (options.registerWithOpenHIM && this.openhimService) {
        await this.openhimService.registerBucket(options.bucket);
      }

      // Emit upload event
      mediatorEvents.emitUpload({
        bucket: options.bucket,
        file: fileName,
        mimeType,
        metadata: options.customMetadata || {},
        timestamp: new Date(),
      });

      return {
        success: true,
        message: successMessage,
        objectName: fileName,
        bucket: options.bucket,
      };
    } catch (error) {
      const errorMessage = `Error uploading file: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Uploads a file from a path to the datalake
   * @param filePath - Path to the file to upload
   * @param fileName - Name for the uploaded file
   * @param mimeType - MIME type of the file
   * @param options - Upload options
   * @returns Upload result
   */
  async uploadFromPath(
    filePath: string,
    fileName: string,
    mimeType: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    try {
      // Ensure bucket exists
      await this.bucketManager.ensureExists(
        options.bucket,
        options.createBucketIfNotExists,
      );

      // Build metadata
      const metadata = {
        "Content-Type": mimeType,
        "X-Upload-Id": crypto.randomUUID(),
        ...(options.customMetadata || {}),
      };

      // Upload the file
      this.logger.info(
        `Uploading file ${filePath} to bucket ${options.bucket}`,
      );
      await this.client.fPutObject(
        options.bucket,
        fileName,
        filePath,
        metadata,
      );

      const successMessage = `File ${filePath} uploaded as ${fileName} in bucket ${options.bucket}`;
      this.logger.info(successMessage);

      // Register bucket with OpenHIM if requested
      if (options.registerWithOpenHIM && this.openhimService) {
        await this.openhimService.registerBucket(options.bucket);
      }

      // Emit upload event
      mediatorEvents.emitUpload({
        bucket: options.bucket,
        file: fileName,
        mimeType,
        metadata: options.customMetadata || {},
        timestamp: new Date(),
      });

      return {
        success: true,
        message: successMessage,
        objectName: fileName,
        bucket: options.bucket,
      };
    } catch (error) {
      const errorMessage = `Error uploading file: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      throw new Error(`Failed to upload file ${filePath}`);
    }
  }
}
